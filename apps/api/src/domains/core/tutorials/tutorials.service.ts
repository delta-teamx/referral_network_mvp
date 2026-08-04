import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';

/**
 * Tutorial videos - YouTube tutorials shown on the marketing homepage, in the
 * member dashboard's Tutorials tab, and managed by admins (paste a link).
 *
 * One list feeds all three surfaces; each row's flags decide where it appears:
 *   - showOnHomepage  -> featured on the public site
 *   - showInTutorials -> listed in the dashboard Tutorials tab
 *   - isFeatured      -> the single hero / introductory video
 */

export interface TutorialVideoInput {
  youtubeUrl: string;
  title: string;
  description?: string | null;
  category?: string | null;
  showOnHomepage?: boolean;
  showInTutorials?: boolean;
  isFeatured?: boolean;
  sortOrder?: number;
}

const tutorialSelect = {
  id: true,
  youtubeId: true,
  title: true,
  description: true,
  category: true,
  showOnHomepage: true,
  showInTutorials: true,
  isFeatured: true,
  sortOrder: true,
  createdAt: true,
} as const;

/**
 * Extract the 11-character YouTube video id from any common link shape:
 *   youtu.be/ID · youtube.com/watch?v=ID · /embed/ID · /shorts/ID · /live/ID
 * plus any trailing ?si=/&t= junk. Throws on anything that isn't a valid id.
 */
export function parseYoutubeId(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) throw AppError.badRequest('Please paste a YouTube link.');

  // A bare 11-char id is accepted as-is.
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  let candidate = '';
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (url.searchParams.get('v')) {
        candidate = url.searchParams.get('v') ?? '';
      } else {
        // /embed/ID, /shorts/ID, /live/ID, /v/ID
        const parts = url.pathname.split('/').filter(Boolean);
        const marker = parts.findIndex((p) => ['embed', 'shorts', 'live', 'v'].includes(p));
        candidate = marker >= 0 ? (parts[marker + 1] ?? '') : (parts[0] ?? '');
      }
    }
  } catch {
    candidate = '';
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(candidate)) {
    throw AppError.badRequest('That doesn’t look like a valid YouTube link.');
  }
  return candidate;
}

// ---- Public / member reads --------------------------------------------------

/** The featured homepage video (isFeatured first, then order). null if none. */
export async function getFeaturedVideo() {
  return prisma.tutorialVideo.findFirst({
    where: { showOnHomepage: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: tutorialSelect,
  });
}

/** All videos for the dashboard Tutorials tab, ordered for display. */
export async function listTutorialVideos() {
  return prisma.tutorialVideo.findMany({
    where: { showInTutorials: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: tutorialSelect,
  });
}

// ---- Admin CRUD -------------------------------------------------------------

/** Every video, for the admin manager. */
export async function listAllTutorials() {
  return prisma.tutorialVideo.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { ...tutorialSelect, createdById: true, updatedAt: true },
  });
}

export async function createTutorial(input: TutorialVideoInput, adminId: string) {
  const youtubeId = parseYoutubeId(input.youtubeUrl);
  const title = (input.title ?? '').trim();
  if (!title) throw AppError.badRequest('A title is required.');

  return prisma.tutorialVideo.create({
    data: {
      youtubeId,
      title,
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      showOnHomepage: input.showOnHomepage ?? false,
      showInTutorials: input.showInTutorials ?? true,
      isFeatured: input.isFeatured ?? false,
      sortOrder: input.sortOrder ?? 0,
      createdById: adminId,
    },
    select: tutorialSelect,
  });
}

export async function updateTutorial(
  id: string,
  patch: Partial<TutorialVideoInput>,
) {
  const data: Record<string, unknown> = {};
  if (patch.youtubeUrl !== undefined) data.youtubeId = parseYoutubeId(patch.youtubeUrl);
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) throw AppError.badRequest('A title is required.');
    data.title = t;
  }
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.category !== undefined) data.category = patch.category?.trim() || null;
  if (patch.showOnHomepage !== undefined) data.showOnHomepage = patch.showOnHomepage;
  if (patch.showInTutorials !== undefined) data.showInTutorials = patch.showInTutorials;
  if (patch.isFeatured !== undefined) data.isFeatured = patch.isFeatured;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

  const existing = await prisma.tutorialVideo.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw AppError.notFound('Tutorial not found.');

  return prisma.tutorialVideo.update({ where: { id }, data, select: tutorialSelect });
}

export async function deleteTutorial(id: string) {
  await prisma.tutorialVideo.deleteMany({ where: { id } });
  return { ok: true };
}

/**
 * Seed the two launch videos on boot, idempotently (matched by youtubeId).
 * Editable/deletable from the admin manager afterward.
 */
export async function seedTutorials(): Promise<void> {
  const defaults: Array<{ youtubeId: string; data: Omit<TutorialVideoInput, 'youtubeUrl'> }> = [
    {
      youtubeId: '8s_hreJpDVs',
      data: {
        title: 'Welcome to Referral Nova',
        description: 'A quick tour of how Referral Nova helps you turn connections into referrals.',
        category: 'Getting Started',
        showOnHomepage: true,
        showInTutorials: true,
        isFeatured: true,
        sortOrder: 0,
      },
    },
    {
      youtubeId: 'cps2gfgtbFE',
      data: {
        title: 'Pipeline & Core Features',
        description: 'How to work your pipeline and get the most out of the core tools.',
        category: 'Pipeline',
        showOnHomepage: false,
        showInTutorials: true,
        isFeatured: false,
        sortOrder: 1,
      },
    },
  ];

  for (const v of defaults) {
    try {
      const exists = await prisma.tutorialVideo.findFirst({
        where: { youtubeId: v.youtubeId },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.tutorialVideo.create({
        data: {
          youtubeId: v.youtubeId,
          title: v.data.title,
          description: v.data.description ?? null,
          category: v.data.category ?? null,
          showOnHomepage: v.data.showOnHomepage ?? false,
          showInTutorials: v.data.showInTutorials ?? true,
          isFeatured: v.data.isFeatured ?? false,
          sortOrder: v.data.sortOrder ?? 0,
        },
      });
    } catch {
      // Non-fatal: a seed failure must never block boot.
    }
  }
}
