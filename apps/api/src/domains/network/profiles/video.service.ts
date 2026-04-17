import crypto from 'node:crypto';
import { prisma } from '../../../config/prisma.js';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';

/**
 * Video intro upload for member profiles.
 *
 *   - Real mode (AWS creds set): presigned S3 PUT URL + Whisper transcription
 *     via OpenAI API after upload confirmation.
 *   - Demo mode: returns a placeholder video URL and a canned transcript so
 *     the UI flow is fully testable without AWS/OpenAI keys.
 *
 * The transcript is stored on MemberProfile.videoTranscript and is folded
 * into the AI embedding the next time the matching engine runs.
 */

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function isS3Configured(): boolean {
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);
}

export interface VideoPresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  demo: boolean;
}

export async function presignVideoUpload(
  userId: string,
  contentType: string,
  sizeBytes: number,
): Promise<VideoPresignResult> {
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    throw AppError.badRequest('Unsupported video format. Use MP4, WebM, or QuickTime.');
  }
  if (sizeBytes > MAX_VIDEO_BYTES) {
    throw AppError.badRequest(`Video too large. Max ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.`);
  }

  const profile = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) throw AppError.notFound('Complete your profile first before uploading video.');

  const ext = contentType === 'video/quicktime' ? 'mov' : contentType.split('/')[1] ?? 'mp4';
  const key = `videos/${userId}/${crypto.randomUUID()}.${ext}`;

  if (!isS3Configured()) {
    return {
      uploadUrl: 'demo://skip-upload',
      publicUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      key,
      demo: true,
    };
  }

  // @ts-expect-error — AWS SDK is optional.
  const s3Mod = await import('@aws-sdk/client-s3');
  // @ts-expect-error — ditto.
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
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 15 });
  const publicUrl = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadUrl, publicUrl, key, demo: false };
}

/**
 * After the client PUTs the video, this confirms the URL, stores metadata,
 * and kicks off Whisper transcription.
 */
export async function confirmVideoUpload(
  userId: string,
  input: { videoUrl: string; videoKey: string; durationSec?: number; demo?: boolean },
) {
  await prisma.memberProfile.update({
    where: { userId },
    data: {
      videoUrl: input.videoUrl,
      videoKey: input.videoKey,
      videoDurationSec: input.durationSec ?? null,
      videoProcessed: false,
      embeddingUpdatedAt: null,
    },
  });

  if (input.demo) {
    // Demo mode: set a canned transcript immediately.
    await prisma.memberProfile.update({
      where: { userId },
      data: {
        videoTranscript:
          'Hi, I\u2019m a local business owner. I specialize in serving the St. Louis metro area. ' +
          'I\u2019m looking to connect with other professionals who can refer clients my way, ' +
          'and I\u2019m happy to send business to anyone in my network who does great work.',
        videoProcessed: true,
      },
    });
    return { transcribed: true, demo: true };
  }

  // Real mode: transcribe asynchronously via OpenAI Whisper.
  void transcribeAsync(userId, input.videoUrl).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[video] transcription failed for ${userId}:`, err);
  });

  return { transcribed: false, demo: false };
}

async function transcribeAsync(userId: string, videoUrl: string): Promise<void> {
  // @ts-expect-error — openai SDK is optional.
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI();

  // Download the video to a buffer, then send to Whisper.
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], 'intro.mp4', { type: 'video/mp4' });

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'text',
  });

  await prisma.memberProfile.update({
    where: { userId },
    data: {
      videoTranscript: typeof transcription === 'string' ? transcription : String(transcription),
      videoProcessed: true,
      embeddingUpdatedAt: null,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[video] transcription complete for ${userId}: ${String(transcription).slice(0, 80)}…`);
}
