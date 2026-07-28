'use client';

import { useEffect } from 'react';

/**
 * Sets the Referral Nova favicon on the client. (Title is handled by the root
 * layout metadata.) Post-rebrand there is no per-domain branding - it's
 * Referral Nova everywhere.
 */
export function DomainHead() {
  useEffect(() => {
    const existing = document.querySelector('link[rel="icon"]');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    // "RN" monogram on the brand-blue rounded square (no star imagery).
    link.href =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="%232563eb"/><text x="20" y="21" text-anchor="middle" dominant-baseline="central" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="16.5" letter-spacing="-0.5" fill="white">RN</text></svg>';
    document.head.appendChild(link);
  }, []);

  return null;
}
