import crypto from 'node:crypto';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';

/**
 * Listing photo uploads via S3 presigned URLs. Two modes:
 *
 *   - Real S3: when AWS_ACCESS_KEY_ID + AWS_S3_BUCKET are set, we lazy-load
 *     @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner and return a real
 *     presigned PUT URL the browser uploads to directly.
 *
 *   - Demo mode: no S3 creds → we return a data-URL-ish fake URL so the
 *     Netlify preview can demonstrate the upload flow end-to-end. The
 *     photo row is still created in the DB with a placeholder URL.
 *
 * After upload, the client calls `confirmPhoto` so we record the final URL.
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  /** When true, `uploadUrl` is a sentinel — client should just call
   *  `confirmPhoto` without actually PUTting anywhere. */
  demo: boolean;
}

function isS3Configured(): boolean {
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);
}

export async function presignPhotoUpload(
  userId: string,
  listingId: string,
  contentType: string,
  sizeBytes: number,
): Promise<PresignResult> {
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw AppError.badRequest('Unsupported image type. Use JPEG, PNG, WebP, or GIF.');
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw AppError.badRequest(`File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
  }

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!listing) throw AppError.notFound('Listing not found or not yours');

  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `listings/${listingId}/${crypto.randomUUID()}.${ext}`;

  if (!isS3Configured()) {
    // Demo: placeholder URL that always resolves (via unsplash or picsum).
    // Client can still display something real-looking for the preview.
    const placeholder = `https://picsum.photos/seed/${encodeURIComponent(key)}/1200/800`;
    return { uploadUrl: 'demo://skip-upload', publicUrl: placeholder, key, demo: true };
  }

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
  return { uploadUrl, publicUrl, key, demo: false };
}

export async function confirmPhoto(
  userId: string,
  listingId: string,
  input: { url: string; caption?: string; sortOrder?: number },
) {
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!listing) throw AppError.notFound('Listing not found or not yours');

  const nextSort =
    input.sortOrder ??
    (await prisma.listingPhoto.count({ where: { listingId } }));

  return prisma.listingPhoto.create({
    data: {
      listingId,
      url: input.url,
      caption: input.caption?.trim() || null,
      sortOrder: nextSort,
    },
  });
}

export async function deletePhoto(userId: string, photoId: string) {
  const photo = await prisma.listingPhoto.findFirst({
    where: { id: photoId, listing: { userId, deletedAt: null } },
    select: { id: true },
  });
  if (!photo) throw AppError.notFound('Photo not found');
  await prisma.listingPhoto.delete({ where: { id: photo.id } });
  return { ok: true };
}

export async function listPhotos(listingId: string) {
  return prisma.listingPhoto.findMany({
    where: { listingId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, url: true, caption: true, sortOrder: true },
  });
}
