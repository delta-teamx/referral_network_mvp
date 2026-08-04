import { env } from '../../../config/env.js';
import { prisma } from '../../../config/prisma.js';
import { getKnowledge, KNOWLEDGE_VERSION } from './roul.knowledge.js';

/**
 * ROUL RAG layer — a re-syncable pgvector knowledge store.
 *
 * The curated KB (roul.knowledge.ts) is chunked, embedded with OpenAI, and
 * stored in a pgvector table. At answer time ROUL retrieves the top-K chunks
 * most similar to the member's question and grounds its reply in those.
 *
 * Everything here is best-effort and DEGRADES SAFELY: if pgvector isn't
 * available, OpenAI isn't configured, or retrieval returns nothing, the caller
 * falls back to injecting the full curated KB — so accuracy never regresses.
 *
 * The store is created purely via raw SQL (the `vector` column type isn't a
 * first-class Prisma type), isolated so a failure never touches other schema.
 */

const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_DIM = 1536;
const KB_VERSION_KEY = 'roul_kb_version';

let ragReady: boolean | null = null;

/** Embed a single string via OpenAI. Returns null when unavailable. */
export async function embedText(text: string): Promise<number[] | null> {
  if (!env.OPENAI_API_KEY) return null;
  const input = text.trim().slice(0, 8000);
  if (!input) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBED_MODEL, input }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vec = json.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBED_DIM) return null;
    return vec;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul-rag] embed failed', err);
    return null;
  }
}

/** Format a number[] as a pgvector literal. Only finite numbers, so safe to inline. */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;
}

/**
 * Ensure the pgvector extension + KnowledgeChunk table exist. Best-effort and
 * isolated: any failure (e.g. the DB role can't create the extension) simply
 * leaves RAG disabled and the curated-KB fallback in charge. Cached per process.
 */
export async function ensureRagSchema(): Promise<boolean> {
  if (ragReady !== null) return ragReady;
  try {
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
         "id" TEXT PRIMARY KEY,
         "title" TEXT,
         "content" TEXT NOT NULL,
         "source" TEXT NOT NULL DEFAULT 'curated',
         "embedding" vector(${EMBED_DIM}),
         "version" TEXT,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
         "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
       );`,
    );
    // Cosine HNSW index - best-effort (tiny tables scan fine without it).
    try {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx"
           ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);`,
      );
    } catch {
      /* index optional */
    }
    ragReady = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[roul-rag] pgvector unavailable, falling back to curated KB:', String(err));
    ragReady = false;
  }
  return ragReady;
}

/** Split the curated KB into one chunk per "## Section". */
export function chunkKnowledge(kb: string): { title: string; content: string }[] {
  const chunks: { title: string; content: string }[] = [];
  // Split on level-2 headings, keeping each heading with its body.
  const parts = kb.split(/\n(?=##\s)/g);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith('# ') && !trimmed.startsWith('## ')) continue;
    const firstLine = trimmed.split('\n')[0] ?? '';
    const title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 160);
    if (trimmed.length < 12) continue;
    chunks.push({ title, content: trimmed });
  }
  return chunks;
}

/**
 * Re-embed and upsert the curated KB into the vector store. Idempotent: skips
 * when the stored version already matches KNOWLEDGE_VERSION (unless forced).
 * This is the "re-syncable" entry point - call it on boot and from the admin
 * console after editing knowledge.
 */
export async function syncKnowledge(
  opts: { force?: boolean } = {},
): Promise<{ available: boolean; synced: number; skipped?: boolean }> {
  const available = await ensureRagSchema();
  if (!available) return { available: false, synced: 0, skipped: true };

  // Version gate: don't burn embedding calls when nothing changed.
  if (!opts.force) {
    const stored = await prisma.appSetting.findUnique({ where: { key: KB_VERSION_KEY } });
    const storedVersion =
      stored && typeof stored.value === 'object' && stored.value
        ? (stored.value as { version?: string }).version
        : undefined;
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::bigint AS count FROM "KnowledgeChunk" WHERE "source" = 'curated';`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (storedVersion === KNOWLEDGE_VERSION && count > 0) {
      return { available: true, synced: 0, skipped: true };
    }
  }

  const chunks = chunkKnowledge(getKnowledge());
  // Embed all chunks first; if any embedding fails (e.g. OpenAI down) abort the
  // whole sync so we never leave a half-populated store.
  const embedded: { title: string; content: string; vec: number[] }[] = [];
  for (const c of chunks) {
    const vec = await embedText(`${c.title}\n${c.content}`);
    if (!vec) return { available: true, synced: 0, skipped: true };
    embedded.push({ ...c, vec });
  }

  // Replace the curated set ATOMICALLY: wrap the delete + all inserts in one
  // transaction so a mid-loop failure can never leave a partially-populated KB
  // (embeddings were computed above, outside the tx, so no long calls inside it).
  const synced = embedded.length;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "KnowledgeChunk" WHERE "source" = 'curated';`);
    for (let i = 0; i < embedded.length; i++) {
      const c = embedded[i]!;
      const id = `curated-${KNOWLEDGE_VERSION}-${i}`;
      await tx.$executeRawUnsafe(
        `INSERT INTO "KnowledgeChunk" ("id","title","content","source","embedding","version","updatedAt")
         VALUES ($1,$2,$3,'curated', '${toVectorLiteral(c.vec)}'::vector, $4, CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO UPDATE SET
           "title"=EXCLUDED."title", "content"=EXCLUDED."content",
           "embedding"=EXCLUDED."embedding", "version"=EXCLUDED."version",
           "updatedAt"=CURRENT_TIMESTAMP;`,
        id,
        c.title,
        c.content,
        KNOWLEDGE_VERSION,
      );
    }
  });

  await prisma.appSetting.upsert({
    where: { key: KB_VERSION_KEY },
    create: { key: KB_VERSION_KEY, value: { version: KNOWLEDGE_VERSION, syncedChunks: synced } },
    update: { value: { version: KNOWLEDGE_VERSION, syncedChunks: synced } },
  });

  // eslint-disable-next-line no-console
  console.log(`[roul-rag] synced ${synced} knowledge chunks (v${KNOWLEDGE_VERSION})`);
  return { available: true, synced };
}

/**
 * Retrieve the top-K knowledge chunks most relevant to a query. Returns null
 * when RAG is unavailable (no pgvector, no OpenAI, empty store, or an error),
 * signalling the caller to fall back to the full curated KB.
 */
export async function retrieveKnowledge(query: string, k = 6): Promise<string[] | null> {
  const available = await ensureRagSchema();
  if (!available) return null;
  const vec = await embedText(query);
  if (!vec) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<{ content: string }[]>(
      `SELECT "content" FROM "KnowledgeChunk"
         WHERE "embedding" IS NOT NULL
         ORDER BY "embedding" <=> '${toVectorLiteral(vec)}'::vector
         LIMIT ${Math.max(1, Math.min(20, k))};`,
    );
    if (rows.length === 0) return null;
    return rows.map((r) => r.content);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[roul-rag] retrieval failed', err);
    return null;
  }
}
