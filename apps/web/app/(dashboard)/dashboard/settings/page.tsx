'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Check, Save, Video } from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { FormField } from '../../../../components/ui/FormField';
import { Button } from '../../../../components/ui/Button';

interface Profile {
  id: string;
  businessName: string;
  industry: string;
  headline: string | null;
  bio: string | null;
  keywords: string[];
  servicesOffered: string[];
  yearsInBusiness: number | null;
  icpIndustries: string[];
  icpRoles: string[];
  icpProblems: string[];
  icpDealSize: string | null;
  canReferIndustries: string[];
  canReferTypes: string[];
  videoUrl: string | null;
  videoTranscript: string | null;
  videoProcessed: boolean;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  openToBarter: boolean;
  barterOfferings: string[];
  barterWants: string[];
  barterNotes: string | null;
}

export default function SettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const p = await api.get<Profile>('/api/v1/profiles/me', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setProfile(p);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [accessToken]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const updated = await api.post<Profile>(
        '/api/v1/profiles',
        {
          businessName: String(form.get('businessName') ?? ''),
          industry: String(form.get('industry') ?? ''),
          headline: String(form.get('headline') ?? '') || undefined,
          bio: String(form.get('bio') ?? '') || undefined,
          keywords: String(form.get('keywords') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          servicesOffered: String(form.get('servicesOffered') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          yearsInBusiness: form.get('yearsInBusiness') ? Number(form.get('yearsInBusiness')) : undefined,
          icpIndustries: String(form.get('icpIndustries') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          icpRoles: String(form.get('icpRoles') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          icpProblems: String(form.get('icpProblems') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
          icpDealSize: String(form.get('icpDealSize') ?? '') || undefined,
          canReferIndustries: String(form.get('canReferIndustries') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          canReferTypes: String(form.get('canReferTypes') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
          city: String(form.get('city') ?? '') || undefined,
          state: String(form.get('state') ?? '') || undefined,
          zipCode: String(form.get('zipCode') ?? '') || undefined,
          openToBarter: form.get('openToBarter') === 'on',
          barterOfferings: String(form.get('barterOfferings') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          barterWants: String(form.get('barterWants') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
          barterNotes: String(form.get('barterNotes') ?? '') || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8"><div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" /></div>;
  }

  if (!profile) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="mb-4 text-gray-600">Complete your onboarding first to set up your profile.</p>
          <a href="/onboarding" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">Complete onboarding</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Settings</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Your profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          This is your mini landing page and AI matching data. Keep it up to date for better introductions.
        </p>
      </header>

      <motion.form
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        onSubmit={onSubmit}
        className="max-w-3xl space-y-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {/* Business identity */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Business identity</h2>
          <div className="space-y-4">
            <FormField label="Business name" name="businessName" defaultValue={profile.businessName} required />
            <FormField label="Industry" name="industry" defaultValue={profile.industry} required />
            <FormField label="Headline" name="headline" defaultValue={profile.headline ?? ''} hint="One sentence about what you do" />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Bio</label>
              <textarea name="bio" defaultValue={profile.bio ?? ''} rows={4} maxLength={2000} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <FormField label="Services (comma-separated)" name="servicesOffered" defaultValue={profile.servicesOffered.join(', ')} />
            <FormField label="Keywords for matching (comma-separated)" name="keywords" defaultValue={profile.keywords.join(', ')} />
            <div className="grid gap-4 md:grid-cols-4">
              <FormField label="City" name="city" defaultValue={profile.city ?? ''} />
              <FormField label="State" name="state" defaultValue={profile.state ?? ''} maxLength={2} />
              <FormField label="ZIP" name="zipCode" defaultValue={profile.zipCode ?? ''} />
              <FormField label="Years" name="yearsInBusiness" type="number" defaultValue={String(profile.yearsInBusiness ?? '')} />
            </div>
          </div>
        </section>

        {/* Video */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Video intro</h2>
          {profile.videoUrl ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm text-primary">
                <Video size={16} />
                {profile.videoProcessed ? 'Transcribed' : 'Processing...'}
              </div>
              <video src={profile.videoUrl} controls className="w-full rounded-lg" style={{ maxHeight: '240px' }} />
              {profile.videoTranscript && (
                <p className="mt-2 rounded-md bg-white px-3 py-2 text-xs text-gray-600">{profile.videoTranscript.slice(0, 300)}...</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <Video size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No video recorded yet. Upload one from the onboarding page.</p>
            </div>
          )}
        </section>

        {/* ICP */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Who I want to meet (ICP)</h2>
          <div className="space-y-4">
            <FormField label="Industries (comma-separated)" name="icpIndustries" defaultValue={profile.icpIndustries.join(', ')} />
            <FormField label="Roles (comma-separated)" name="icpRoles" defaultValue={profile.icpRoles.join(', ')} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Problems they solve (one per line)</label>
              <textarea name="icpProblems" defaultValue={profile.icpProblems.join('\n')} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <FormField label="Deal size" name="icpDealSize" defaultValue={profile.icpDealSize ?? ''} hint="e.g. $5K-$25K" />
          </div>
        </section>

        {/* Referral capability */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Who I can refer to</h2>
          <div className="space-y-4">
            <FormField label="Industries (comma-separated)" name="canReferIndustries" defaultValue={profile.canReferIndustries.join(', ')} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Client types (one per line)</label>
              <textarea name="canReferTypes" defaultValue={profile.canReferTypes.join('\n')} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {/* Barter */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Bartering</h2>
          <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm hover:border-primary">
            <input type="checkbox" name="openToBarter" defaultChecked={profile.openToBarter} className="h-4 w-4" />
            <span className="font-medium text-gray-900">I&rsquo;m open to bartering services</span>
          </label>
          <div className="space-y-4">
            <FormField label="What I can offer (comma-separated)" name="barterOfferings" defaultValue={profile.barterOfferings.join(', ')} />
            <FormField label="What I'd accept (comma-separated)" name="barterWants" defaultValue={profile.barterWants.join(', ')} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Barter terms</label>
              <textarea name="barterNotes" defaultValue={profile.barterNotes ?? ''} rows={2} maxLength={500} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        {saved && (
          <p className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            <Check size={14} /> Profile saved.
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            <Save size={14} className="mr-2" /> Save profile
          </Button>
          <a href="/onboarding" className="text-sm text-primary hover:underline">
            Re-run onboarding wizard
          </a>
        </div>
      </motion.form>
    </div>
  );
}
