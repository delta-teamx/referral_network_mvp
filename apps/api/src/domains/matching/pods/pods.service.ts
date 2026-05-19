import { prisma } from '../../../config/prisma.js';
import { createZoomMeeting } from '../../integrations/zoom.service.js';
import { sendEmail } from '../../core/notifications/email.service.js';
import { eventBus } from '../../core/events/index.js';
import { env } from '../../../config/env.js';

const POD_SIZE = { min: 10, target: 18, max: 20 };

interface MemberProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  industry: string;
  icpIndustries: string[];
  canReferIndustries: string[];
  city: string | null;
  state: string | null;
  serviceArea: string;
}

/**
 * Core matchmaking: scan active members, form pods of 15-20 people with
 * complementary ICPs, create Zoom meetings, send invitations.
 */
export async function runDailyMatchmaking(): Promise<{ podsCreated: number; membersMatched: number }> {
  // eslint-disable-next-line no-console
  console.log('[matchmaking] starting daily pod formation...');

  // 1. Get all eligible members (verified, active, with profiles)
  const members = await getEligibleMembers();
  if (members.length < POD_SIZE.min) {
    // eslint-disable-next-line no-console
    console.log(`[matchmaking] only ${members.length} eligible members — need ${POD_SIZE.min}+, skipping`);
    return { podsCreated: 0, membersMatched: 0 };
  }

  // 2. Get meeting history to avoid repeat groupings
  const history = await getMeetingHistory();

  // 3. Form pods using ICP-based matching + rotation
  const pods = formPods(members, history);

  // 4. Create Zoom meetings + persist pods + send invitations
  let totalMatched = 0;
  for (const pod of pods) {
    const tomorrow9am = getNextMeetingTime();
    try {
      const zoom = await createZoomMeeting({
        topic: `NRG — AI-Matched Networking Pod`,
        startsAt: tomorrow9am,
        durationMin: 60,
      });

      const dbPod = await prisma.matchmakingPod.create({
        data: {
          scheduledAt: tomorrow9am,
          zoomMeetingId: zoom.meetingId,
          zoomJoinUrl: zoom.joinUrl,
          zoomStartUrl: zoom.startUrl,
          podSize: pod.length,
          matchCriteria: { industries: [...new Set(pod.map((m) => m.industry))] },
          members: {
            create: pod.map((m) => ({ userId: m.userId })),
          },
        },
      });

      // Record meeting history (every pair in the pod)
      const historyRecords: { userAId: string; userBId: string; podId: string }[] = [];
      for (let i = 0; i < pod.length; i++) {
        for (let j = i + 1; j < pod.length; j++) {
          const [a, b] = [pod[i]!.userId, pod[j]!.userId].sort();
          historyRecords.push({ userAId: a!, userBId: b!, podId: dbPod.id });
        }
      }
      // Batch insert, skip duplicates
      for (const rec of historyRecords) {
        await prisma.meetingHistory.upsert({
          where: { userAId_userBId: { userAId: rec.userAId, userBId: rec.userBId } },
          create: rec,
          update: { podId: rec.podId, metAt: new Date() },
        });
      }

      // Send invitations
      const origin = env.FRONTEND_URL.split(',')[0] ?? 'https://nrg-ai.com';
      for (const member of pod) {
        const otherMembers = pod
          .filter((m) => m.userId !== member.userId)
          .map((m) => `${m.firstName} ${m.lastName} (${m.industry})`)
          .slice(0, 5);

        void sendEmail({
          to: member.email,
          template: 'event_registered',
          data: {
            title: 'AI-Matched Networking Pod',
            whenLabel: tomorrow9am.toLocaleString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            }),
            zoomUrl: zoom.joinUrl,
            eventUrl: `${origin}/events`,
            podMembers: otherMembers.join(', ') + (pod.length > 6 ? ` and ${pod.length - 6} more` : ''),
            inviteUrl: `${origin}/signup?ref=${member.userId}`,
          },
        });
      }

      totalMatched += pod.length;

      await eventBus.publish('matchmaking.pod_created', {
        podId: dbPod.id,
        memberCount: pod.length,
        scheduledAt: tomorrow9am.toISOString(),
      });

      // eslint-disable-next-line no-console
      console.log(`[matchmaking] pod ${dbPod.id}: ${pod.length} members, zoom=${zoom.joinUrl}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[matchmaking] pod creation failed:', err);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[matchmaking] done: ${pods.length} pods, ${totalMatched} members matched`);
  return { podsCreated: pods.length, membersMatched: totalMatched };
}

// ---- Internal helpers -------------------------------------------------------

