'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, Play } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { YouTubeEmbed } from '../../../../components/tutorials/YouTubeEmbed';

interface TutorialVideo {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  category: string | null;
  isFeatured: boolean;
}

export default function TutorialsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [videos, setVideos] = useState<TutorialVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<TutorialVideo[]>('/api/v1/tutorials', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setVideos(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load tutorials');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const featured = videos.find((v) => v.isFeatured) ?? null;
  const rest = videos.filter((v) => v.id !== featured?.id);

  // Group the remaining videos by category (uncategorized last).
  const groups = new Map<string, TutorialVideo[]>();
  for (const v of rest) {
    const key = v.category?.trim() || 'More tutorials';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <GraduationCap size={24} className="text-primary" /> Tutorials
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Short walkthroughs to help you get the most out of Referral Nova.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="aspect-video animate-pulse rounded-xl bg-gray-100" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>
      ) : error ? (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-500">
          No tutorials yet — check back soon.
        </div>
      ) : (
        <div className="space-y-10">
          {/* Featured / introductory video */}
          {featured && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                  <Play size={11} /> Start here
                </span>
                {featured.category && (
                  <span className="text-xs font-medium text-gray-400">{featured.category}</span>
                )}
              </div>
              <YouTubeEmbed youtubeId={featured.youtubeId} title={featured.title} />
              <h2 className="mt-3 text-lg font-bold text-gray-900">{featured.title}</h2>
              {featured.description && (
                <p className="mt-1 text-sm text-gray-600">{featured.description}</p>
              )}
            </section>
          )}

          {/* Remaining videos, grouped by category */}
          {Array.from(groups.entries()).map(([category, items]) => (
            <section key={category}>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
                {category}
              </h3>
              <div className="grid gap-6 sm:grid-cols-2">
                {items.map((v) => (
                  <div key={v.id}>
                    <YouTubeEmbed youtubeId={v.youtubeId} title={v.title} />
                    <h4 className="mt-2 font-semibold text-gray-900">{v.title}</h4>
                    {v.description && <p className="mt-0.5 text-sm text-gray-600">{v.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
