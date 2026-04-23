'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, MapPin, Sparkles, Target, Users, Video } from 'lucide-react';
import { CATEGORY_SEEDS } from '@refnet/shared';
import { fadeInUp } from '../../../lib/animations';
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

const INDUSTRIES = [
  'Real Estate', 'Mortgage / Lending', 'Home Inspection', 'Moving / Relocation',
  'Plumbing', 'Electrical', 'General Contracting', 'Painting', 'Cleaning',
  'Photography', 'Wedding Planning', 'Catering / Food', 'Floral', 'DJ / Entertainment',
  'Accounting / CPA', 'Law', 'Insurance', 'Web Design / Development', 'Marketing',
  'Interior Design', 'Healthcare', 'Financial Planning', 'Roofing', 'HVAC',
  'Landscaping', 'Auto Services', 'Consulting', 'Other',
];

type Step = 'basics' | 'business' | 'icp' | 'referrals' | 'barter' | 'video' | 'done';
const STEPS: Step[] = ['basics', 'business', 'icp', 'referrals', 'barter', 'video', 'done'];

export default function OnboardingPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [step, setStep] = useState<Step>('basics');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zip, setZip] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [goals, setGoals] = useState<string[]>([]);

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [keywords, setKeywords] = useState('');
  const [services, setServices] = useState('');
  const [years, setYears] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [icpRoles, setIcpRoles] = useState('');
  const [icpProblems, setIcpProblems] = useState('');
  const [icpDealSize, setIcpDealSize] = useState('');

  const [canReferIndustries, setCanReferIndustries] = useState<string[]>([]);
  const [canReferTypes, setCanReferTypes] = useState('');

  const [openToBarter, setOpenToBarter] = useState(false);
  const [barterOfferings, setBarterOfferings] = useState('');
  const [barterWants, setBarterWants] = useState('');
  const [barterNotes, setBarterNotes] = useState('');

  useEffect(() => { if (status === 'idle') void hydrate(); }, [status, hydrate]);
  useEffect(() => { if (status === 'unauthenticated') router.push('/login?next=/onboarding'); }, [status, router]);

  async function saveBasics() {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      return;
    }
    if (!zip || zip.length < 5) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }
    if (!categorySlug) {
      setError('Please select your primary category.');
      return;
    }
    if (goals.length === 0) {
      setError('Please select at least one goal.');
      return;
    }
    setSaving(true); setError(null);
    try {
      await api.post('/api/v1/onboarding/profile', { zip, primaryCategorySlug: categorySlug, goals }, { accessToken: accessToken ?? undefined });
      setStep('business');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Save failed. Check your inputs and try again.'); } finally { setSaving(false); }
  }

  async function saveProfile() {
    if (!accessToken) return;
    setSaving(true); setError(null);
    try {
      await api.post('/api/v1/profiles', {
        businessName: businessName || `${user?.firstName ?? 'My'}'s Business`,
        industry: industry || 'Other',
        headline: headline || undefined, bio: bio || undefined,
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        servicesOffered: services.split(',').map((s) => s.trim()).filter(Boolean),
        yearsInBusiness: years ? Number(years) : undefined,
        icpIndustries, icpRoles: icpRoles.split(',').map((r) => r.trim()).filter(Boolean),
        icpProblems: icpProblems.split('\n').map((p) => p.trim()).filter(Boolean),
        icpDealSize: icpDealSize || undefined,
        canReferIndustries, canReferTypes: canReferTypes.split('\n').map((t) => t.trim()).filter(Boolean),
        city: city || undefined, state: state || undefined, zipCode: zip || undefined,
        openToBarter,
        barterOfferings: barterOfferings.split(',').map((s) => s.trim()).filter(Boolean),
        barterWants: barterWants.split(',').map((s) => s.trim()).filter(Boolean),
        barterNotes: barterNotes || undefined,
      }, { accessToken: accessToken ?? undefined });
      setStep('video');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Save failed'); } finally { setSaving(false); }
  }

  function next() {
    if (step === 'basics') { void saveBasics(); return; }
    if (step === 'barter') { void saveProfile(); return; }
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!);
  }
  function prev() { const idx = STEPS.indexOf(step); if (idx > 0) setStep(STEPS[idx - 1]!); }
  function toggleGoal(key: string) { setGoals((g) => g.includes(key) ? g.filter((x) => x !== key) : [...g, key]); }

  if (!user) return null;
  const stepNum = STEPS.indexOf(step);
  const progress = Math.round(((stepNum + 1) / STEPS.length) * 100);

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>Step {stepNum + 1} of {STEPS.length}</span><span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

        {step === 'basics' && (
          <SC icon={<MapPin size={20} />} title="Quick start" sub="Where are you based and what are you looking for?">
            <FormField label="ZIP code" name="zip" required value={zip} onChange={(e) => setZip(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Primary category</label>
              <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select…</option>
                {CATEGORY_SEEDS.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Your goals</label>
              <div className="space-y-2">
                {GOALS.map((g) => (
                  <label key={g.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-primary">
                    <input type="checkbox" checked={goals.includes(g.key)} onChange={() => toggleGoal(g.key)} className="h-4 w-4" />{g.label}
                  </label>
                ))}
              </div>
            </div>
          </SC>
        )}

        {step === 'business' && (
          <SC icon={<Sparkles size={20} />} title="Tell us about your business" sub="Helps the AI match you with the right people.">
            <FormField label="Business name" name="businessName" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Industry</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Select…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <FormField label="Headline" name="headline" hint="One sentence" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">About your business</label>
              <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="What makes you different?" />
            </div>
            <FormField label="Services (comma-separated)" name="services" value={services} onChange={(e) => setServices(e.target.value)} />
            <FormField label="Keywords for matching (comma-separated)" name="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <FormField label="City" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
              <FormField label="State" name="state" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} />
              <FormField label="Years" name="years" type="number" value={years} onChange={(e) => setYears(e.target.value)} />
            </div>
          </SC>
        )}

        {step === 'icp' && (
          <SC icon={<Target size={20} />} title="Who do you WANT to meet?" sub="The AI will suggest introductions to people matching this.">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Industries</label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button key={ind} type="button" onClick={() => setIcpIndustries((p) => p.includes(ind) ? p.filter((i) => i !== ind) : [...p, ind])}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${icpIndustries.includes(ind) ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'}`}>
                    {icpIndustries.includes(ind) && <Check size={10} className="mr-1 inline" />}{ind}
                  </button>
                ))}
              </div>
            </div>
            <FormField label="Roles (comma-separated)" name="icpRoles" value={icpRoles} onChange={(e) => setIcpRoles(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Problems they solve (one per line)</label>
              <textarea rows={3} value={icpProblems} onChange={(e) => setIcpProblems(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <FormField label="Deal size" name="icpDealSize" hint="e.g. $5K-$25K" value={icpDealSize} onChange={(e) => setIcpDealSize(e.target.value)} />
          </SC>
        )}

        {step === 'referrals' && (
          <SC icon={<ArrowRight size={20} />} title="Who can YOU refer business to?" sub="Completes the two-sided matching engine.">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Industries you refer to</label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button key={ind} type="button" onClick={() => setCanReferIndustries((p) => p.includes(ind) ? p.filter((i) => i !== ind) : [...p, ind])}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${canReferIndustries.includes(ind) ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'}`}>
                    {canReferIndustries.includes(ind) && <Check size={10} className="mr-1 inline" />}{ind}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Client types you send them (one per line)</label>
              <textarea rows={3} value={canReferTypes} onChange={(e) => setCanReferTypes(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </SC>
        )}

        {step === 'barter' && (
          <SC icon={<Sparkles size={20} />} title="Are you open to bartering?" sub="Trade services or products with other members instead of (or in addition to) cash.">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm transition hover:border-primary">
              <input type="checkbox" checked={openToBarter} onChange={(e) => setOpenToBarter(e.target.checked)} className="h-5 w-5 rounded border-gray-300" />
              <div>
                <p className="font-semibold text-gray-900">Yes, I&rsquo;m open to bartering</p>
                <p className="text-xs text-gray-500">Other members will see this on your profile and the AI will factor it into matching.</p>
              </div>
            </label>
            {openToBarter && (
              <>
                <FormField
                  label="What I can offer for trade (comma-separated)"
                  name="barterOfferings"
                  hint="e.g. free website audit, 1hr consultation, tax prep"
                  value={barterOfferings}
                  onChange={(e) => setBarterOfferings(e.target.value)}
                />
                <FormField
                  label="What I'd accept in trade (comma-separated)"
                  name="barterWants"
                  hint="e.g. photography, legal review, social media management"
                  value={barterWants}
                  onChange={(e) => setBarterWants(e.target.value)}
                />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">Barter terms / notes</label>
                  <textarea
                    rows={2}
                    value={barterNotes}
                    onChange={(e) => setBarterNotes(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="e.g. Will trade up to $500 in services per quarter"
                    maxLength={500}
                  />
                </div>
              </>
            )}
          </SC>
        )}

        {step === 'video' && (
          <SC icon={<Video size={20} />} title="Record your 60-second intro" sub="3x more intros accepted when people see your face.">
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <Video size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="mb-4 text-sm text-gray-600">Video upload available after onboarding. Your profile is enough to start matching.</p>
              <Button onClick={() => setStep('done')}>Skip for now →</Button>
            </div>
          </SC>
        )}

        {step === 'done' && (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><Check size={32} /></div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">You&rsquo;re all set!</h2>
            <p className="mb-6 text-sm text-gray-600">The AI is scanning the network. Check your dashboard for introductions, and explore the directory for life-event matching.</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push('/dashboard')}>Go to dashboard →</Button>
              <button onClick={() => router.push('/connect')} className="text-sm text-primary hover:underline">Explore life-event matching →</button>
            </div>
          </motion.div>
        )}

        {step !== 'done' && (
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={prev} disabled={stepNum === 0} className="text-sm text-gray-500 hover:text-primary disabled:invisible">← Back</button>
            <Button onClick={next} loading={saving}>{step === 'basics' || step === 'barter' ? 'Save & continue' : 'Next →'}</Button>
          </div>
        )}
      </div>
    </main>
  );
}

function SC({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-5 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary">{icon}</div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{sub}</p>
      </div>
      {children}
    </motion.div>
  );
}
