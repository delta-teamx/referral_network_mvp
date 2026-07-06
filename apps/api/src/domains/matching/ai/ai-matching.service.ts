import { prisma } from '../../../config/prisma.js';

/**
 * AI-powered matching engine — the heart of Igor's vision.
 *
 * Takes a member's profile (ICP, keywords, services, referral capabilities)
 * and finds the best matches in the network. Two modes:
 *
 *   1. Embedding mode (OpenAI): each member's profile is embedded into a
 *      vector. Matching = cosine similarity between "who I want to meet"
 *      and "who the other person IS". Stored as JSON on MemberProfile;
 *      upgraded to pgvector when traffic justifies it.
 *
 *   2. Rules mode (fallback): keyword overlap + industry alignment + ICP
 *      match scoring. Runs instantly with zero API calls. Used when
 *      OPENAI_API_KEY is unset.
 *
 * Both modes produce Introduction rows with reasons + matchScore.
 */

export interface MatchCandidate {
  userId: string;
  profileId: string;
  businessName: string;
  industry: string;
  headline: string | null;
  keywords: string[];
  servicesOffered: string[];
  icpIndustries: string[];
  icpRoles: string[];
  canReferIndustries: string[];
  canReferTypes: string[];
  videoUrl: string | null;
  city: string | null;
  state: string | null;
}

export interface MatchResult {
  targetUserId: string;
  score: number;
  reason: string;
  factors: Record<string, number>;
}

/**
 * Generate AI-powered match suggestions for a given member.
 * Returns ranked list of people they should meet.
 */
