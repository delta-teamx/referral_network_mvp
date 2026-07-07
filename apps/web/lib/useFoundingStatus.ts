'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export interface FoundingStatus {
  limit: number;
  taken: number;
  remaining: number;
  isOpen: boolean;
}

/**
 * Fetches live founding-member promo status ("N of 200 spots left").
 * Returns null until loaded or if the API is unreachable — callers should
 * fall back to the static offer copy in that case (safer during launch than
 * hiding the offer).
 */
export function useFoundingStatus(): FoundingStatus | null {
  const [status, setStatus] = useState<FoundingStatus | null>(null);
  useEffect(() => {
    let active = true;
    api
      .get<FoundingStatus>('/api/v1/billing/founding-status')
      .then((s) => {
        if (active && s && typeof s.remaining === 'number') setStatus(s);
      })
      .catch(() => {
        /* keep null → show static offer */
      });
    return () => {
      active = false;
    };
  }, []);
  return status;
}
