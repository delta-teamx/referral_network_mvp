'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { branding } from '@refnet/shared';
import { api, ApiError } from '../../../lib/api';

interface RsvpResponse {
  ok: boolean;
  groupName?: string;
  whenLabel?: string;
}

export default function RsvpClient() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [state, setState] = useState<RsvpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<RsvpResponse>(`/api/v1/rsvp/${encodeURIComponent(token)}`, {});
        if (!cancelled) setState(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'RSVP failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <Layout>
        <XCircle className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Couldn&apos;t process your RSVP</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
      </Layout>
    );
  }

  if (!state) {
    return (
      <Layout>
        <p className="text-sm text-gray-500">Confirming your RSVP…</p>
      </Layout>
    );
  }

  if (!state.ok) {
    return (
      <Layout>
        <XCircle className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">Invite not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          That RSVP link is invalid or has been revoked. If a member sent this to you directly, reach out and
          ask them to resend.
        </p>
      </Layout>
    );
  }

  return (
    <Layout>
      <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">You&apos;re in.</h1>
      {state.groupName && (
        <p className="mt-2 text-base text-gray-700">
          See you at <strong>{state.groupName}</strong>
          {state.whenLabel ? <> on <strong>{state.whenLabel}</strong></> : null}.
        </p>
      )}
      <p className="mt-4 text-sm text-gray-600">
        We&apos;ll send you the Zoom link the day before the meeting. No pitch, no commitment — just come and
        see how {branding.name} works.
      </p>
      <a
        href="/preview"
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
      >
        Explore the platform
        <ArrowRight className="h-4 w-4" />
      </a>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-blue-50 to-white px-6">
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </main>
  );
}
