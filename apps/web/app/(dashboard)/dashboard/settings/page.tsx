'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Camera, Check, Edit3, Globe, Handshake, Linkedin, MapPin,
  Save, Target, Video, X,
} from 'lucide-react';
import { fadeInUp } from '../../../../lib/animations';
import { MemberProfileView } from '../../../../components/members/MemberProfileView';
import { api, ApiError, apiBaseUrl } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';
import { FormField } from '../../../../components/ui/FormField';
import { Button } from '../../../../components/ui/Button';
import { VideoRecorder } from '../../../../components/ui/VideoRecorder';
import { PhotoUpload } from '../../../../components/ui/PhotoUpload';

interface Profile {
  id: string;
  businessName: string;
  industry: string;
  headline: string | null;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
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

function Tag({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">
      {children}
    </span>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Briefcase; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 py-5 last:border-0">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const videoFileInput = useRef<HTMLInputElement | null>(null);

  /** Shared by the in-browser recorder and the file-upload button. */
  async function uploadVideoBlob(blob: Blob, contentType: string) {
    if (!accessToken) return;
    if (blob.size > 100 * 1024 * 1024) {
      setError('Video too large. Max 100 MB.');
      return;
    }
    setVideoUploading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/api/v1/profiles/video/upload`, {
        method: 'POST',
        headers: { 'Content-Type': contentType, Authorization: `Bearer ${accessToken}` },
        body: blob,
        credentials: 'include',
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? `Upload failed (${res.status})`);
      const p = await api.get<Profile>('/api/v1/profiles/me', { accessToken: accessToken ?? undefined });
      setProfile(p);
      setShowVideoRecorder(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Video upload failed.');
    } finally {
      setVideoUploading(false);
    }
  }

  async function uploadHeadshot(file: File) {
    if (!accessToken) return;
    setPhotoUploading(true);
    setError(null);
    try {
      // Upload through our API (server-side storage put) - no browser-to-S3.
      const res = await fetch(`${apiBaseUrl()}/api/v1/profiles/photo/upload`, {
        method: 'POST',
        headers: { 'Content-Type': file.type, Authorization: `Bearer ${accessToken}` },
        body: file,
        credentials: 'include',
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? `Upload failed (${res.status})`);
      const p = await api.get<Profile>('/api/v1/profiles/me', { accessToken: accessToken ?? undefined });
      setProfile(p);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Photo upload failed.');
    } finally {
      setPhotoUploading(false);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    async function load() {
      try {
        const p = await api.get<Profile>('/api/v1/profiles/me', { accessToken: accessToken ?? undefined });
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
    setSaving(true); setError(null); setSaved(false);
    const form = new FormData(e.currentTarget);
    const yrs = Number(form.get('yearsInBusiness'));
    try {
      const updated = await api.post<Profile>('/api/v1/profiles', {
        businessName: String(form.get('businessName') ?? ''),
        industry: String(form.get('industry') ?? ''),
        headline: String(form.get('headline') ?? '') || undefined,
        // '' clears the stored link server-side; undefined would leave it.
        linkedinUrl: String(form.get('linkedinUrl') ?? '').trim(),
        bio: String(form.get('bio') ?? '') || undefined,
        keywords: String(form.get('keywords') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        servicesOffered: String(form.get('servicesOffered') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
        yearsInBusiness: yrs >= 0 && yrs <= 150 ? yrs : undefined,
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
      }, { accessToken: accessToken ?? undefined });
      setProfile(updated);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8"><div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" /></div>;

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

  if (!editing) {
    // Your own profile renders through the EXACT same component other members
    // see (same layout, same theme) - plus an Edit button on top.
    return (
      <div className="p-6 md:p-8">
        <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3">
          <div>
            {saved && (
              <p className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <Check size={14} /> Profile saved.
              </p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <Edit3 size={14} /> Edit profile
          </button>
        </div>
        <MemberProfileView id={profile.id} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Edit profile</h1>
          <button onClick={() => setEditing(false)} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><X size={14} /> Cancel</button>
        </div>
        {error && <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Business identity</h2>
            <div className="space-y-4">
              <PhotoUpload
                label="Profile photo"
                hint="A headshot or logo - shown on your profile and in match suggestions."
                currentUrl={profile.photoUrl}
                uploading={photoUploading}
                onSelected={(file) => void uploadHeadshot(file)}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">Intro video</label>
                <input
                  ref={videoFileInput}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const ct = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) ? file.type : 'video/mp4';
                      void uploadVideoBlob(file, ct);
                    }
                    if (videoFileInput.current) videoFileInput.current.value = '';
                  }}
                />
                {showVideoRecorder ? (
                  <div>
                    <VideoRecorder
                      maxDurationSec={60}
                      uploading={videoUploading}
                      onRecorded={(blob) => void uploadVideoBlob(blob, 'video/webm')}
                    />
                    <button type="button" onClick={() => setShowVideoRecorder(false)} className="mt-2 text-sm text-gray-500">Cancel</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profile.videoUrl && (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={profile.videoUrl} controls className="w-full max-w-md rounded-lg" style={{ maxHeight: '240px' }} />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setShowVideoRecorder(true)} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-light px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white">
                        <Camera size={14} /> {profile.videoUrl ? 'Re-record video' : 'Record your 60-second intro'}
                      </button>
                      <button
                        type="button"
                        disabled={videoUploading}
                        onClick={() => videoFileInput.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary disabled:opacity-60"
                      >
                        <Video size={14} /> {videoUploading ? 'Uploading…' : profile.videoUrl ? 'Upload a new video' : 'Upload video file'}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">MP4, WebM or QuickTime · up to 100 MB.</p>
                  </div>
                )}
              </div>
              <FormField label="Business name *" name="businessName" defaultValue={profile.businessName} required />
              <FormField label="Industry *" name="industry" defaultValue={profile.industry} required />
              <FormField label="Headline" name="headline" defaultValue={profile.headline ?? ''} />
              <FormField
                label="LinkedIn profile"
                name="linkedinUrl"
                placeholder="linkedin.com/in/yourname"
                hint="Optional - shown on your public profile."
                defaultValue={profile.linkedinUrl ?? ''}
              />
              <div><label className="mb-1 block text-sm font-medium text-gray-900">Bio</label><textarea name="bio" defaultValue={profile.bio ?? ''} rows={4} maxLength={2000} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <FormField label="Services (comma-separated)" name="servicesOffered" defaultValue={profile.servicesOffered.join(', ')} />
              <FormField label="Keywords (comma-separated)" name="keywords" defaultValue={profile.keywords.join(', ')} />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <FormField label="City" name="city" defaultValue={profile.city ?? ''} />
                <FormField label="State" name="state" defaultValue={profile.state ?? ''} maxLength={2} />
                <FormField label="ZIP" name="zipCode" defaultValue={profile.zipCode ?? ''} />
                <FormField label="Years" name="yearsInBusiness" type="number" defaultValue={String(profile.yearsInBusiness ?? '')} />
              </div>
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Who I want to meet</h2>
            <div className="space-y-4">
              <FormField label="Industries (comma-separated)" name="icpIndustries" defaultValue={profile.icpIndustries.join(', ')} />
              <FormField label="Roles (comma-separated)" name="icpRoles" defaultValue={profile.icpRoles.join(', ')} />
              <div><label className="mb-1 block text-sm font-medium text-gray-900">Problems they solve (one per line)</label><textarea name="icpProblems" defaultValue={profile.icpProblems.join('\n')} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              <FormField label="Deal size" name="icpDealSize" defaultValue={profile.icpDealSize ?? ''} />
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Who I can refer to</h2>
            <div className="space-y-4">
              <FormField label="Industries (comma-separated)" name="canReferIndustries" defaultValue={profile.canReferIndustries.join(', ')} />
              <div><label className="mb-1 block text-sm font-medium text-gray-900">Client types (one per line)</label><textarea name="canReferTypes" defaultValue={profile.canReferTypes.join('\n')} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Bartering</h2>
            <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm hover:border-primary"><input type="checkbox" name="openToBarter" defaultChecked={profile.openToBarter} className="h-4 w-4" /><span className="font-medium text-gray-900">Open to bartering services</span></label>
            <div className="space-y-4">
              <FormField label="What I can offer (comma-separated)" name="barterOfferings" defaultValue={profile.barterOfferings.join(', ')} />
              <FormField label="What I'd accept (comma-separated)" name="barterWants" defaultValue={profile.barterWants.join(', ')} />
              <div><label className="mb-1 block text-sm font-medium text-gray-900">Barter terms</label><textarea name="barterNotes" defaultValue={profile.barterNotes ?? ''} rows={2} maxLength={500} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
            </div>
          </section>
          <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
            <Button type="submit" loading={saving}><Save size={14} /> Save changes</Button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
