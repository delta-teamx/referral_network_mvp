'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Camera, CircleStop, Image as ImageIcon, RefreshCw, Upload, Video } from 'lucide-react';
import { api, ApiError } from '../../lib/api';

interface PresignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  demo: boolean;
}

interface Props {
  accessToken: string | undefined;
  photoUrl: string | null;
  videoUrl: string | null;
  onPhoto: (url: string) => void;
  onVideo: (url: string) => void;
}

const MAX_PHOTO_MB = 8;
const MAX_VIDEO_MB = 100;

async function uploadMedia(
  kind: 'photo' | 'video',
  file: Blob,
  contentType: string,
  key: string,
  accessToken: string | undefined,
): Promise<string> {
  const presign = await api.post<PresignResult>(
    `/api/v1/profiles/${kind}/presign`,
    { contentType, sizeBytes: file.size },
    { accessToken },
  );
  if (!presign.demo && presign.uploadUrl.startsWith('http')) {
    const put = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  }
  if (kind === 'photo') {
    await api.post('/api/v1/profiles/photo/confirm', { photoUrl: presign.publicUrl }, { accessToken });
  } else {
    await api.post(
      '/api/v1/profiles/video/confirm',
      { videoUrl: presign.publicUrl, videoKey: key || presign.key, demo: presign.demo },
      { accessToken },
    );
  }
  return presign.publicUrl;
}

export function ProfileMedia({ accessToken, photoUrl, videoUrl, onPhoto, onVideo }: Props) {
  const photoInput = useRef<HTMLInputElement | null>(null);
  const videoInput = useRef<HTMLInputElement | null>(null);
  const livePreview = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [photoBusy, setPhotoBusy] = useState(false);
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
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`Photo is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_PHOTO_MB} MB.`);
      return;
    }
    setError(null);
    setPhotoBusy(true);
    try {
      const url = await uploadMedia('photo', file, file.type, '', accessToken);
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
      setError(`Video is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_VIDEO_MB} MB.`);
      return;
    }
    const ct = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
      ? file.type
      : 'video/mp4';
    setError(null);
    setVideoBusy(true);
    try {
      const url = await uploadMedia('video', file, ct, '', accessToken);
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
          setError(`Recording is too large — keep it under ${MAX_VIDEO_MB} MB / ~60 seconds.`);
          return;
        }
        setVideoBusy(true);
        try {
          const url = await uploadMedia('video', blob, 'video/webm', '', accessToken);
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
        </div>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your headshot" className="h-full w-full object-cover" />
            ) : (
              <Camera size={22} className="text-gray-300" />
            )}
          </div>
          <div>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
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
                : 'Record yourself right now, or upload a video file. Members are 3× more likely to accept an intro when they can see your face.'}
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