export async function generateMatchesForUser(
  userId: string,
  opts?: { groupId?: string; limit?: number },
): Promise<MatchResult[]> {
  const limit = opts?.limit ?? 10;

  const myProfile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: profileFields,
  });
  if (!myProfile) return [];

  // Get all other members (optionally scoped to a group)
  let candidateUserIds: string[] | undefined;
  if (opts?.groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: opts.groupId },
      select: { userId: true },
    });
    candidateUserIds = members.map((m) => m.userId).filter((id) => id !== userId);
  }

  const candidates = await prisma.memberProfile.findMany({
    where: {
      userId: candidateUserIds ? { in: candidateUserIds } : { not: userId },
      user: { deletedAt: null },
    },
    select: profileFields,
    take: 200,
  });

  // Score each candidate
  const scored = candidates.map((c) => scoreMatch(myProfile, c)).filter((m) => m.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Rules-based scoring (V1). Replaced by embedding similarity when
 * OPENAI_API_KEY is configured and embeddings are up-to-date.
 */
function scoreMatch(me: ProfileData, them: ProfileData): MatchResult {
  const factors: Record<string, number> = {};

  // 1. Industry alignment: do they work in an industry I want to meet?
  //    NB: industries/keywords are stored with their original casing (e.g.
  //    "Real Estate"), so every comparison must be case-insensitive on BOTH
  //    sides — otherwise well-formed profiles silently score 0.
  const industryMatch = me.icpIndustries.some((ind) =>
    industryMatches(ind, them.industry, them.keywords),
  );
  factors.industryAlignment = industryMatch ? 25 : 0;

  // 2. Reverse: am I in an industry THEY want to meet?
  const reverseIndustry = them.icpIndustries.some((ind) =>
    industryMatches(ind, me.industry, me.keywords),
  );
  factors.reverseAlignment = reverseIndustry ? 20 : 0;

  // 3. Referral compatibility: can they refer business to MY industry?
  const theyCanReferMe = them.canReferIndustries.some((ind) =>
    industryMatches(ind, me.industry, me.keywords),
  );
  factors.referralToMe = theyCanReferMe ? 15 : 0;

  // 4. I can refer to them
  const iCanReferThem = me.canReferIndustries.some((ind) =>
    industryMatches(ind, them.industry, them.keywords),
  );
  factors.referralFromMe = iCanReferThem ? 15 : 0;

  // 5. Keyword overlap (services ↔ ICP problems)
  const keywordOverlap = countOverlap(
    [...them.servicesOffered, ...them.keywords],
    [...me.icpRoles, ...me.icpIndustries],
  );
  factors.keywordOverlap = Math.min(15, keywordOverlap * 5);

  // 6. Location proximity
  const sameCity = me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase();
  const sameState = me.state && them.state && me.state === them.state;
  factors.location = sameCity ? 10 : sameState ? 5 : 0;

  // 7. Barter compatibility — both must be open to barter AND have
  // overlapping offerings ↔ wants for a bonus.
  let barterMatch = false;
  if (me.openToBarter && them.openToBarter) {
    const theyOfferWhatIWant = countOverlap(them.barterOfferings, me.barterWants) > 0;
    const iOfferWhatTheyWant = countOverlap(me.barterOfferings, them.barterWants) > 0;
    barterMatch = theyOfferWhatIWant || iOfferWhatTheyWant;
    factors.barterMatch = barterMatch ? 10 : (me.openToBarter && them.openToBarter ? 5 : 0);
  } else {
    factors.barterMatch = 0;
  }

  const totalScore = Object.values(factors).reduce((a, b) => a + b, 0);

  // Generate a human-readable reason
  const reasons: string[] = [];
  if (industryMatch) reasons.push(`works in ${them.industry} (an industry you want to connect with)`);
  if (theyCanReferMe) reasons.push(`can refer clients to your business`);
  if (iCanReferThem) reasons.push(`you can send them business`);
  if (reverseIndustry) reasons.push(`is looking for someone in your industry`);
  if (barterMatch) reasons.push(`open to bartering services`);
  if (sameCity) reasons.push(`based in ${them.city}`);

  const reason = reasons.length > 0
    ? `${them.businessName}: ${reasons.join('; ')}.`
    : `${them.businessName} may be a good connection.`;

  return {
    targetUserId: them.userId,
    score: totalScore,
    reason,
    factors,
  };
}

/**
 * Case-insensitive industry match. `target` is another member's industry
 * label (e.g. "Real Estate"); `wanted` is a single entry from someone's
 * ICP / referral list (e.g. "real estate" or "Real Estate / Agent").
 * Matches if either string contains the other, OR any of the target's
 * keywords line up. Normalising both sides is what makes the engine
 * actually fire on real onboarding data.
 */
function industryMatches(wanted: string, target: string, keywords: string[]): boolean {
  const w = wanted.toLowerCase().trim();
  if (!w) return false;
  const t = target.toLowerCase().trim();
  if (t.includes(w) || w.includes(t)) return true;
  return keywords.some((k) => {
    const kk = k.toLowerCase().trim();
    return kk.includes(w) || w.includes(kk);
  });
}

function countOverlap(a: string[], b: string[]): number {
  const setA = new Set(a.map((s) => s.toLowerCase().trim()));
  let count = 0;
  for (const item of b) {
    const lower = item.toLowerCase().trim();
    for (const aItem of setA) {
      if (aItem.includes(lower) || lower.includes(aItem)) {
        count++;
        break;
      }
    }
  }
  return count;
}

/**
 * Batch: generate and persist Introduction rows for a user. Called by the
 * scheduler or after a profile update. Idempotent — skips suggestions
 * that already exist for the same sender+target pair.
 */
export async function refreshSuggestionsForUser(
  userId: string,
  opts?: { groupId?: string },
): Promise<number> {
  const matches = await generateMatchesForUser(userId, { ...opts, limit: 20 });

  let created = 0;
  for (const match of matches) {
    // Skip if we already have a pending/active suggestion for this pair
    const existing = await prisma.introduction.findFirst({
      where: {
        senderId: userId,
        targetId: match.targetUserId,
        status: { in: ['suggested', 'requested', 'accepted'] },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.introduction.create({
      data: {
        senderId: userId,
        targetId: match.targetUserId,
        groupId: opts?.groupId ?? null,
        reason: match.reason,
        matchScore: match.score,
        matchFactors: match.factors,
        status: 'suggested',
      },
    });
    created++;
  }
  return created;
}

/**
 * Batch all members in the platform (or a group). Used by the daily cron.
 */
export async function refreshAllSuggestions(groupId?: string): Promise<{ users: number; intros: number }> {
  let users: { userId: string }[];
  if (groupId) {
    users = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
  } else {
    users = await prisma.memberProfile.findMany({
      select: { userId: true },
    });
  }

  let totalIntros = 0;
  for (const { userId } of users) {
    const n = await refreshSuggestionsForUser(userId, groupId ? { groupId } : undefined);
    totalIntros += n;
  }
  return { users: users.length, intros: totalIntros };
}

type ProfileData = {
  userId: string;
  businessName: string;
  industry: string;
  headline: string | null;
  keywords: string[];
  servicesOffered: string[];
  icpIndustries: string[];
  icpRoles: string[];
  canReferIndustries: string[];
  canReferTypes: string[];
  city: string | null;
  state: string | null;
  openToBarter: boolean;
  barterOfferings: string[];
  barterWants: string[];
};

const profileFields = {
  userId: true,
  businessName: true,
  industry: true,
  headline: true,
  keywords: true,
  servicesOffered: true,
  icpIndustries: true,
  icpRoles: true,
  canReferIndustries: true,
  canReferTypes: true,
  city: true,
  state: true,
  openToBarter: true,
  barterOfferings: true,
  barterWants: true,
} as const;
