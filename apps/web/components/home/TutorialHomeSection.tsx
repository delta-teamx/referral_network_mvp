'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { YouTubeEmbed } from '../tutorials/YouTubeEmbed';

interface FeaturedVideo {
  youtubeId: string;
  title: string;
  description: string | null;
}

/**
 * "See how it works" homepage section. Fetches the admin-featured video at
 * runtime (client-side) so what plays here follows whatever an admin sets as
 * the featured video - no redeploy needed. Renders nothing until a featured
 * video exists, so it never shows an empty box.
 */
export function TutorialHomeSection() {
  const [video, setVideo] = useState<FeaturedVideo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<FeaturedVideo | null>('/api/v1/tutorials/featured');
        if (!cancelled) setVideo(data);
      } catch {
        /* silent - the section simply won't render if the API is unreachable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!video) return null;

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            See how it works
          </span>
          <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">{video.title}</h2>
          {video.description && (
            <p className="mx-auto mt-3 max-w-2xl text-base text-gray-600">{video.description}</p>
          )}
        </div>
        <YouTubeEmbed youtubeId={video.youtubeId} title={video.title} />
      </div>
    </section>
  );
}
