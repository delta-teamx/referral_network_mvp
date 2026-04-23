'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../../../lib/animations';
import { api, ApiError } from '../../../../../lib/api';
import { useAuthStore } from '../../../../../stores/auth';
import { FormField } from '../../../../../components/ui/FormField';
import { Button } from '../../../../../components/ui/Button';

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function NewListingPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cats = await api.get<Category[]>('/api/v1/categories');
        if (!cancelled) setCategories(cats);
      } catch {
        if (!cancelled) {
          setCategories([]);
          setError('Could not load categories. Please refresh.');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      categoryId: String(form.get('categoryId') ?? ''),
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      shortDescription: String(form.get('shortDescription') ?? '').trim() || undefined,
      address: String(form.get('address') ?? '').trim(),
      city: String(form.get('city') ?? '').trim(),
      state: String(form.get('state') ?? '')
        .trim()
        .toUpperCase(),
      zipCode: String(form.get('zipCode') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim() || undefined,
      email: String(form.get('email') ?? '').trim() || undefined,
      website: String(form.get('website') ?? '').trim() || undefined,
    };
    try {
      const listing = await api.post<{ slug: string }>('/api/v1/listings', payload, {
        accessToken: accessToken ?? undefined,
      });
      router.push(`/listing/${listing.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create listing');
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">New listing</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">List your business</h1>
        <p className="mt-1 text-sm text-gray-500">
          Takes under 2 minutes. You can add photos, hours, and tags later.
        </p>
      </header>

      <motion.form
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        onSubmit={onSubmit}
        className="max-w-3xl space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <FormField label="Business name" name="name" required maxLength={200} />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Category</label>
          <select
            name="categoryId"
            required
            defaultValue=""
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <FormField
          label="Short description"
          name="shortDescription"
          maxLength={255}
          hint="One sentence. Shows on search cards."
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Full description</label>
          <textarea
            name="description"
            required
            minLength={10}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Address" name="address" required />
          <FormField label="City" name="city" required />
          <FormField label="State (2-letter)" name="state" required maxLength={2} />
          <FormField label="ZIP code" name="zipCode" required />
          <FormField label="Phone" name="phone" />
          <FormField label="Email" name="email" type="email" />
          <FormField label="Website" name="website" type="url" className="md:col-span-2" />
        </div>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" loading={saving}>
          Create listing
        </Button>
      </motion.form>
    </div>
  );
}
