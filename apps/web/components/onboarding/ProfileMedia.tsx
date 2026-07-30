'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Camera, Check, CircleStop, Image as ImageIcon, RefreshCw, TrendingUp, Upload, Video } from 'lucide-react';
import { ApiError, apiBaseUrl } from '../../lib/api';
import { compressImageToJpeg } from '../../lib/image';

interface Props {
  accessToken: string | undefined;
  photoUrl: string | null;
  videoUrl: string | null;
  onPhoto: (url: string) => void;
  onVideo: (url: string) => void;
}

const MAX_PHOTO_MB = 8;
const MAX_VIDEO_MB = 100;

/**
 * Upload through OUR API (server puts the file in storage). The old direct
 * browser-to-S3 flow failed for real users on storage CORS and region
 * config - this path has none of those dependencies.
 */
async function uploadMedia(
  kind: 'photo' | 'video',
  file: Blob,
  contentType: string,
  accessToken: string | undefined,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/profiles/${kind}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: file,
      credentials: 'include',
    });
  } catch {
    throw new Error('Network problem during the upload. Check your connection and try again.');
  }
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: { photoUrl?: string; videoUrl?: string }; error?: string }
    | null;
  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? `Upload failed (${res.status}). Please try again.`);
  }
  const url = kind === 'photo' ? json.data?.photoUrl : json.data?.videoUrl;
  if (!url) throw new Error('Upload finished but no file URL came back. Please try again.');
  return url;
}

export function ProfileMedia({ accessToken, photoUrl, videoUrl, onPhoto, onVideo }: Props) {
  const photoInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const livePreview = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSupported, setRecordSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRecordSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof window !== 'undefined' &&
        'MediaRecorder' in window,
    );
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Sanity cap on the ORIGINAL (before compression) so we don't try to decode
    // an enormous file; compression shrinks it well under the API limit.
    if (file.size > 40 * 1024 * 1024) {
      setError(`Photo is ${(file.size / 1024 / 1024).toFixed(1)} MB - please pick one under 40 MB.`);
      return;
    }
    setError(null);
    setPhotoLoadError(false);
    setPhotoBusy(true);
    try {
      // Compress/convert to a small JPEG first - fixes HEIC (iPhone) and large
      // photos that were silently failing, and makes the upload fast.
      const { blob, contentType } = await compressImageToJpeg(file);
      // If the browser couldn't decode it to a JPEG (e.g. desktop + HEIC), the
      // helper returns the original type - tell the member clearly instead of
      // sending something the server will reject.
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
        setError("That image format isn't supported here. Please use a JPG or PNG photo.");
        return;
      }
      const url = await uploadMedia('photo', blob, contentType, accessToken);
      onPhoto(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setPhotoBusy(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  }

  async function onVideoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`Video is ${(file.size / 1024 / 1024).toFixed(1)} MB - max ${MAX_VIDEO_MB} MB.`);
      return;
    }
    const ct = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
      ? file.type
      : 'video/mp4';
    setError(null);
    setVideoBusy(true);
    try {
      const url = await uploadMedia('video', file, ct, accessToken);
      onVideo(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setVideoBusy(false);
      if (videoInput.current) videoInput.current.value = '';
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (livePreview.current) {
        livePreview.current.srcObject = stream;
        livePreview.current.muted = true;
        await livePreview.current.play().catch(() => undefined);
      }
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (livePreview.current) livePreview.current.srcObject = null;
        if (blob.size > MAX_VIDEO_MB * 1024 * 1024) {
          setError(`Recording is too large - keep it under ${MAX_VIDEO_MB} MB / ~60 seconds.`);
          return;
        }
        setVideoBusy(true);
        try {
          const url = await uploadMedia('video', blob, 'video/webm', accessToken);
          onVideo(url);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : (err as Error).message);
        } finally {
          setVideoBusy(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setRecordSupported(false);
      setError('Could not access your camera. You can upload a video file instead.');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      {/* Headshot */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ImageIcon size={16} className="text-primary" /> Profile photo
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
            Required
          </span>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Members connect with faces they can see. A real photo of you is required to join the network.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {photoUrl && !photoLoadError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Your headshot"
                className="h-full w-full object-cover"
                // If the PREVIEW can't render (e.g. a transient CDN/redirect
                // hiccup), do NOT wipe the uploaded photo - keep it so the
                // member isn't blocked. Just show a "saved" state instead.
                onError={() => setPhotoLoadError(true)}
              />
            ) : photoUrl ? (
              <Check size={22} className="text-success" />
            ) : (
              <Camera size={22} className="text-gray-300" />
            )}
          </div>
          <div>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPhotoChange}
            />
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={photoBusy}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-primary disabled:opacity-60"
            >
              <Upload size={14} /> {photoBusy ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
            </button>
            <p className="mt-1 text-xs text-gray-500">JPEG, PNG or WebP · up to {MAX_PHOTO_MB} MB</p>
          </div>
        </div>
      </div>

      {/* Video */}
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Video size={16} className="text-primary" /> 60-second intro video
        </div>

        {!videoUrl && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-3 text-white shadow-sm">
            <TrendingUp size={18} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm font-semibold">
              Recording a quick intro video maximizes your chances of receiving leads and
              introductions. Members send far more referrals to people they have seen and heard.
            </p>
          </div>
        )}

        {videoUrl && !recording ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={videoUrl} controls className="w-full rounded-xl border border-gray-200 bg-black" />
            <button
              type="button"
              onClick={() => onVideo('')}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary"
            >
              <RefreshCw size={12} /> Replace video
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-6 text-center">
            {recording && (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video ref={livePreview} className="mx-auto mb-3 max-h-56 w-full rounded-xl bg-black" />
            )}
            {!recording && !videoBusy && (
              <Video size={36} className="mx-auto mb-2 text-gray-300" />
            )}
            <p className="mb-3 text-sm text-gray-600">
              {videoBusy
                ? 'Uploading your video…'
                : 'Record yourself right now, or upload a video file. Members are 3x more likely to accept an intro when they can see your face.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {recordSupported &&
                (recording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2 text-sm font-semibold text-white"
                  >
                    <CircleStop size={16} /> Stop &amp; save
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={videoBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                  >
                    <Camera size={16} /> Record now
                  </button>
                ))}
              {!recording && (
                <>
                  <input
                    ref={videoInput}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={onVideoChange}
                  />
                  <button
                    type="button"
                    onClick={() => videoInput.current?.click()}
                    disabled={videoBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:border-primary disabled:opacity-60"
                  >
                    <Upload size={14} /> Upload file
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
