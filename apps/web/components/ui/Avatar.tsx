'use client';

import { useEffect, useState } from 'react';

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
    <img src={src} alt={name} className={className} onError={() => setBroken(true)} />
  );
}
