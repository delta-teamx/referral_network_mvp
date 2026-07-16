'use client';

import Link from 'next/link';
import { useFoundingStatus } from '../../lib/useFoundingStatus';
import { useI18n } from '../../lib/i18n';

const SIGNUP_URL = 'https://virtualprosnetwork.com/signup';

/**
 * Founding-member promo, backed by the live /billing/founding-status count.
 *
 *  - variant="bar":  full-width announcement strip (homepage top).
 *  - variant="card": boxed callout (pricing pages, signup form).
 *
 * When the API reports the promo is closed (200 reached) the bar hides itself
 * and the card shows a "spots filled" message. If the count can't be loaded,
 * we fall back to the evergreen offer copy rather than hiding it.
 */
export function FoundingOffer({ variant }: { variant: 'bar' | 'card' }) {
  const { t } = useI18n();
  const status = useFoundingStatus();
  const closed = status !== null && !status.isOpen;
  const spotsLeft =
    status && status.isOpen
      ? ' ' + t('founding.barSpots', { n: status.remaining, limit: status.limit })
      : '';

  if (variant === 'bar') {
    if (closed) return null; // promo is over — don't show the strip
    return (
      <Link
        href={SIGNUP_URL}
        className="block bg-gradient-to-r from-primary via-blue-600 to-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:brightness-110"
      >
        🎉 {t('founding.bar')}{spotsLeft} {t('founding.barCta')}
      </Link>
    );
  }

  // card
  if (closed) {
    return (
      <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center">
        <p className="text-sm font-semibold text-gray-900">{t('founding.closedTitle')}</p>
        <p className="mt-1 text-xs text-gray-600 md:text-sm">{t('founding.closedBody')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-primary/20 bg-primary-light px-5 py-4 text-center">
      <p className="text-sm font-bold text-primary md:text-base">🎉 {t('founding.cardTitle')}</p>
      <p className="mt-1 text-xs text-gray-600 md:text-sm">
        {t('founding.cardBody')}{spotsLeft} {t('founding.cardAfter')}
      </p>
    </div>
  );
}
