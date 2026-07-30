'use client';

import { useEffect, useState } from 'react';

/**
 * Cache-buster for our media-proxy image URLs. A bad media response was briefly
 * served with a 1-hour cache, so browsers hold the broken image. Bumping this
 * appends a new query param, changing the cache key so every browser refetches
 * the (now working) image immediately - no user cache-clear needed. Bump again
 * if we ever need to force-refresh media.
 */
const MEDIA_CACHE_BUST = '2';
function bustMediaCache(url: string): string {
  if (!url.includes('/attachments/file')) return url; // leave external/data URIs alone
  return url + (url.includes('?') ? '&' : '?') + `cb=${MEDIA_CACHE_BUST}`;
}

/**
 * Profile image with automatic fallback: when there is no photo, or the photo
 * URL fails to load (dead link, storage hiccup), clean initials render
 * instead of the browser's broken-image glyph.
 */
export function Avatar({
  src,
  name,
  className,
  fallbackClassName,
}: {
  src: string | null | undefined;
  name: string;
  /** Classes for the <img> (size, rounding, object-fit). */
  className: string;
  /** Classes for the initials block (size, rounding, colors, centering). */
  fallbackClassName: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!src || broken) {
    return <div className={fallbackClassName}>{initials || '·'}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={bustMediaCache(src)} alt={name} className={className} onError={() => setBroken(true)} />
  );
}
