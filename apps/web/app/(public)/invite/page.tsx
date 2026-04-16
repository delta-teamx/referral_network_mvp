'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, Network, Sparkles } from 'lucide-react';
import { fadeInUp } from '../../../lib/animations';
import { api, ApiError } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';
import { useAuthStore } from '../../../stores/auth';

interface PublicInvite {
  id: string;
  recipientEmail: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  sender: {
    firstName: string;
    lastName: string;
    listing: { name: string; slug: string; city: string; state: string } | null;
  };
}

function InviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [invite, setInvite] = useState<PublicInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token');
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const inv = await api.get<PublicInvite>(`/api/v1/invitations/public/${token}`);
        if (!cancelled) setInvite(inv);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Invitation not found');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    if (!accessToken) {
      router.push(`/signup?invite=${token}`);
      return;
    }
    setAccepting(true);
    try {
      await api.post(`/api/v1/invitations/${token}/accept`, {}, { accessToken });
      setAccepted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invitation');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-16">
      <div className="mx-auto max-w-xl">
        {error && !invite && (
          <div className="rounded-2xl border border-danger/30 bg-white p-8 text-center shadow-sm">
            <p className="mb-2 text-lg font-semibold text-danger">Invitation not available</p>
            <p className="text-sm text-gray-600">{error}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Go to homepage
            </Link>
          </div>
        )}

        {invite && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl"
          >
            <div className="bg-gradient-to-br from-primary to-blue-600 p-8 text-white">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
                <Network size={12} /> Private invitation
              </div>
              <h1 className="text-3xl font-bold">
                {invite.sender.firstName} {invite.sender.lastName} invited you to their network
              </h1>
              {invite.sender.listing && (
                <p className="mt-2 text-white/90">
                  {invite.sender.listing.name} · {invite.sender.listing.city},{' '}
                  {invite.sender.listing.state}
                </p>
              )}
            </div>

            <div className="p-8">
              {invite.message && (
                <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Personal note
                  </p>
                  <p className="mt-1 text-sm italic text-gray-700">
                    &ldquo;{invite.message}&rdquo;
                  </p>
                </div>
              )}

              <ul className="mb-6 space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <Sparkles size={16} className="mt-0.5 text-primary" />
                  Auto-connect with {invite.sender.firstName} when you join.
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles size={16} className="mt-0.5 text-primary" />
                  List your business in the directory. Get matched to clients via life events.
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles size={16} className="mt-0.5 text-primary" />
                  Build your trust score with every converted referral.
                </li>
              </ul>

              {invite.status === 'expired' && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <Clock size={14} /> This invitation expired on{' '}
                  {new Date(invite.expiresAt).toLocaleDateString()}. Ask{' '}
                  {invite.sender.firstName} for a new one.
                </div>
              )}
              {invite.status === 'revoked' && (
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  This invitation was revoked.
                </div>
              )}
              {invite.status === 'accepted' && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                  <Check size={14} /> Already accepted.
                </div>
              )}

              {accepted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                    <Check size={14} /> You&rsquo;re now connected with {invite.sender.firstName}.
                  </div>
                  <Link
                    href="/dashboard/network"
                    className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
                  >
                    Go to my network →
                  </Link>
                </div>
              ) : invite.status === 'pending' ? (
                user ? (
                  <Button onClick={() => void accept()} loading={accepting} className="w-full">
                    Accept and connect
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Link
                      href={`/signup?invite=${token}&email=${encodeURIComponent(invite.recipientEmail)}`}
                      className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90"
                    >
                      Sign up and accept →
                    </Link>
                    <p className="text-center text-xs text-gray-500">
                      Already have an account?{' '}
                      <Link
                        href={`/login?next=/invite?token=${token}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Log in to accept
                      </Link>
                    </p>
                  </div>
                )
              ) : null}

              {error && invite && (
                <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50" />
      }
    >
      <InviteInner />
    </Suspense>
  );
}
