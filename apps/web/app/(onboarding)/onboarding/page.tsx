'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CATEGORY_SEEDS, onboardingStartSchema } from '@refnet/shared';
import type { OnboardingStartInput } from '@refnet/shared';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

const GOALS = [
  { key: 'get_more_leads', label: 'Get more customer leads' },
  { key: 'build_referral_partners', label: 'Build referral partnerships' },
  { key: 'find_local_services', label: 'Find local services I need' },
  { key: 'join_networking_group', label: 'Join a networking group' },
] as const;

interface ProgressState {
  completedSteps: string[];
  completedAt: string | null;
}

interface Suggestion {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  city: string;
  state: string;
  category: { name: string; slug: string };
  isVerified: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [step, setStep] = useState<'profile' | 'suggestions' | 'done'>('profile');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!user && accessToken === null) {
      void hydrate();
    }
  }, [user, accessToken, hydrate]);

  useEffect(() => {
    if (!accessToken) return;
    // If the user has already completed profile step, skip straight to suggestions.
    void api
      .get<ProgressState | null>('/api/v1/onboarding/status', { accessToken })
      .then((status) => {
        if (status?.completedSteps?.includes('profile_submitted')) {
          setStep('suggestions');
          void loadSuggestions();
        }
      })
      .catch(() => {
        /* first run — no record yet, stay on profile step */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function loadSuggestions() {
    if (!accessToken) return;
    try {
      const list = await api.get<Suggestion[]>('/api/v1/onboarding/suggestions', { accessToken });
      setSuggestions(list);
    } catch {
      setSuggestions([]);
    }
  }

  async function onSubmitProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(e.currentTarget);
    const goals = GOALS.map((g) => g.key).filter((k) => form.get(`goal:${k}`) === 'on');
    const input: OnboardingStartInput = {
      zip: String(form.get('zip') ?? ''),
      primaryCategorySlug: String(form.get('primaryCategorySlug') ?? ''),
      goals: goals as OnboardingStartInput['goals'],
    };
    const parsed = onboardingStartSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/v1/onboarding/profile', parsed.data, {
        accessToken: accessToken ?? undefined,
      });
      await loadSuggestions();
      setStep('suggestions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  }

  async function finishOnboarding() {
    if (!accessToken) return;
    try {
      await api.post('/api/v1/onboarding/step', { step: 'first_connection' }, { accessToken });
    } catch {
      // non-fatal — user can still reach the home page
    }
    setStep('done');
    router.push('/');
  }

  return (
    <main className="min-h-screen bg-primary-light px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
          Welcome{user ? `, ${user.firstName}` : ''}
        </p>
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Let&rsquo;s set you up.</h1>

        <Stepper current={step} />

        {step === 'profile' && (
          <form onSubmit={onSubmitProfile} noValidate className="mt-6">
            <FormField
              label="ZIP code"
              name="zip"
              autoComplete="postal-code"
              placeholder="e.g. 63101"
              required
              error={fieldErrors.zip}
            />

            <label className="mb-1 block text-sm font-medium text-gray-900">Primary category</label>
            <select
              name="primaryCategorySlug"
              required
              defaultValue=""
              className={`mb-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                fieldErrors.primaryCategorySlug ? 'border-danger' : 'border-gray-300'
              }`}
            >
              <option value="" disabled>
                Select one…
              </option>
              {CATEGORY_SEEDS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.primaryCategorySlug && (
              <p className="mb-3 text-xs text-danger">{fieldErrors.primaryCategorySlug}</p>
            )}
            <p className="mb-4 text-xs text-gray-500">
              {user?.role === 'BUSINESS_OWNER'
                ? 'The category that best describes your business.'
                : 'The category you most often need help with.'}
            </p>

            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-medium text-gray-900">
                What do you want from ReferralNetwork?
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <label
                    key={g.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:border-primary"
                  >
                    <input type="checkbox" name={`goal:${g.key}`} />
                    {g.label}
                  </label>
                ))}
              </div>
              {fieldErrors.goals && <p className="mt-1 text-xs text-danger">{fieldErrors.goals}</p>}
            </fieldset>

            {error && (
              <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              Continue
            </Button>
          </form>
        )}

        {step === 'suggestions' && (
          <div className="mt-6">
            <p className="mb-4 text-sm text-gray-600">
              Based on your ZIP and category, here are pros near you. Branch 4 will wire the real
              connect flow; for now, you can finish onboarding and head to the home page.
            </p>
            {suggestions.length === 0 ? (
              <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
                No listings are seeded yet. Once Branch 3 imports test data, you&rsquo;ll see
                matched pros here.
              </p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-medium text-gray-900">
                      {s.name}
                      {s.isVerified && (
                        <span className="ml-2 inline-block rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                          Verified
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.category.name} · {s.city}, {s.state}
                    </p>
                    {s.shortDescription && (
                      <p className="mt-1 text-sm text-gray-700">{s.shortDescription}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Link href="/" className="text-sm text-gray-600 hover:underline">
                Skip for now
              </Link>
              <Button onClick={finishOnboarding}>Finish</Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stepper({ current }: { current: 'profile' | 'suggestions' | 'done' }) {
  const steps = [
    { key: 'profile', label: 'Profile' },
    { key: 'suggestions', label: 'Suggestions' },
    { key: 'done', label: 'Finish' },
  ] as const;
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 text-xs font-medium text-gray-500">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
              i <= currentIdx ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {i + 1}
          </span>
          <span className={i === currentIdx ? 'text-gray-900' : ''}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-gray-300">·</span>}
        </li>
      ))}
    </ol>
  );
}
