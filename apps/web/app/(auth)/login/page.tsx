'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { loginSchema } from '@refnet/shared';
import { AuthShell } from '../../../components/auth/AuthShell';
import { FacebookButton } from '../../../components/auth/FacebookButton';
import { GoogleButton } from '../../../components/auth/GoogleButton';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { useAuthStore } from '../../../stores/auth';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);
  const globalError = useAuthStore((s) => s.error);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const input = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    };
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    try {
      await login(parsed.data);
      const next = searchParams.get('next');
      const safeNext = next && /^\/[a-zA-Z]/.test(next) ? next : null;
      if (safeNext) {
        router.push(safeNext);
      } else {
        const role = useAuthStore.getState().user?.role;
        router.push(role === 'ADMIN' ? '/admin' : '/dashboard');
      }
    } catch {
      // globalError handled by the store
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your VirtualProsNetwork account"
      footer={
        <>
          Need an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <GoogleButton />
      <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        <span>or sign in with email</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <form onSubmit={onSubmit} noValidate>
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={fieldErrors.email}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={fieldErrors.password}
        />

        {globalError && (
          <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {globalError}
          </p>
        )}

        <Button type="submit" loading={status === 'loading'} className="w-full">
          Log in
        </Button>
        <p className="mt-4 text-center text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary-light" />}>
      <LoginInner />
    </Suspense>
  );
}
