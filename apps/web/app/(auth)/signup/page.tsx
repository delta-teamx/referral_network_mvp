'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { signupSchema } from '@refnet/shared';
import type { SignupInput } from '@refnet/shared';
import { api } from '../../../lib/api';
import { AuthShell } from '../../../components/auth/AuthShell';
import { FacebookButton } from '../../../components/auth/FacebookButton';
import { GoogleButton } from '../../../components/auth/GoogleButton';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { useAuthStore } from '../../../stores/auth';

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
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
      firstName: String(form.get('firstName') ?? ''),
      lastName: String(form.get('lastName') ?? ''),
      role: String(form.get('role') ?? 'CONSUMER') as SignupInput['role'],
    };
    const parsed = signupSchema.safeParse(input);
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
      await signup(parsed.data);
    } catch {
      // globalError is already set by the store
      return;
    }
    // Account created — send OTP and redirect
    const email = parsed.data.email;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/send-otp`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
    } catch {
      // OTP send failed — user can resend from the verify page
    }
    window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes under a minute. No credit card required."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton label="Sign up with Google" />
      <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
        <div className="h-px flex-1 bg-gray-200" />
        <span>or with email</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <form onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            error={fieldErrors.firstName}
          />
          <FormField
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            error={fieldErrors.lastName}
          />
        </div>
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
          autoComplete="new-password"
          required
          hint="8+ chars, at least one uppercase letter and one number"
          error={fieldErrors.password}
        />

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-900">I&rsquo;m joining to…</p>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-300 px-3 py-3 text-sm hover:border-primary">
              <input type="radio" name="role" value="BUSINESS_OWNER" defaultChecked className="mt-0.5" />
              <span>
                <span className="block font-semibold text-gray-900">Grow my business through referrals</span>
                <span className="block text-xs text-gray-500">
                  I own or represent a business and want AI-matched introductions.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-300 px-3 py-3 text-sm hover:border-primary">
              <input type="radio" name="role" value="CONSUMER" className="mt-0.5" />
              <span>
                <span className="block font-semibold text-gray-900">Find a trusted local pro</span>
                <span className="block text-xs text-gray-500">
                  I&rsquo;m looking for recommendations from trusted business owners.
                </span>
              </span>
            </label>
          </div>
        </div>

        {globalError && (
          <div className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            <p>{globalError}</p>
            {globalError.toLowerCase().includes('already') && (
              <p className="mt-1">
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Log in instead →
                </Link>
              </p>
            )}
          </div>
        )}

        <Button type="submit" loading={status === 'loading'} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
