import { prisma } from '../../../config/prisma.js';
import { AppError } from '../../../utils/AppError.js';
import { env } from '../../../config/env.js';
import { sanitizeText } from '../../../utils/sanitize.js';
import { createNotification } from '../../core/notifications/notifications.service.js';
import { assertEngagementQuota } from '../../billing/billing.tiers.js';
import { emitNewMessage, emitRead } from './messaging.realtime.js';

/**
 * In-app messaging between two users.
 *
 * Every conversation is 1-to-1 (two participants). Group chat is out of
 * scope for the MVP. The service enforces participant membership on every
 * read/write so users can never see other people's conversations.
 */

// ---------------------------------------------------------------------------
// ROUL Support system account + official (Priority Support) conversations
// ---------------------------------------------------------------------------

/** The system account that admins speak through in the member's Messages tab. */
export const ROUL_EMAIL = 'roul-support@referralnova.com';
let roulUserIdCache: string | null = null;

/** Get (or lazily create) the ROUL Support system user. Cached per process. */
export async function getRoulUserId(): Promise<string> {
  if (roulUserIdCache) return roulUserIdCache;
  const existing = await prisma.user.findFirst({ where: { email: ROUL_EMAIL }, select: { id: true } });
  if (existing) {
    roulUserIdCache = existing.id;
    return existing.id;
  }
  const created = await prisma.user.create({
    data: {
      email: ROUL_EMAIL,
      passwordHash: null,
      firstName: 'ROUL',
      lastName: 'Support',
      role: 'ADMIN', // keeps ROUL out of the member directory, leaderboard and matches
      emailVerified: true,
    },
    select: { id: true },
  });
  roulUserIdCache = created.id;
  return created.id;
}

/**
 * Open (or reuse) the official ROUL Support thread with a member and post an
 * admin message into it. This lands in the member's Messages tab, pinned and
 * badged, and is visible on every plan. Two-way: the member replies in the same
 * thread and the team is notified.
 */
export async function startOfficialConversationFromRoul(
  memberUserId: string,
  text: string,
): Promise<{ conversationId: string }> {
  const roulId = await getRoulUserId();
  if (roulId === memberUserId) throw AppError.badRequest('Cannot message the support account.');
  const convo = await getOrCreateConversation(roulId, memberUserId, { skipQuota: true });
  await prisma.conversation.update({ where: { id: convo.id }, data: { isOfficial: true } });
  await sendMessage(convo.id, roulId, text);
  return { conversationId: convo.id };
}

/** Admin console: every official ROUL Support thread, newest activity first. */
export async function listOfficialConversations() {
  const roulId = await getRoulUserId();
  const convos = await prisma.conversation.findMany({
    where: { isOfficial: true, participants: { some: { userId: roulId } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      updatedAt: true,
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { senderId: true, text: true, createdAt: true },
      },
    },
  });
  return convos.map((c) => {
    const member = c.participants.find((p) => p.userId !== roulId);
    const roulPart = c.participants.find((p) => p.userId === roulId);
    const last = c.messages[0] ?? null;
    // Needs-reply = the member spoke last, after the team last read the thread.
    const unread = Boolean(
      last &&
        last.senderId !== roulId &&
        (!roulPart?.lastReadAt || last.createdAt > roulPart.lastReadAt),
    );
    return {
      id: c.id,
      updatedAt: c.updatedAt,
      member: member
        ? {
            id: member.user.id,
            name: `${member.user.firstName} ${member.user.lastName}`.trim() || member.user.email,
            email: member.user.email,
          }
        : null,
      lastMessage: last,
      unread,
    };
  });
}

/** Admin console: one official thread's full transcript (marks it read for the team). */
export async function getOfficialThread(conversationId: string) {
  const roulId = await getRoulUserId();
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      isOfficial: true,
      participants: {
        select: { userId: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });
  if (!convo || !convo.isOfficial) throw AppError.notFound('Thread not found');
  const member = convo.participants.find((p) => p.userId !== roulId);
  const messages = (
    await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, senderId: true, text: true, createdAt: true },
    })
  ).reverse();
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: roulId },
    data: { lastReadAt: new Date() },
  });
  return {
    id: convo.id,
    member: member
      ? {
          id: member.user.id,
          name: `${member.user.firstName} ${member.user.lastName}`.trim() || member.user.email,
          email: member.user.email,
        }
      : null,
    messages: messages.map((m) => ({ ...m, fromRoul: m.senderId === roulId })),
  };
}

