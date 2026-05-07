'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Circle, Square, RotateCcw, Check, Upload } from 'lucide-react';
import { Button } from './Button';

interface Props {
  maxDurationSec?: number;
  onRecorded: (blob: Blob) => void;
  uploading?: boolean;
}

export function VideoRecorder({ maxDurationSec = 60, onRecorded, uploading }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<'idle' | 'preview' | 'recording' | 'recorded'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setStream(mediaStream);
      setState('preview');
    } catch {
      setError('Camera access denied. Please allow camera and microphone in your browser settings.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    setSeconds(0);

    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setState('recorded');
      stopCamera();
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.muted = false;
        void videoRef.current.play();
      }
    };
    mediaRecorderRef.current = mr;
    mr.start(1000);
    setState('recording');

    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= maxDurationSec) {
          mr.stop();
          if (timerRef.current) clearInterval(timerRef.current);
          return maxDurationSec;
        }
        return s + 1;
      });
    }, 1000);
  }, [stream, maxDurationSec, stopCamera]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const retake = useCallback(() => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setSeconds(0);
    setState('idle');
  }, []);

  // Connect stream to video element after render
  useEffect(() => {
    if (stream && videoRef.current && state !== 'recorded') {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      void videoRef.current.play().catch(() => {});
    }
  }, [stream, state]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stream]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-900">
        {state === 'idle' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Camera size={48} className="mb-3 text-gray-500" />
            <p className="mb-4 text-sm text-gray-400">Record a 60-second intro video</p>
            <Button onClick={() => void startCamera()}>
              <Camera size={14} /> Open camera
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="aspect-video w-full bg-black object-cover"
              playsInline
              autoPlay
              muted={state !== 'recorded'}
              loop={state === 'recorded'}
            />
            {state === 'recording' && (
              <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {formatTime(seconds)} / {formatTime(maxDurationSec)}
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex items-center justify-center gap-3">
        {state === 'preview' && (
          <button
            onClick={startRecording}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
            aria-label="Start recording"
          >
            <Circle size={24} className="fill-white" />
          </button>
        )}
        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
            aria-label="Stop recording"
          >
            <Square size={20} className="fill-white" />
          </button>
        )}
        {state === 'recorded' && (
          <>
            <button
              onClick={retake}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw size={14} /> Retake
            </button>
            <Button
              onClick={() => recordedBlob && onRecorded(recordedBlob)}
              loading={uploading}
            >
              <Upload size={14} /> Use this video
            </Button>
          </>
        )}
      </div>

      {state === 'recorded' && recordedBlob && (
        <p className="text-center text-xs text-gray-500">
          {formatTime(seconds)} · {(recordedBlob.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}
    </div>
  );
}
