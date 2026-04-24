'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { AuthShell } from '../../../components/auth/AuthShell';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token found. Check the link in your email.');
      return;
    }
    async function verify() {
      try {
        await api.get(`/api/v1/auth/verify-email/${token}`);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err instanceof ApiError ? err.message : 'Verification failed. The link may have expired.');
      }
    }
    void verify();
  }, [token]);

  return (
    <AuthShell title="Email verification">
      {status === 'loading' && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-gray-600">Verifying your email…</p>
        </div>
      )}
      {status === 'success' && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <Check size={28} />
          </div>
          <h2 className="mb-2 text-lg font-bold text-gray-900">Email verified!</h2>
          <p className="mb-6 text-sm text-gray-600">
            Your account is fully activated. You can now create listings, send referrals, and book calls.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Go to dashboard →
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <X size={28} />
          </div>
          <h2 className="mb-2 text-lg font-bold text-gray-900">Verification failed</h2>
          <p className="mb-6 text-sm text-gray-600">{error}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Back to login
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary-light" />}>
      <VerifyInner />
    </Suspense>
  );
}
