'use client';

import { useEffect } from 'react';

/**
 * Sets the Referral Nova favicon on the client. (Title is handled by the root
 * layout metadata.) Post-rebrand there is no per-domain branding — it's
 * Referral Nova everywhere.
 */
export function DomainHead() {
  useEffect(() => {
    const existing = document.querySelector('link[rel="icon"]');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="%232563eb"/><circle cx="20" cy="20" r="5" fill="white" opacity="0.95"/><path d="M20 8 L22 16 L20 14 L18 16 Z" fill="white" opacity="0.7"/><path d="M20 32 L22 24 L20 26 L18 24 Z" fill="white" opacity="0.7"/><path d="M8 20 L16 18 L14 20 L16 22 Z" fill="white" opacity="0.7"/><path d="M32 20 L24 18 L26 20 L24 22 Z" fill="white" opacity="0.7"/></svg>';
    document.head.appendChild(link);
  }, []);

  return null;
}