async function getEligibleMembers(): Promise<MemberProfile[]> {
  const profiles = await prisma.memberProfile.findMany({
    where: {
      user: {
        deletedAt: null,
        emailVerified: true,
      },
    },
    select: {
      userId: true,
      industry: true,
      icpIndustries: true,
      canReferIndustries: true,
      city: true,
      state: true,
      serviceArea: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return profiles.map((p) => ({
    userId: p.userId,
    email: p.user.email,
    firstName: p.user.firstName,
    lastName: p.user.lastName,
    industry: p.industry,
    icpIndustries: p.icpIndustries,
    canReferIndustries: p.canReferIndustries,
    city: p.city,
    state: p.state,
    serviceArea: p.serviceArea,
  }));
}

async function getMeetingHistory(): Promise<Set<string>> {
  const recent = await prisma.meetingHistory.findMany({
    where: {
      metAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // last 30 days
    },
    select: { userAId: true, userBId: true },
  });
  const pairs = new Set<string>();
  for (const r of recent) {
    pairs.add(`${r.userAId}:${r.userBId}`);
    pairs.add(`${r.userBId}:${r.userAId}`);
  }
  return pairs;
}

function haveMet(history: Set<string>, a: string, b: string): boolean {
  return history.has(`${a}:${b}`);
}

function icpOverlap(a: MemberProfile, b: MemberProfile): number {
  let score = 0;
  // A wants to meet people in B's industry
  if (a.icpIndustries.some((i) => i.toLowerCase() === b.industry.toLowerCase())) score += 3;
  // B wants to meet people in A's industry
  if (b.icpIndustries.some((i) => i.toLowerCase() === a.industry.toLowerCase())) score += 3;
  // A can refer to B's industry
  if (a.canReferIndustries.some((i) => i.toLowerCase() === b.industry.toLowerCase())) score += 2;
  // B can refer to A's industry
  if (b.canReferIndustries.some((i) => i.toLowerCase() === a.industry.toLowerCase())) score += 2;
  // Same geography boosts local members
  if (a.serviceArea === 'local' && b.serviceArea === 'local' && a.state === b.state) score += 1;
  // Remote/international always match geographically
  if (a.serviceArea !== 'local' || b.serviceArea !== 'local') score += 1;
  return score;
}

/**
 * Greedy pod formation: pick a seed member, then greedily add the
 * highest-scoring unassigned member who hasn't recently met anyone in
 * the pod. Repeat until pod is full or no more good matches.
 */
function formPods(members: MemberProfile[], history: Set<string>): MemberProfile[][] {
  const unassigned = new Set(members.map((m) => m.userId));
  const memberMap = new Map(members.map((m) => [m.userId, m]));
  const pods: MemberProfile[][] = [];

  while (unassigned.size >= POD_SIZE.min) {
    const pod: MemberProfile[] = [];

    // Pick seed: member with most unmet potential connections
    let bestSeed = '';
    let bestSeedScore = -1;
    for (const id of unassigned) {
      let score = 0;
      for (const otherId of unassigned) {
        if (otherId === id) continue;
        if (!haveMet(history, id, otherId)) {
          score += icpOverlap(memberMap.get(id)!, memberMap.get(otherId)!);
        }
      }
      if (score > bestSeedScore) {
        bestSeedScore = score;
        bestSeed = id;
      }
    }

    if (!bestSeed) break;
    pod.push(memberMap.get(bestSeed)!);
    unassigned.delete(bestSeed);

    // Greedily add members to the pod
    while (pod.length < POD_SIZE.target && unassigned.size > 0) {
      let bestCandidate = '';
      let bestScore = -1;

      for (const candidateId of unassigned) {
        const candidate = memberMap.get(candidateId)!;
        let score = 0;
        let metSomeone = false;

        for (const existing of pod) {
          if (haveMet(history, candidateId, existing.userId)) {
            metSomeone = true;
            break;
          }
          score += icpOverlap(candidate, existing);
        }

        // Prefer candidates who haven't met anyone in the pod
        if (metSomeone) continue;

        // Bonus: different industry from existing pod members (diversity)
        const podIndustries = new Set(pod.map((m) => m.industry.toLowerCase()));
        if (!podIndustries.has(candidate.industry.toLowerCase())) score += 2;

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidateId;
        }
      }

      if (!bestCandidate) break;
      pod.push(memberMap.get(bestCandidate)!);
      unassigned.delete(bestCandidate);
    }

    if (pod.length >= POD_SIZE.min) {
      pods.push(pod);
    } else {
      // Not enough for a pod, put them back
      for (const m of pod) unassigned.add(m.userId);
      break;
    }
  }

  return pods;
}

function getNextMeetingTime(): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // 9 AM
  return tomorrow;
}

// ---- Admin API: trigger manually or view pods ------------------------------

export async function listPods(opts?: { status?: string; limit?: number }) {
  return prisma.matchmakingPod.findMany({
    where: opts?.status ? { status: opts.status } : undefined,
    orderBy: { scheduledAt: 'desc' },
    take: opts?.limit ?? 20,
    include: {
      members: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      _count: { select: { feedback: true } },
    },
  });
}

export async function submitPodFeedback(
  podId: string,
  userId: string,
  rating: number,
  wouldMeetAgain: boolean,
  highlights?: string,
) {
  return prisma.podFeedback.upsert({
    where: { podId_userId: { podId, userId } },
    create: { podId, userId, rating: Math.min(5, Math.max(1, rating)), wouldMeetAgain, highlights },
    update: { rating: Math.min(5, Math.max(1, rating)), wouldMeetAgain, highlights },
  });
}
