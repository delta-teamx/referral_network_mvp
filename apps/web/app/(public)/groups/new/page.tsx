'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { FormField } from '../../../../components/ui/FormField';
import { Button } from '../../../../components/ui/Button';

export default function NewGroupPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?next=/groups/new');
  }, [status, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim() || undefined,
      city: String(form.get('city') ?? '').trim(),
      state: String(form.get('state') ?? '')
        .trim()
        .toUpperCase()
        .slice(0, 2),
      meetingSchedule: String(form.get('meetingSchedule') ?? '').trim() || undefined,
      maxMembers: Number(form.get('maxMembers') ?? 30),
      isPublic: form.get('isPublic') === 'on',
    };
    try {
      const group = await api.post<{ slug: string }>('/api/v1/groups', payload, {
        accessToken: accessToken ?? undefined,
      });
      router.push(`/groups?created=${group.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create group');
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/groups"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
        >
          <ArrowLeft size={14} /> Back to groups
        </Link>

        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">New group</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Start a networking group</h1>
          <p className="mt-1 text-sm text-gray-500">
            You&rsquo;ll be the first leader. Invite peers who don&rsquo;t compete with each other
            — one category per seat.
          </p>
        </header>

        <motion.form
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <FormField label="Group name" name="name" required maxLength={100} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">Description</label>
            <textarea
              name="description"
              rows={4}
              maxLength={500}
              placeholder="Who is this for? When and where do you meet?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="City" name="city" required />
            <FormField label="State (2-letter)" name="state" required maxLength={2} />
            <FormField
              label="Meeting schedule"
              name="meetingSchedule"
              hint="e.g. Every Tuesday 7am"
            />
            <FormField
              label="Max members"
              name="maxMembers"
              type="number"
              defaultValue="30"
              required
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isPublic"
              defaultChecked
              className="h-4 w-4 rounded border-gray-300"
            />
            Public (anyone can discover and request to join)
          </label>

          {error && (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" loading={saving}>
            Create group
          </Button>
        </motion.form>
      </div>
    </main>
  );
}
