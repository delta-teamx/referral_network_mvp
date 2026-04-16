'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { FormField } from '../../../../components/ui/FormField';
import { Button } from '../../../../components/ui/Button';

interface MyListing {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description?: string;
  address?: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

export default function EditListingPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [listing, setListing] = useState<MyListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const metrics = await api.get<{ listings: Array<{ id: string; slug: string }> }>(
          '/api/v1/dashboard/metrics',
          { accessToken: accessToken ?? undefined },
        );
        const first = metrics.listings[0];
        if (!first) {
          if (!cancelled) setListing(null);
          return;
        }
        const detail = await api.get<MyListing>(`/api/v1/listings/${first.slug}`, {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setListing(detail);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!listing || !accessToken) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    const patch = {
      name: String(form.get('name') ?? listing.name),
      shortDescription: String(form.get('shortDescription') ?? listing.shortDescription ?? ''),
      description: String(form.get('description') ?? listing.description ?? ''),
      address: String(form.get('address') ?? listing.address ?? ''),
      city: String(form.get('city') ?? listing.city),
      state: String(form.get('state') ?? listing.state).toUpperCase(),
      zipCode: String(form.get('zipCode') ?? listing.zipCode ?? ''),
      phone: String(form.get('phone') ?? listing.phone ?? '') || null,
      email: String(form.get('email') ?? listing.email ?? '') || null,
      website: String(form.get('website') ?? listing.website ?? '') || null,
    };
    try {
      const updated = await api.patch<MyListing>(`/api/v1/listings/${listing.id}`, patch, {
        accessToken: accessToken ?? undefined,
      });
      setListing(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="mb-4 text-sm text-gray-600">
            You don&rsquo;t have a listing yet. Create one to appear in the directory.
          </p>
          <a
            href="/dashboard/listing/new"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Create listing →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Listing</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Edit your listing</h1>
      </header>

      <motion.form
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        onSubmit={onSubmit}
        className="max-w-3xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <FormField label="Business name" name="name" defaultValue={listing.name} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Short description</label>
          <input
            name="shortDescription"
            defaultValue={listing.shortDescription ?? ''}
            maxLength={255}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Shows on cards across the network. 1 sentence works best.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Full description</label>
          <textarea
            name="description"
            defaultValue={listing.description ?? ''}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Address" name="address" defaultValue={listing.address ?? ''} />
          <FormField label="City" name="city" defaultValue={listing.city} />
          <FormField
            label="State (2-letter)"
            name="state"
            defaultValue={listing.state}
            maxLength={2}
          />
          <FormField label="ZIP code" name="zipCode" defaultValue={listing.zipCode ?? ''} />
          <FormField label="Phone" name="phone" defaultValue={listing.phone ?? ''} />
          <FormField label="Email" name="email" type="email" defaultValue={listing.email ?? ''} />
          <FormField
            label="Website"
            name="website"
            type="url"
            defaultValue={listing.website ?? ''}
            className="md:col-span-2"
          />
        </div>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {saved && (
          <p className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            <Check size={14} /> Saved.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
          <a
            href={`/listing/${listing.slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Preview public page →
          </a>
        </div>
      </motion.form>
    </div>
  );
}
