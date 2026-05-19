'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { clientConfig } from '../../../../lib/clientConfig';
import { TierSection, type EnrichedTieredMatch, type TieredMatchBuckets } from '../../../../components/matches/TierSection';

const TIERS: { key: keyof TieredMatchBuckets; title: string; subtitle: string; band: string }[] = [
  { key: 'level1', title: 'High match', subtitle: 'Strong industry and service fit', band: '70–100%' },
  { key: 'level2', title: 'Potential connector', subtitle: 'Valuable network, indirect fit', band: '40–69%' },
  { key: 'level3', title: 'Hidden gem', subtitle: 'Worth a conversation', band: 'Below 40%' },
];

export default function MatchesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [buckets, setBuckets] = useState<TieredMatchBuckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.get<TieredMatchBuckets>('/api/v1/ai/matches/tiered', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setBuckets(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load matches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function onRequestIntro(match: EnrichedTieredMatch) {
    if (!accessToken) return;
    setRequesting(match.targetUserId);
    try {
      await api.post(
        `/api/v1/ai/intros/by-target/${match.targetUserId}/request`,
        {},
        { accessToken: accessToken ?? undefined },
      );
      setBuckets((prev) => {
        if (!prev) return prev;
        const next: TieredMatchBuckets = { level1: [], level2: [], level3: [] };
        for (const key of Object.keys(prev) as (keyof TieredMatchBuckets)[]) {
          next[key] = prev[key].filter((m) => m.targetUserId !== match.targetUserId);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setRequesting(null);
    }
  }

  if (!clientConfig.features.matching) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
        Matching is disabled for this workspace.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your matches</h1>
          <p className="text-sm text-gray-600">
            AI-ranked members worth meeting, grouped by match strength.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !buckets ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          Scoring members…
        </div>
      ) : (
        TIERS.map((tier) => (
          <TierSection
            key={tier.key}
            title={tier.title}
            subtitle={tier.subtitle}
            band={tier.band}
            matches={buckets?.[tier.key] ?? []}
            onRequestIntro={onRequestIntro}
            requestingTargetId={requesting}
          />
        ))
      )}
    </div>
  );
}