/** Admin console: reply into an official thread, speaking as ROUL Support. */
export async function adminReplyAsRoul(conversationId: string, text: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isOfficial: true },
  });
  if (!convo || !convo.isOfficial) throw AppError.notFound('Thread not found');
  const roulId = await getRoulUserId();
  await sendMessage(conversationId, roulId, text);
  return getOfficialThread(conversationId);
}

// ---------------------------------------------------------------------------
// getOrCreateConversation
// ---------------------------------------------------------------------------

export async function getOrCreateConversation(
  userIdA: string,
  userIdB: string,
  opts?: { skipQuota?: boolean },
) {
  if (userIdA === userIdB) {
    throw AppError.badRequest("You can't message yourself.");
  }

  // The route only validates that userIdB is a UUID - confirm the target user
  // actually exists (and isn't soft-deleted) before creating participant rows,
  // otherwise the FK insert throws a raw 500 instead of a clean 404.
  const target = await prisma.user.findFirst({
    where: { id: userIdB, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw AppError.notFound('That member no longer exists.');

  // Look for an existing 1-on-1 conversation between the two users.
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: { id: true },
  });

  if (existing) return existing;

  // Free plan: capped at 3 conversations. Existing threads still open; starting
  // a NEW one past the cap requires upgrading. The initiator (userIdA, the
  // authenticated caller) is the one whose quota applies. Internal callers
  // (e.g. auto-opening a thread when an intro is accepted) pass skipQuota.
  if (!opts?.skipQuota) {
    await assertEngagementQuota(userIdA, 'conversation');
  }

  // Create a new conversation with both participants.
  const conversation = await prisma.conversation.create({
    data: {
      participants: {
        createMany: {
          data: [{ userId: userIdA }, { userId: userIdB }],
        },
      },
    },
    select: { id: true },
  });

  return conversation;
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
) {
  // Ensure sender is a participant.
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: senderId },
    select: { id: true },
  });
  if (!participant) {
    throw AppError.forbidden('You are not a participant of this conversation.');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      text: sanitizeText(text),
    },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      text: true,
      createdAt: true,
    },
  });

  // Touch the conversation updatedAt so list ordering stays fresh.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Push the message to every participant's room in real time (sender's other
  // tabs included - the client dedupes by id). This is what makes the thread
  // update instantly instead of on the old 15s poll.
  void prisma.conversationParticipant
    .findMany({ where: { conversationId }, select: { userId: true } })
    .then((parts) => {
      emitNewMessage(
        parts.map((p) => p.userId),
        { conversationId, message },
      );
    })
    .catch(() => undefined);

  // Alert the recipient in the notification bell (best-effort).
  void (async () => {
    const [other, sender, convo, roulId] = await Promise.all([
      prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: senderId } },
        select: { user: { select: { id: true, email: true, firstName: true } } },
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      }),
      prisma.conversation.findUnique({ where: { id: conversationId }, select: { isOfficial: true } }),
      getRoulUserId(),
    ]);
    const isOfficial = Boolean(convo?.isOfficial);
    const fromRoul = senderId === roulId;
    const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'a member';
    if (other) {
      await createNotification({
        userId: other.user.id,
        type: 'message',
        title:
          isOfficial && fromRoul ? 'New message from ROUL Support' : `New message from ${senderName}`,
        body: message.text.slice(0, 120),
        data: { conversationId },
      });

      // No immediate per-message email here anymore: the recipient gets the
      // message live over the socket if they're online, and the 10-minute
      // offline-only digest (digest.service.ts) batches it into a single email
      // if they're not - which replaces the old one-email-per-message throttle
      // that flooded inboxes. Official ROUL threads still send their own email
      // through the support flow.
    }
    // A member reply on an official ROUL thread pings the human team so the
    // loop closes - "they reply, we get back to them".
    if (isOfficial && !fromRoul) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN', deletedAt: null, NOT: { email: ROUL_EMAIL } },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) =>
          createNotification({
            userId: a.id,
            type: 'roul_reply',
            title: `Priority reply from ${sender ? `${sender.firstName} ${sender.lastName}` : 'a member'}`,
            body: message.text.slice(0, 120),
            data: { roulConversationId: conversationId },
          }).catch(() => undefined),
        ),
      );
    }
  })().catch(() => undefined);

  return message;
}

// ---------------------------------------------------------------------------
// listConversations
// ---------------------------------------------------------------------------

