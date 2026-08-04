import { randomUUID } from 'node:crypto';
import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { embedText, ensureRagSchema, syncKnowledge } from './roul.rag.js';
import {
  DEFAULT_ROUL_INSTRUCTIONS,
  getRoulInstructions,
  setRoulInstructions,
} from './roul.service.js';

/**
 * Admin operations behind the ROUL console: the escalation log, editing ROUL's
 * knowledge without a deploy (chunks stored in the pgvector table), and editing
 * ROUL's system-prompt instructions.
 */

// ── Escalation log ───────────────────────────────────────────────────────────

export async function listEscalations() {
  return prisma.$queryRawUnsafe<
    {
      id: string;
      ticketId: string | null;
      name: string | null;
      email: string | null;
      stuckStep: string | null;
      transcript: string | null;
      resolvedAt: Date | null;
      createdAt: Date;
    }[]
  >(
    `SELECT "id","ticketId","name","email","stuckStep","transcript","resolvedAt","createdAt"
       FROM "SupportEscalation" ORDER BY "createdAt" DESC LIMIT 100;`,
  );
}

export async function resolveEscalation(id: string): Promise<{ ok: boolean }> {
  await prisma.$executeRawUnsafe(
    `UPDATE "SupportEscalation" SET "resolvedAt" = CURRENT_TIMESTAMP WHERE "id" = $1;`,
    id,
  );
  return { ok: true };
}

// ── Knowledge editing (no deploy) ────────────────────────────────────────────

function vectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? n : 0)).join(',')}]`;
}

export async function listKnowledgeChunks() {
  const ok = await ensureRagSchema();
  if (!ok) return [];
  return prisma.$queryRawUnsafe<
    { id: string; title: string | null; content: string; source: string; updatedAt: Date }[]
  >(
    `SELECT "id","title","content","source","updatedAt"
       FROM "KnowledgeChunk" ORDER BY "source" ASC, "updatedAt" DESC LIMIT 500;`,
  );
}

/** Add or edit an admin knowledge chunk (embedded on save so ROUL retrieves it). */
export async function upsertKnowledgeChunk(input: {
  id?: string;
  title: string;
  content: string;
}) {
  const ok = await ensureRagSchema();
  if (!ok) throw AppError.badRequest('The knowledge store is unavailable right now.');
  const title = (input.title ?? '').trim().slice(0, 200);
  const content = (input.content ?? '').trim();
  if (!content) throw AppError.badRequest('Knowledge content is required.');

  const vec = await embedText(`${title}\n${content}`);
  if (!vec) throw AppError.badRequest('Could not embed this knowledge — please try again shortly.');

  const id = input.id?.trim() || `admin-${randomUUID()}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "KnowledgeChunk" ("id","title","content","source","embedding","version","updatedAt")
     VALUES ($1,$2,$3,'admin', '${vectorLiteral(vec)}'::vector, 'admin', CURRENT_TIMESTAMP)
     ON CONFLICT ("id") DO UPDATE SET
       "title"=EXCLUDED."title", "content"=EXCLUDED."content",
       "embedding"=EXCLUDED."embedding", "updatedAt"=CURRENT_TIMESTAMP;`,
    id,
    title,
    content,
  );
  return { id, title, content, source: 'admin' };
}

export async function deleteKnowledgeChunk(id: string): Promise<{ ok: boolean }> {
  await prisma.$executeRawUnsafe(`DELETE FROM "KnowledgeChunk" WHERE "id" = $1;`, id);
  return { ok: true };
}

/** Force a re-embed of the curated KB into the vector store. */
export async function resyncCuratedKnowledge() {
  return syncKnowledge({ force: true });
}

// ── System prompt ────────────────────────────────────────────────────────────

export async function getPrompt(): Promise<{ instructions: string; default: string }> {
  return { instructions: await getRoulInstructions(), default: DEFAULT_ROUL_INSTRUCTIONS };
}

export async function updatePrompt(text: string | null): Promise<{ ok: boolean }> {
  await setRoulInstructions(text);
  return { ok: true };
}
