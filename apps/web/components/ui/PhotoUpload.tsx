'use client';

import { useRef, useState } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';

interface Props {
  label: string;
  hint?: string;
  currentUrl?: string | null;
  onSelected: (file: File) => void;
  onRemove?: () => void;
  uploading?: boolean;
  maxSizeMb?: number;
}

export function PhotoUpload({ label, hint, currentUrl, onSelected, onRemove, uploading, maxSizeMb = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max ${maxSizeMb} MB allowed.`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    setPreview(URL.createObjectURL(file));
    onSelected(file);
  }

  const displayUrl = preview || currentUrl;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-900">{label}</label>
      {hint && <p className="mb-2 text-xs text-gray-500">{hint}</p>}

      {displayUrl ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={label}
            className="h-32 w-32 rounded-xl border border-gray-200 object-cover"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Camera size={12} /> Change
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => { setPreview(null); onRemove(); }}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 size={12} /> Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 transition hover:border-primary hover:text-primary"
        >
          <div className="text-center">
            <Upload size={24} className="mx-auto mb-1" />
            <p className="text-xs">Click to upload</p>
            <p className="text-[10px]">JPG, PNG, WebP · Max {maxSizeMb} MB</p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