export async function listConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      updatedAt: true,
      isOfficial: true,
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          senderId: true,
          text: true,
          createdAt: true,
        },
      },
    },
  });

  const mapped = conversations.map((c) => {
    const otherParticipant = c.participants.find((p) => p.userId !== userId);
    const myParticipant = c.participants.find((p) => p.userId === userId);
    const lastMessage = c.messages[0] ?? null;

    return {
      id: c.id,
      updatedAt: c.updatedAt,
      // Official = a ROUL Support (admin) thread. The member always sees these
      // (any plan), badged and pinned to the top of the inbox.
      isOfficial: c.isOfficial,
      otherUser: otherParticipant
        ? {
            id: otherParticipant.user.id,
            firstName: otherParticipant.user.firstName,
            lastName: otherParticipant.user.lastName,
            avatarUrl: otherParticipant.user.avatarUrl,
          }
        : null,
      lastMessage,
      unread:
        lastMessage && myParticipant
          ? !myParticipant.lastReadAt ||
            lastMessage.createdAt > myParticipant.lastReadAt
          : false,
      // When the OTHER person last read this thread - lets the UI show a
      // "Read" receipt on messages I sent before that time.
      otherLastReadAt: otherParticipant?.lastReadAt ?? null,
    };
  });
  // Official ROUL Support threads pinned above everything, then by recency.
  return mapped.sort((a, b) => {
    if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

// ---------------------------------------------------------------------------
// Chat attachments (documents / contracts / images) via S3 presigned upload
// ---------------------------------------------------------------------------

const ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15MB

// The bucket's true region - resolved automatically on the first
// PermanentRedirect (bucket created in a different region than AWS_REGION).
let resolvedS3Region: string | null = null;

async function makeS3(region: string) {
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    region,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
}

/** Pull the bucket's actual region out of a PermanentRedirect error. */
function regionFromRedirect(err: unknown): string | null {
  const e = err as {
    $response?: { headers?: Record<string, string> };
    Endpoint?: string;
    message?: string;
  };
  const header = e.$response?.headers?.['x-amz-bucket-region'];
  if (header) return header;
  const source = `${e.Endpoint ?? ''} ${e.message ?? ''}`;
  const m = /\.s3[.-]([a-z0-9-]+)\.amazonaws\.com/.exec(source);
  return m?.[1] ?? null;
}

export async function presignChatAttachment(
  conversationId: string,
  userId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  });
  if (!participant) throw AppError.forbidden('You are not a participant of this conversation.');
  if (!ATTACHMENT_TYPES.has(contentType)) {
    throw AppError.badRequest('Unsupported file type. Use PDF, Word, Excel, image or text.');
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw AppError.badRequest('File too large. Max 15MB.');
  }
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) {
    throw AppError.badRequest('File uploads are not configured yet.');
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const key = `chat/${conversationId}/${crypto.randomUUID()}-${safeName}`;

  const s3Mod = await import('@aws-sdk/client-s3');
  const presignerMod = await import('@aws-sdk/s3-request-presigner');
  const { S3Client, PutObjectCommand } = s3Mod;
  const { getSignedUrl } = presignerMod;

  const s3 = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
  const cmd = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 });
  const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  return { uploadUrl, publicUrl };
}

/**
 * Server-side attachment upload: the browser sends the file to OUR API (same
 * trusted origin policy as every other call) and the server puts it in S3 -
 * no bucket CORS or public-access configuration required.
 */
export async function uploadChatAttachment(
  conversationId: string,
  userId: string,
  filename: string,
  contentType: string,
  data: Buffer,
): Promise<{ key: string }> {
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId },
    select: { id: true },
  });
  if (!participant) throw AppError.forbidden('You are not a participant of this conversation.');
  if (!ATTACHMENT_TYPES.has(contentType)) {
    throw AppError.badRequest('Unsupported file type. Use PDF, Word, Excel, image or text.');
  }
  if (data.length > MAX_ATTACHMENT_BYTES) {
    throw AppError.badRequest('File too large. Max 15MB.');
  }
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) {
    throw AppError.badRequest('File uploads are not configured yet.');
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const key = `chat/${conversationId}/${crypto.randomUUID()}-${safeName}`;
  await putObjectWithRegionHeal(key, contentType, data);
  return { key };
}

/**
 * Reusable server-side S3 upload with the region self-heal - the exact path
 * chat attachments use. Support-chat attachments (and anything else) go
 * through here so upload behavior is identical everywhere.
 */
