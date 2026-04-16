'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { fadeInUp } from '../../../../../lib/animations';
import { api, ApiError } from '../../../../../lib/api';
import { useAuthStore } from '../../../../../stores/auth';

interface Photo {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

interface MyListing {
  id: string;
  slug: string;
  name: string;
}

export default function PhotosPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [listing, setListing] = useState<MyListing | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadAll() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const metrics = await api.get<{ listings: Array<{ id: string; slug: string; name: string }> }>(
        '/api/v1/dashboard/metrics',
        { accessToken: accessToken ?? undefined },
      );
      const first = metrics.listings[0];
      if (!first) {
        setListing(null);
        return;
      }
      setListing(first);
      const ph = await api.get<Photo[]>(`/api/v1/photos/${first.id}`);
      setPhotos(ph);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !listing || !accessToken) return;
    setError(null);
    setUploading(true);
    try {
      const presign = await api.post<{
        uploadUrl: string;
        publicUrl: string;
        key: string;
        demo: boolean;
      }>(
        '/api/v1/photos/presign',
        { listingId: listing.id, contentType: file.type, sizeBytes: file.size },
        { accessToken: accessToken ?? undefined },
      );

      if (!presign.demo) {
        const put = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      }

      await api.post(
        '/api/v1/photos/confirm',
        { listingId: listing.id, url: presign.publicUrl },
        { accessToken: accessToken ?? undefined },
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removePhoto(id: string) {
    if (!accessToken) return;
    try {
      await api.delete(`/api/v1/photos/${id}`, { accessToken: accessToken ?? undefined });
      setPhotos((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-600">Create a listing first, then add photos.</p>
          <Link
            href="/dashboard/listing/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
          >
            Create listing →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/dashboard/listing"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <ArrowLeft size={14} /> Back to listing
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Gallery</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Listing photos</h1>
          <p className="mt-1 text-sm text-gray-500">
            JPEG, PNG, WebP, or GIF. Max 5MB per file. First photo is the cover.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
          <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload photo'}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => void onFileChange(e)}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <ImageIcon size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-600">
            No photos yet. Click <strong>Upload photo</strong> above to add your first one.
          </p>
        </div>
      ) : (
        <motion.ul
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {photos.map((p, idx) => (
            <li
              key={p.id}
              className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? `Photo ${idx + 1}`}
                className="h-48 w-full object-cover"
              />
              <div className="flex items-center justify-between p-3">
                <span className="text-xs text-gray-500">
                  {idx === 0 ? 'Cover' : `Photo ${idx + 1}`}
                </span>
                <button
                  onClick={() => void removePhoto(p.id)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-danger"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
