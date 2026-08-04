'use client';

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { YouTubeEmbed } from '../../../../components/tutorials/YouTubeEmbed';

interface TutorialVideo {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  category: string | null;
  showOnHomepage: boolean;
  showInTutorials: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

const EMPTY = {
  youtubeUrl: '',
  title: '',
  description: '',
  category: '',
  showOnHomepage: false,
  showInTutorials: true,
  isFeatured: false,
  sortOrder: 0,
};

export default function AdminTutorialsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await api.get<TutorialVideo[]>('/api/v1/admin/tutorials', {
        accessToken: accessToken ?? undefined,
      });
      setVideos(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load tutorials');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(
        '/api/v1/admin/tutorials',
        {
          youtubeUrl: form.youtubeUrl.trim(),
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category.trim() || null,
          showOnHomepage: form.showOnHomepage,
          showInTutorials: form.showInTutorials,
          isFeatured: form.isFeatured,
          sortOrder: Number(form.sortOrder) || 0,
        },
        { accessToken: accessToken ?? undefined },
      );
      setForm({ ...EMPTY });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the video');
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, changes: Partial<TutorialVideo>) {
    if (!accessToken) return;
    // Optimistic update
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...changes } : v)));
    try {
      await api.patch(`/api/v1/admin/tutorials/${id}`, changes, { accessToken: accessToken ?? undefined });
    } catch {
      void load(); // revert to server truth on failure
    }
  }

  async function remove(id: string) {
    if (!accessToken) return;
    if (!window.confirm('Delete this tutorial video?')) return;
    setVideos((prev) => prev.filter((v) => v.id !== id));
    try {
      await api.delete(`/api/v1/admin/tutorials/${id}`, { accessToken: accessToken ?? undefined });
    } catch {
      void load();
    }
  }

  const previewId = form.youtubeUrl ? extractId(form.youtubeUrl) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <GraduationCap size={24} className="text-primary" /> Tutorials
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Paste a YouTube link to add a tutorial. Choose where it appears — the homepage, the members’
        Tutorials tab, or both. Mark one as <strong>Featured</strong> to make it the intro video.
      </p>

      {/* Add form */}
      <form onSubmit={addVideo} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium text-gray-700">
            YouTube link
            <input
              value={form.youtubeUrl}
              onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
              placeholder="https://youtu.be/…"
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Category (optional)
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Getting Started"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-gray-700">
            Description (optional)
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.showOnHomepage} onChange={(e) => setForm((f) => ({ ...f, showOnHomepage: e.target.checked }))} />
            Show on homepage
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.showInTutorials} onChange={(e) => setForm((f) => ({ ...f, showInTutorials: e.target.checked }))} />
            Show in Tutorials tab
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} />
            Featured (intro video)
          </label>
          <label className="flex items-center gap-2">
            Order
            <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} className="w-16 rounded-lg border border-gray-200 px-2 py-1" />
          </label>
        </div>

        {previewId && (
          <div className="mt-4 max-w-xs">
            <p className="mb-1 text-xs text-gray-400">Preview</p>
            <YouTubeEmbed youtubeId={previewId} title="Preview" />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add video
        </button>
      </form>

      {/* Existing videos */}
      <h2 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
        Current videos ({videos.length})
      </h2>
      {loading ? (
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      ) : videos.length === 0 ? (
        <p className="text-sm text-gray-500">No videos yet — add one above.</p>
      ) : (
        <ul className="space-y-3">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <img
                // eslint-disable-next-line @next/next/no-img-element
                src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                alt=""
                className="h-14 w-24 shrink-0 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-semibold text-gray-900">
                  {v.isFeatured && <Star size={13} className="shrink-0 text-amber-500" />}
                  {v.title}
                </p>
                <p className="text-xs text-gray-400">{v.category || 'Uncategorized'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={v.showOnHomepage} onChange={(e) => void patch(v.id, { showOnHomepage: e.target.checked })} />
                  Homepage
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={v.showInTutorials} onChange={(e) => void patch(v.id, { showInTutorials: e.target.checked })} />
                  Tutorials
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={v.isFeatured} onChange={(e) => void patch(v.id, { isFeatured: e.target.checked })} />
                  Featured
                </label>
                <button onClick={() => void remove(v.id)} className="rounded-full p-1.5 text-gray-400 hover:bg-danger/10 hover:text-danger" aria-label="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lightweight client-side id extractor for the live preview. */
function extractId(url: string): string | null {
  const s = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1]! : null;
}
