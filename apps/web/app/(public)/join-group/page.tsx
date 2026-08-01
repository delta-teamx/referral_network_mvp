'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crown, Check, Lock } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { APP_BASE_URL } from '../../../lib/domains';
import { useAuthStore } from '../../../stores/auth';

/**
 * Shared group invite-link landing: dashboard.referralnova.com/join-group/<token>.
 *
 * Static-export SPA route (netlify rewrites /join-group/* here), so the token is
 * read from the path at runtime. A signed-in visitor is joined to the group
 * immediately (and, when the link grants it, upgraded to lifetime Premium). A
 * logged-out visitor is sent to log in with ?next back to this page; brand-new
 * people sign up first and can reopen the same link (valid 48h) to join.
 */

interface JoinResult {
  group: { id: string; name: string; slug: string };
  alreadyMember: boolean;
  premiumGranted: boolean;
}

type Phase = 'loading' | 'need-auth' | 'joining' | 'done' | 'error';

export default function JoinGroupPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [phase, setPhase] = useState<Phase>('loading');
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<JoinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Read the token from the path once on mount.
  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('join-group');
    const t = idx >= 0 ? parts[idx + 1] : undefined;
    if (!t) {
      setError('This invite link is incomplete.');
      setPhase('error');
      return;
    }
    setToken(t);
    try {
      window.localStorage.setItem('nrg_invite_token', t);
    } catch {
      /* ignore */
    }
    if (!accessToken) {
      setPhase('need-auth');
    }
    // accessToken deliberately excluded: this runs once to seed token/phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doJoin = useCallback(async () => {
    if (!token || !accessToken) return;
    setPhase('joining');
    setError(null);
    try {
      const data = await api.post<JoinResult>(
        `/api/v1/groups/join-link/${token}`,
        {},
        { accessToken },
      );
      setResult(data);
      setPhase('done');
      try {
        window.localStorage.removeItem('nrg_invite_token');
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join the group.');
      setPhase('error');
    }
  }, [token, accessToken]);

  // Auto-join as soon as we have both a token and a session.
  useEffect(() => {
    if (token && accessToken && phase !== 'done' && phase !== 'joining') {
      void doJoin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, accessToken]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-light via-white to-blue-50 px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {(phase === 'loading' || phase === 'joining') && (
          <>
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-gray-700">
              {phase === 'joining' ? 'Adding you to the group…' : 'Checking your invite…'}
            </p>
          </>
        )}

        {phase === 'need-auth' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <Lock size={26} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">You&rsquo;ve been invited</h1>
            <p className="mt-2 text-sm text-gray-600">
              Log in to accept your invite and join the group. New here? Create your account first,
              then reopen this link to join.
            </p>
            <div className="mt-6 space-y-2">
              <a
                href={`${APP_BASE_URL}/login?next=${encodeURIComponent(`/join-group/${token ?? ''}`)}`}
                className="block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Log in to join
              </a>
              <a
                href={`${APP_BASE_URL}/signup`}
                className="block rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Create an account
              </a>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Check size={28} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {result.alreadyMember ? `You're already in ${result.group.name}` : `Welcome to ${result.group.name}!`}
            </h1>
            {result.premiumGranted && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                <Crown size={14} /> Lifetime Premium unlocked
              </p>
            )}
            <p className="mt-3 text-sm text-gray-600">
              You&rsquo;re all set. Open the group to meet members, see events, and join the
              conversation.
            </p>
            <a
              href={`${APP_BASE_URL}/dashboard/groups?slug=${result.group.slug}`}
              className="mt-6 block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Open the group
            </a>
          </>
        )}

        {phase === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
              <Lock size={26} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Invite unavailable</h1>
            <p className="mt-2 text-sm text-gray-600">{error ?? 'This invite link is not valid.'}</p>
            <a
              href={`${APP_BASE_URL}/dashboard/groups`}
              className="mt-6 block rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Go to groups
            </a>
          </>
        )}
      </div>
    </main>
  );
}
