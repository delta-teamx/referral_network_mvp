import { prisma } from '../../../config/prisma.js';

/**
 * OpenAI embeddings for member profiles. Converts the structured profile
 * (business, ICP, referral capability, barter, bio, video transcript) into
 * a single text blob, then embeds it via `text-embedding-3-small`. The
 * resulting vector is stored as JSON on MemberProfile.profileEmbedding.
 *
 * When OPENAI_API_KEY is not set, this module is a no-op — the rules-based
 * matcher in ai-matching.service.ts handles scoring without embeddings.
 *
 * Usage:
 *   - Called after profile upsert to keep the embedding fresh.
 *   - Called by the scheduler to batch-refresh stale embeddings.
 *   - The AI matching engine optionally uses cosine similarity between
 *     embeddings as an additional scoring signal.
 */

function profileToText(p: {
  businessName: string;
  industry: string;
  headline: string | null;
  bio: string | null;
  keywords: string[];
  servicesOffered: string[];
  icpIndustries: string[];
  icpRoles: string[];
  icpProblems: string[];
  canReferIndustries: string[];
  canReferTypes: string[];
  barterOfferings: string[];
  barterWants: string[];
  videoTranscript: string | null;
}): string {
  const parts = [
    `Business: ${p.businessName}`,
    `Industry: ${p.industry}`,
    p.headline ? `Headline: ${p.headline}` : '',
    p.bio ? `About: ${p.bio}` : '',
    p.keywords.length ? `Keywords: ${p.keywords.join(', ')}` : '',
    p.servicesOffered.length ? `Services: ${p.servicesOffered.join(', ')}` : '',
    p.icpIndustries.length ? `Wants to meet industries: ${p.icpIndustries.join(', ')}` : '',
    p.icpRoles.length ? `Wants to meet roles: ${p.icpRoles.join(', ')}` : '',
    p.icpProblems.length ? `Problems solved for clients: ${p.icpProblems.join('; ')}` : '',
    p.canReferIndustries.length ? `Can refer to: ${p.canReferIndustries.join(', ')}` : '',
    p.canReferTypes.length ? `Refers client types: ${p.canReferTypes.join('; ')}` : '',
    p.barterOfferings.length ? `Barter offerings: ${p.barterOfferings.join(', ')}` : '',
    p.barterWants.length ? `Barter wants: ${p.barterWants.join(', ')}` : '',
    p.videoTranscript ? `Video transcript: ${p.videoTranscript}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

async function getOpenAI(): Promise<{ embed: (text: string) => Promise<number[]> } | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    // @ts-expect-error — openai is optional
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI();
    return {
      async embed(text: string): Promise<number[]> {
        const res = await client.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });
        return res.data[0]?.embedding ?? [];
      },
    };
  } catch {
    return null;
  }
}

export async function embedProfile(userId: string): Promise<boolean> {
  const ai = await getOpenAI();
  if (!ai) return false;

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      businessName: true,
      industry: true,
      headline: true,
      bio: true,
      keywords: true,
      servicesOffered: true,
      icpIndustries: true,
      icpRoles: true,
      icpProblems: true,
      canReferIndustries: true,
      canReferTypes: true,
      barterOfferings: true,
      barterWants: true,
      videoTranscript: true,
    },
  });
  if (!profile) return false;

  const text = profileToText(profile);
  const embedding = await ai.embed(text);
  if (embedding.length === 0) return false;

  await prisma.memberProfile.update({
    where: { userId },
    data: {
      profileEmbedding: embedding,
      embeddingUpdatedAt: new Date(),
    },
  });
  return true;
}

export async function refreshStaleEmbeddings(
  maxAge = 7 * 86400_000,
): Promise<{ updated: number; skipped: number }> {
  const ai = await getOpenAI();
  if (!ai) return { updated: 0, skipped: 0 };

  const cutoff = new Date(Date.now() - maxAge);
  const profiles = await prisma.memberProfile.findMany({
    where: {
      OR: [
        { embeddingUpdatedAt: null },
        { embeddingUpdatedAt: { lt: cutoff } },
      ],
    },
    select: { userId: true },
    take: 100,
  });

  let updated = 0;
  let skipped = 0;
  for (const p of profiles) {
    const ok = await embedProfile(p.userId);
    if (ok) updated++;
    else skipped++;
  }
  return { updated, skipped };
}

/**
 * Cosine similarity between two embedding vectors. Returns 0–1.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