export async function uploadAttachmentObject(
  keyPrefix: 'chat' | 'support',
  scopeId: string,
  filename: string,
  contentType: string,
  data: Buffer,
): Promise<{ key: string }> {
  if (!ATTACHMENT_TYPES.has(contentType)) {
    throw AppError.badRequest('Unsupported file type. Use PDF, Word, Excel, image or text.');
  }
  if (data.length > MAX_ATTACHMENT_BYTES) {
    throw AppError.badRequest('File too large. Max 15MB.');
  }
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) {
    throw AppError.badRequest('File uploads are not configured yet.');
  }
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const key = `${keyPrefix}/${scopeId}/${crypto.randomUUID()}-${safeName}`;
  await putObjectWithRegionHeal(key, contentType, data);
  return { key };
}

/**
 * Server-side S3 put for profile media (headshots, intro videos) - the same
 * region-healed path chat attachments use. Exported so profile uploads never
 * depend on browser-to-S3 PUTs (which broke on bucket CORS + region
 * mismatches for real users).
 */
export async function putMediaObject(
  key: string,
  contentType: string,
  data: Buffer,
): Promise<void> {
  return putObjectWithRegionHeal(key, contentType, data);
}

async function putObjectWithRegionHeal(
  key: string,
  contentType: string,
  data: Buffer,
): Promise<void> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const put = () =>
    new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET,
      Key: key,
      ContentType: contentType,
      Body: data,
    });

  try {
    const s3 = await makeS3(resolvedS3Region ?? env.AWS_REGION);
    await s3.send(put());
  } catch (err) {
    const name = (err as { name?: string })?.name ?? 'UnknownError';
    // Bucket lives in a different region than AWS_REGION: S3 tells us which -
    // resolve it once and retry, so region mismatches self-heal.
    if (name === 'PermanentRedirect' || name === 'AuthorizationHeaderMalformed') {
      const region = regionFromRedirect(err);
      if (region) {
        resolvedS3Region = region;
        // eslint-disable-next-line no-console
        console.log(`[chat-upload] bucket region resolved to ${region}; retrying`);
        const s3 = await makeS3(region);
        await s3.send(put());
        return;
      }
    }
    // eslint-disable-next-line no-console
    console.error('[chat-upload] S3 rejected the upload:', err);
    throw AppError.badRequest(
      `Storage rejected the upload: ${name}. Check the S3 bucket "${env.AWS_S3_BUCKET}" exists and the AWS key has s3:PutObject permission.`,
    );
  }
}

/** Stream an attachment back through the API (keys are unguessable UUIDs). */
/**
 * Best-effort S3 cleanup for admin hard-deletes: when conversations or
 * support tickets are wiped from the database, their uploaded files are
 * removed from the bucket too - clean records AND clean storage. Never
 * throws; a storage hiccup must not block the database deletion.
 */
export async function deleteAttachmentPrefixes(prefixes: string[]): Promise<void> {
  if (prefixes.length === 0) return;
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) return;
  try {
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');
    const s3 = await makeS3(resolvedS3Region ?? env.AWS_REGION);
    for (const prefix of prefixes) {
      // Only ever purge inside the attachment/media namespaces.
      if (
        !(
          prefix.startsWith('chat/') ||
          prefix.startsWith('support/') ||
          prefix.startsWith('headshots/') ||
          prefix.startsWith('videos/')
        )
      )
        continue;
      const listed = await s3.send(
        new ListObjectsV2Command({ Bucket: env.AWS_S3_BUCKET, Prefix: prefix, MaxKeys: 500 }),
      );
      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));
      if (keys.length === 0) continue;
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.AWS_S3_BUCKET,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[attachments] S3 cleanup failed (records already deleted):', String(err));
  }
}

/**
 * Presigned S3 GET URL for an attachment/media key. The media proxy route
 * 302-redirects here instead of streaming bytes through the API - so image and
 * video traffic is served directly by S3 (fast, CDN-cacheable, and with native
 * HTTP Range support so videos seek/stream instead of re-downloading). Region
 * self-heals once so a wrong AWS_REGION doesn't break the signed endpoint.
 */
export async function getAttachmentDownloadUrl(key: string): Promise<string> {
  if (
    !(
      key.startsWith('chat/') ||
      key.startsWith('support/') ||
      key.startsWith('headshots/') ||
      key.startsWith('videos/')
    ) ||
    key.includes('..')
  ) {
    throw AppError.badRequest('Invalid attachment key');
  }
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) {
    throw AppError.notFound('File storage not configured');
  }
  const { GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

  if (!resolvedS3Region) {
    try {
      const s3 = await makeS3(env.AWS_REGION);
      await s3.send(new HeadObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
      resolvedS3Region = env.AWS_REGION;
    } catch (err) {
      const name = (err as { name?: string })?.name ?? '';
      const region =
        name === 'PermanentRedirect' || name === 'AuthorizationHeaderMalformed'
          ? regionFromRedirect(err)
          : null;
      if (region) resolvedS3Region = region;
      // A 404/403 here is fine - we still issue the presign (S3 answers the GET).
    }
  }
  const s3 = await makeS3(resolvedS3Region ?? env.AWS_REGION);
  const cmd = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ResponseCacheControl: 'public, max-age=86400',
  });
  // Valid for 2h; the route caches the redirect for only 1h so a cached
  // redirect never points at an already-expired URL.
  return getSignedUrl(s3, cmd, { expiresIn: 7200 });
}

