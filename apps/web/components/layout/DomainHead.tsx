'use client';

import { useEffect } from 'react';

export function DomainHead() {
  useEffect(() => {
    const host = window.location.hostname;
    const isVpn = host === 'virtualprosnetwork.com' || host === 'www.virtualprosnetwork.com';

    if (isVpn) {
      document.title = document.title
        .replace('Referral Nova', 'VirtualProsNetwork')
        .replace('referral nova', 'VirtualProsNetwork');
    }

    // Set favicon based on domain
    const existing = document.querySelector('link[rel="icon"]');
    if (existing) existing.remove();
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = isVpn
      ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="%232563eb"/><circle cx="13" cy="20" r="4" fill="white" opacity="0.9"/><circle cx="27" cy="20" r="4" fill="white" opacity="0.9"/><path d="M17 20 C20 12,23 12,27 16" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/><path d="M23 20 C20 28,17 28,13 24" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/><circle cx="20" cy="20" r="1.5" fill="white"/></svg>'
      : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="%232563eb"/><circle cx="20" cy="20" r="5" fill="white" opacity="0.95"/><path d="M20 8 L22 16 L20 14 L18 16 Z" fill="white" opacity="0.7"/><path d="M20 32 L22 24 L20 26 L18 24 Z" fill="white" opacity="0.7"/><path d="M8 20 L16 18 L14 20 L16 22 Z" fill="white" opacity="0.7"/><path d="M32 20 L24 18 L26 20 L24 22 Z" fill="white" opacity="0.7"/></svg>';
    document.head.appendChild(link);
  }, []);

  return null;
}
