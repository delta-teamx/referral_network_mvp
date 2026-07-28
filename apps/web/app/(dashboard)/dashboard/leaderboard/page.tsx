'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  Check,
  Copy,
  Crown,
  FileSignature,
  Handshake,
  Medal,
  PhoneCall,
  Send,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

interface LeaderboardMember {
  userId: string;
  name: string;
  businessName: string | null;
  industry: string | null;
  photoUrl: string | null;
  isFounding: boolean;
  invitesOnboarded: number;
  dealsWon: number;
  contractsSigned: number;
  referralsSent: number;
  callsHeld: number;
  points: number;
  badges: string[];
  rank: number | null;
}

interface LeaderboardData {
  members: LeaderboardMember[];
  totalMembers: number;
  participantCount: number;
  points: {
    inviteOnboarded: number;
    dealWon: number;
    contractSigned: number;
    referralSent: number;
    callHeld: number;
  };
  inviteUrl: string;
  viewer: {
    rank: number | null;
    points: number;
    isFounding: boolean;
    badges: string[];
    invitesOnboarded: number;
    invitesPending: number;
    rewardMonths: number;
  };
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-gray-200 text-gray-700',
  3: 'bg-orange-100 text-orange-700',
};

export default function LeaderboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    api
      .get<LeaderboardData>('/api/v1/referral-tracking/community', {
        accessToken: accessToken ?? undefined,
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load the leaderboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function copyInvite() {
    if (!data?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable - the link is visible to select manually */
    }
  }

  const viewer = data?.viewer ?? null;

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Community</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Leaderboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Invite businesses you trust, close deals, and climb the board. Every successful invite
          makes the whole network stronger.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Invite card + your stats */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-white shadow-sm lg:col-span-2">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Send size={15} /> Your personal invite link
          </div>
          <p className="mb-3 text-xs text-white/80">
            Share it anywhere. An invite counts once the business joins and completes their profile
            {data ? ` (+${data.points.inviteOnboarded} points each)` : ''}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white/15 px-3 py-2 text-xs">
              {data?.inviteUrl ?? 'Loading your link…'}
            </code>
            <button
              type="button"
              onClick={() => void copyInvite()}
              disabled={!data}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary transition hover:bg-white/90 disabled:opacity-60"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          {viewer && (
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <span>
                <strong className="text-base font-bold">{viewer.invitesOnboarded}</strong>{' '}
                <span className="text-white/80">joined</span>
              </span>
              <span>
                <strong className="text-base font-bold">{viewer.invitesPending}</strong>{' '}
                <span className="text-white/80">pending</span>
              </span>
              <span>
                <strong className="text-base font-bold">
                  {viewer.rank ? `#${viewer.rank}` : 'Not ranked yet'}
                </strong>{' '}
                <span className="text-white/80">{viewer.rank ? 'your rank' : ''}</span>
              </span>
              <span>
                <strong className="text-base font-bold">{viewer.points.toLocaleString()}</strong>{' '}
                <span className="text-white/80">points</span>
              </span>
              {viewer.rewardMonths > 0 && (
                <span>
                  <strong className="text-base font-bold">{viewer.rewardMonths}</strong>{' '}
                  <span className="text-white/80">free Premium months earned</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rewards ladder */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
            <Award size={15} className="text-amber-500" /> Invite rewards
          </div>
          {viewer?.isFounding !== false ? (
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex items-center justify-between">
                <span>1 invite joins</span>
                <span className="font-semibold text-gray-900">Connector badge</span>
              </li>
              <li className="flex items-center justify-between">
                <span>3 invites join</span>
                <span className="font-semibold text-gray-900">Priority matching</span>
              </li>
              <li className="flex items-center justify-between">
                <span>5 invites join</span>
                <span className="font-semibold text-gray-900">Ambassador badge</span>
              </li>
              <li className="flex items-center justify-between">
                <span>10 invites join</span>
                <span className="font-semibold text-gray-900">Founding Ambassador</span>
              </li>
              <li className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 font-medium text-amber-700">
                As a founding member you already hold lifetime Premium.
              </li>
            </ul>
          ) : (
            <ul className="space-y-1.5 text-xs text-gray-600">
              <li className="flex items-center justify-between">
                <span>Every 2 invites join</span>
                <span className="font-semibold text-gray-900">1 free Premium month</span>
              </li>
              <li className="flex items-center justify-between">
                <span>10 invites join</span>
                <span className="font-semibold text-gray-900">Ambassador + bonus month</span>
              </li>
              <li className="flex items-center justify-between">
                <span>25 invites join</span>
                <span className="font-semibold text-gray-900">Lifetime Premium</span>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* How points work */}
      {data && (
        <div className="mb-6 flex flex-wrap gap-2 text-xs">
          {[
            { icon: UserPlus, label: `Invite joins +${data.points.inviteOnboarded}` },
            { icon: Trophy, label: `Deal won +${data.points.dealWon}` },
            { icon: FileSignature, label: `Contract signed +${data.points.contractSigned}` },
            { icon: Handshake, label: `Referral sent +${data.points.referralSent}` },
            { icon: PhoneCall, label: `Call held +${data.points.callHeld}` },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700"
            >
              <Icon size={12} className="text-primary" /> {label}
            </span>
          ))}
        </div>
      )}

      {/* Rankings */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Member</th>
              <th className="hidden px-4 py-3 md:table-cell">Badges</th>
              <th className="hidden px-4 py-3 text-center sm:table-cell">Invites</th>
              <th className="hidden px-4 py-3 text-center sm:table-cell">Deals won</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading rankings…
                </td>
              </tr>
            ) : data.members.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Nobody is on the board yet. Be the first: share your invite link, book a call, or
                  win a deal - points appear the moment activity happens.
                </td>
              </tr>
            ) : (
              data.members.map((m) => {
                const isMe = m.userId === user?.id;
                return (
                  <tr
                    key={m.userId}
                    className={`border-b border-gray-50 last:border-0 ${
                      isMe ? 'bg-primary-light/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          (m.rank && RANK_STYLE[m.rank]) ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {m.rank && m.rank <= 3 ? <Medal size={13} /> : m.rank ?? '·'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {m.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.photoUrl}
                            alt=""
                            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                            {m.name.slice(0, 1)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900">
                            {m.name}
                            {isMe && <span className="ml-1.5 text-xs font-medium text-primary">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {m.businessName ?? m.industry ?? ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {m.isFounding && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Crown size={9} /> Founding
                          </span>
                        )}
                        {m.badges
                          .filter((b) => b !== 'Founding member')
                          .map((b) => (
                            <span
                              key={b}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600"
                            >
                              {b}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-center text-gray-700 sm:table-cell">
                      {m.invitesOnboarded}
                    </td>
                    <td className="hidden px-4 py-3 text-center text-gray-700 sm:table-cell">
                      {m.dealsWon}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {m.points.toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <p className="mt-3 text-center text-xs text-gray-400">
          {data.participantCount} of {data.totalMembers} members participating so far.
        </p>
      )}
    </div>
  );
}
