'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { resetPasswordSchema } from '@refnet/shared';
import { AuthShell } from '../../../components/auth/AuthShell';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { api, ApiError } from '../../../lib/api';

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-3 text-sm text-danger">
        This link is missing its reset token. Please request a new one from the{' '}
        <Link href="/forgot-password" className="underline">
          forgot-password page
        </Link>
        .
      </p>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const parsed = resetPasswordSchema.safeParse({
      token,
      password: String(form.get('password') ?? ''),
    });
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
      await api.post('/api/v1/auth/reset-password', parsed.data);
      setStatus('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <p className="rounded-md border border-success/30 bg-success/5 px-3 py-3 text-sm text-success">
        Password updated. You can now{' '}
        <Link href="/login" className="font-medium underline">
          log in
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="8+ chars, at least one uppercase letter and one number"
        error={fieldErrors.password}
      />
      {error && (
        <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={status === 'submitting'} className="w-full">
        Set new password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Set a new password">
      <Suspense fallback={<p className="text-sm text-gray-600">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
