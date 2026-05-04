'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { AuthShell } from '../../../components/auth/AuthShell';
import { Button } from '../../../components/ui/Button';

function OtpInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...code];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]!;
    }
    setCode(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function verify() {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/v1/auth/verify-otp', { email, code: fullCode });
      setVerified(true);
      setTimeout(() => router.push('/onboarding'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api.post('/api/v1/auth/send-otp', { email });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend code');
    }
  }

  if (verified) {
    return (
      <AuthShell title="Email verified!">
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <Check size={28} />
          </div>
          <p className="text-sm text-gray-600">Redirecting to onboarding...</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        <>
          We sent a 6-digit code to <strong className="text-gray-900">{email || 'your email'}</strong>
        </>
      }
    >
      <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-14 w-12 rounded-xl border-2 border-gray-200 bg-gray-50 text-center text-2xl font-bold text-gray-900 transition focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <Button onClick={() => void verify()} loading={loading} className="w-full">
        Verify email
      </Button>

      <div className="mt-4 text-center">
        {resent ? (
          <p className="text-sm text-success">New code sent! Check your inbox.</p>
        ) : (
          <button
            onClick={() => void resend()}
            className="text-sm text-primary hover:underline"
          >
            Didn&rsquo;t get the code? Resend
          </button>
        )}
      </div>
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary-light" />}>
      <OtpInner />
    </Suspense>
  );
}