export async function getChatAttachmentStream(key: string): Promise<{
  body: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
}> {
  if (
    !(
      key.startsWith('chat/') ||
      key.startsWith('support/') ||
      key.startsWith('headshots/') ||
      key.startsWith('videos/')
    ) ||
    key.includes('..')
  ) {
    throw AppError.badRequest('Invalid attachment key');
  }
  if (!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET)) {
    throw AppError.notFound('File storage not configured');
  }
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const get = () => new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key });

  let out;
  try {
    const s3 = await makeS3(resolvedS3Region ?? env.AWS_REGION);
    out = await s3.send(get());
  } catch (err) {
    const name = (err as { name?: string })?.name ?? '';
    const region =
      name === 'PermanentRedirect' || name === 'AuthorizationHeaderMalformed'
        ? regionFromRedirect(err)
        : null;
    if (!region) throw AppError.notFound('Attachment not found');
    resolvedS3Region = region;
    const s3 = await makeS3(region);
    out = await s3.send(get());
  }
  return {
    body: out.Body as unknown as NodeJS.ReadableStream,
    contentType: out.ContentType ?? 'application/octet-stream',
    contentLength: out.ContentLength,
  };
}

/** Mark a conversation read for the given user (sets lastReadAt = now). */
export async function markConversationRead(conversationId: string, userId: string) {
  const readAt = new Date();
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: readAt },
  });
  // Clear the bell notifications for THIS conversation so the offline digest
  // never emails about messages the user has already opened in-app.
  await prisma.notification.updateMany({
    where: {
      userId,
      type: 'message',
      isRead: false,
      data: { path: ['conversationId'], equals: conversationId },
    },
    data: { isRead: true },
  });
  // Tell the other participant their messages have been read, so their sent
  // bubbles can flip to the "Read" tick live.
  void prisma.conversationParticipant
    .findFirst({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    })
    .then((other) => {
      if (other) {
        emitRead(other.userId, { conversationId, readerId: userId, readAt: readAt.toISOString() });
      }
    })
    .catch(() => undefined);
  return { ok: true, readAt: readAt.toISOString() };
}

// ---------------------------------------------------------------------------
// listMessages
// ---------------------------------------------------------------------------

export async function listMessages(
  conversationId: string,
  userId: string,
  limit = 50,
  before?: string,
  beforeId?: string,
) {
  // Ensure user is a participant (and grab both read timestamps in one query).
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true, lastReadAt: true },
  });
  const mine = participants.find((p) => p.userId === userId);
  if (!mine) {
    throw AppError.forbidden('You are not a participant of this conversation.');
  }
  const other = participants.find((p) => p.userId !== userId);

  // Cursor pagination for infinite scroll: `before`/`beforeId` identify the
  // OLDEST message currently shown; we return the page just older than it.
  // Two messages can share a millisecond `createdAt`, so a bare `createdAt < t`
  // cursor would silently skip whichever equal-timestamp rows straddle the page
  // boundary. We therefore order by (createdAt, id) and page on the full tuple:
  // createdAt < t, OR (createdAt == t AND id < beforeId). Without it we return
  // the newest page. limit+1 probes whether more history exists.
  const cursorFilter =
    before && beforeId
      ? {
          OR: [
            { createdAt: { lt: new Date(before) } },
            { createdAt: new Date(before), id: { lt: beforeId } },
          ],
        }
      : before
        ? { createdAt: { lt: new Date(before) } }
        : {};
  const rows = await prisma.message.findMany({
    where: { conversationId, ...cursorFilter },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      senderId: true,
      text: true,
      createdAt: true,
    },
  });
  const hasMore = rows.length > limit;
  // Drop the probe row, then flip to chronological order for display.
  const messages = rows.slice(0, limit).reverse();

  // Only the initial (newest) load marks the thread read - loading OLDER
  // history on scroll-up must not touch read state.
  if (!before) {
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  return {
    messages,
    hasMore,
    otherLastReadAt: other?.lastReadAt ?? null,
  };
}
