'use client';

import { MapPin, Sparkles } from 'lucide-react';

export interface EnrichedTieredMatch {
  targetUserId: string;
  rawScore: number;
  normalizedScore: number;
  tier: 'level1' | 'level2' | 'level3';
  reason: string;
  factors: Record<string, number>;
  target: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    businessName: string;
    industry: string;
    headline: string | null;
    videoUrl: string | null;
    city: string | null;
    state: string | null;
  };
}

export interface TieredMatchBuckets {
  level1: EnrichedTieredMatch[];
  level2: EnrichedTieredMatch[];
  level3: EnrichedTieredMatch[];
}

interface Props {
  title: string;
  subtitle: string;
  band: string;
  matches: EnrichedTieredMatch[];
  onRequestIntro: (match: EnrichedTieredMatch) => void;
  requestingTargetId: string | null;
}

export function TierSection({ title, subtitle, band, matches, onRequestIntro, requestingTargetId }: Props) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {band}
        </span>
      </header>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          No matches in this tier yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((m) => (
            <MatchCard
              key={m.targetUserId}
              match={m}
              onRequest={() => onRequestIntro(m)}
              busy={requestingTargetId === m.targetUserId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({
  match,
  onRequest,
  busy,
}: {
  match: EnrichedTieredMatch;
  onRequest: () => void;
  busy: boolean;
}) {
  const { target } = match;
  const fullName = `${target.firstName} ${target.lastName}`.trim();
  const location =
    target.city && target.state
      ? `${target.city}, ${target.state}`
      : target.city ?? target.state ?? null;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {target.avatarUrl ? (
            <img
              src={target.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {target.firstName.charAt(0)}
              {target.lastName.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
            <p className="truncate text-xs text-gray-500">{target.businessName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3 w-3" />
          {match.normalizedScore}%
        </div>
      </div>

      <p className="text-xs uppercase tracking-wide text-gray-500">{target.industry}</p>

      {target.headline && (
        <p className="line-clamp-2 text-sm text-gray-700">{target.headline}</p>
      )}

      <p className="line-clamp-3 text-xs text-gray-600">{match.reason}</p>

      {location && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          {location}
        </div>
      )}

      <button
        type="button"
        onClick={onRequest}
        disabled={busy}
        className="mt-1 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Requesting…' : 'Request intro'}
      </button>
    </article>
  );
}
