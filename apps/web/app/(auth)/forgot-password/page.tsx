'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { forgotPasswordSchema } from '@refnet/shared';
import { AuthShell } from '../../../components/auth/AuthShell';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { api, ApiError } from '../../../lib/api';

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const parsed = forgotPasswordSchema.safeParse({ email: String(form.get('email') ?? '') });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setStatus('submitting');
    try {
      await api.post('/api/v1/auth/forgot-password', parsed.data);
      setStatus('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
      setStatus('error');
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <>
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to log in
          </Link>
        </>
      }
    >
      {status === 'sent' ? (
        <p className="rounded-md border border-success/30 bg-success/5 px-3 py-3 text-sm text-success">
          If an account exists for that email, a reset link is on its way. Check your inbox (and the
          dev console in this build - the link logs to server stdout until SendGrid is configured).
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={fieldErrors.email}
          />
          {error && (
            <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" loading={status === 'submitting'} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
