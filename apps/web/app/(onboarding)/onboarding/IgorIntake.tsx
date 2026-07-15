'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Globe2,
  Handshake,
  MapPin,
  Search,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { fadeInUp } from '../../../lib/animations';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ProfileMedia } from '../../../components/onboarding/ProfileMedia';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

const INDUSTRIES = [
  'Real Estate', 'Mortgage / Lending', 'Home Inspection', 'Moving / Relocation',
  'Plumbing', 'Electrical', 'General Contracting', 'Painting', 'Cleaning',
  'Photography', 'Wedding Planning', 'Catering / Food', 'Floral', 'DJ / Entertainment',
  'Accounting / CPA', 'Law', 'Insurance', 'Web Design / Development', 'Marketing',
  'Interior Design', 'Healthcare', 'Financial Planning', 'Roofing', 'HVAC',
  'Landscaping', 'Auto Services', 'Consulting', 'Business Consultant',
  'Franchise Consultant', 'Franchise Coach', 'Other',
];

const SERVICE_AREAS = [
  { value: 'local', label: 'Local only', hint: 'I serve my city / metro', icon: MapPin },
  { value: 'remote', label: 'Remote (US)', hint: 'I work with clients anywhere in the US', icon: Globe2 },
  { value: 'international', label: 'International', hint: 'I work with clients worldwide', icon: Globe2 },
] as const;

type Step = 'business' | 'icp' | 'referrals' | 'media' | 'done';
const STEPS: { key: Step; label: string }[] = [
  { key: 'business', label: 'Your business' },
  { key: 'icp', label: 'Who you want to meet' },
  { key: 'referrals', label: 'Who you refer' },
  { key: 'media', label: 'Photo & video' },
  { key: 'done', label: 'Done' },
];

const RequiredMark = () => <span className="text-danger"> *</span>;

export function IgorIntake() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [step, setStep] = useState<Step>('business');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state across steps
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [keywords, setKeywords] = useState('');
  const [services, setServices] = useState('');
  const [years, setYears] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [serviceArea, setServiceArea] = useState<'local' | 'remote' | 'international'>('local');

  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [icpRoles, setIcpRoles] = useState('');
  const [icpProblems, setIcpProblems] = useState('');
  const [icpDealSize, setIcpDealSize] = useState('');

  const [canReferIndustries, setCanReferIndustries] = useState<string[]>([]);
  const [canReferTypes, setCanReferTypes] = useState('');
  const [openToBarter, setOpenToBarter] = useState(false);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'idle') void hydrate();
  }, [status, hydrate]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?next=/onboarding');
  }, [status, router]);

  async function saveProfile() {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(
        '/api/v1/profiles',
        {
          businessName,
          industry,
          headline: headline || undefined,
          bio: bio || undefined,
          keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          servicesOffered: services.split(',').map((s) => s.trim()).filter(Boolean),
          yearsInBusiness: years ? Number(years) : undefined,
          serviceArea,
          icpIndustries,
          icpRoles: icpRoles.split(',').map((r) => r.trim()).filter(Boolean),
          icpProblems: icpProblems.split('\n').map((p) => p.trim()).filter(Boolean),
          icpDealSize: icpDealSize || undefined,
          canReferIndustries,
          canReferTypes: canReferTypes.split('\n').map((t) => t.trim()).filter(Boolean),
          openToBarter,
          city: city || undefined,
          state: state || undefined,
          zipCode: zipCode || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setStep('media');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    // Kick the matching engine so the dashboard has suggestions ready.
    if (accessToken) {
      try {
        await api.post('/api/v1/ai/refresh', {}, { accessToken: accessToken ?? undefined });
      } catch {
        // best-effort - the feed also self-refreshes when empty.
      }
    }
    router.push('/dashboard');
  }

  function next() {
    if (step === 'referrals') {
      void saveProfile();
      return;
    }
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!.key);
  }

  function prev() {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1]!.key);
  }

  if (!user) return null;

  const stepNum = STEPS.findIndex((s) => s.key === step);
  const totalSteps = STEPS.length - 1; // exclude the "done" screen from the count
  const progress = Math.round((Math.min(stepNum + 1, totalSteps) / totalSteps) * 100);
  const currentLabel = STEPS[stepNum]?.label ?? '';

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Progress */}
        {step !== 'done' && (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
              <span>
                Step {stepNum + 1} of {totalSteps} - {currentLabel}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {step === 'business' && (
          <StepCard
            icon={<Sparkles size={20} />}
            title="Tell us about your business"
            subtitle="This helps the AI understand what you do and match you with the right people."
          >
            <FormField
              label="Business name"
              name="businessName"
              required
              placeholder="Johnson Realty Group"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Industry
                <RequiredMark />
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              >
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <FormField
              label="Headline"
              name="headline"
              placeholder="5th-generation realtor serving the St. Louis metro"
              hint="One sentence: what you do + where"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-900">About your business</label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="What makes you different? What types of clients do you serve?"
              />
            </div>
            <FormField
              label="Services offered"
              name="services"
              placeholder="AI Chatbots, Facebook Ads, CRM Setup"
              hint="Separate with commas."
              value={services}
              onChange={(e) => setServices(e.target.value)}
            />
            <FormField
              label="Keywords for matching"
              name="keywords"
              placeholder="chatbot, lead generation, automation, AI"
              hint="Separate keywords with commas. These help customers and partners find you."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />

            {/* Service area cards */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-900">Service area</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {SERVICE_AREAS.map((sa) => {
                  const Icon = sa.icon;
                  const active = serviceArea === sa.value;
                  return (
                    <button
                      key={sa.value}
                      type="button"
                      onClick={() => setServiceArea(sa.value)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-primary bg-primary-light ring-1 ring-primary'
                          : 'border-gray-200 bg-white hover:border-primary'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-primary' : 'text-gray-400'} />
                      <p className="mt-1 text-sm font-semibold text-gray-900">{sa.label}</p>
                      <p className="text-xs text-gray-500">{sa.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="City" name="city" placeholder="Albany" value={city} onChange={(e) => setCity(e.target.value)} />
              <FormField label="State" name="state" placeholder="NY" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
              <FormField label="ZIP" name="zipCode" placeholder="12207" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
            </div>
            <FormField
              label="Years of experience"
              name="years"
              type="number"
              placeholder="e.g. 12"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </StepCard>
        )}

        {step === 'icp' && (
          <StepCard
            icon={<Users size={20} />}
            title="Who do you want to meet?"
            subtitle="We use this to scan the network and suggest introductions to people who match - so every connection is worth your time."
          >
            <IndustryPicker
              label="Industries you want to connect with"
              selected={icpIndustries}
              onToggle={(ind) =>
                setIcpIndustries((prev) => (prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]))
              }
            />
            <FormField
              label="Roles you want to meet"
              name="icpRoles"
              placeholder="agents, brokers, adjusters"
              hint="Separate with commas."
              value={icpRoles}
              onChange={(e) => setIcpRoles(e.target.value)}
            />
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-900">Problems they solve for YOUR clients</label>
              <textarea
                rows={3}
                value={icpProblems}
                onChange={(e) => setIcpProblems(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={'One per line:\nHomebuyer needs roof inspection\nStorm damage insurance claims'}
              />
            </div>
            <FormField
              label="Typical deal size"
              name="icpDealSize"
              placeholder="$5K-$25K"
              hint="Optional - helps rank the strongest matches."
              value={icpDealSize}
              onChange={(e) => setIcpDealSize(e.target.value)}
            />
          </StepCard>
        )}

        {step === 'referrals' && (
          <StepCard
            icon={<ArrowRight size={20} />}
            title="Who do you regularly refer clients to?"
            subtitle="This completes the two-sided matching engine. When someone in the network needs a pro you can vouch for, the AI connects them through you."
          >
            <IndustryPicker
              label="Industries you regularly refer clients to"
              selected={canReferIndustries}
              onToggle={(ind) =>
                setCanReferIndustries((prev) => (prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]))
              }
            />
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-900">What clients do you usually refer?</label>
              <textarea
                rows={3}
                value={canReferTypes}
                onChange={(e) => setCanReferTypes(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={'One per line:\nFirst-time home buyers\nSmall business owners\nProperty investors'}
              />
            </div>

            {/* Barter */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-primary">
              <input
                type="checkbox"
                checked={openToBarter}
                onChange={(e) => setOpenToBarter(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <Handshake size={15} className="text-primary" /> Show my profile to members looking to barter
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  Exchange services with trusted members (e.g. AI automation ↔ web design). You always
                  decide whether to accept an offer - default is cash-only.
                </span>
              </span>
            </label>
          </StepCard>
        )}

        {step === 'media' && (
          <StepCard
            icon={<Video size={20} />}
            title="Add your photo & intro video"
            subtitle="Profiles with a photo and a short video get far more accepted intros. You can record right now, upload files, or skip and add them later from your dashboard."
          >
            <ProfileMedia
              accessToken={accessToken ?? undefined}
              photoUrl={photoUrl}
              videoUrl={videoUrl}
              onPhoto={setPhotoUrl}
              onVideo={(u) => setVideoUrl(u || null)}
            />
          </StepCard>
        )}

        {step === 'done' && (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <Check size={32} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">You&rsquo;re all set!</h2>
            <p className="mb-6 text-sm text-gray-600">
              The AI is now scanning the network for people you should meet. Check your dashboard for
              your first suggested introductions.
            </p>
            <Button onClick={() => void finish()}>Go to my dashboard →</Button>
          </motion.div>
        )}

        {/* Nav buttons */}
        {step !== 'done' && (
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={prev}
              disabled={stepNum === 0}
              className="text-sm text-gray-500 hover:text-primary disabled:invisible"
            >
              ← Back
            </button>
            {step === 'media' ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('done')}
                  className="text-sm font-medium text-gray-500 hover:text-primary"
                >
                  Skip for now
                </button>
                <Button onClick={() => setStep('done')}>Finish →</Button>
              </div>
            ) : (
              <Button
                onClick={next}
                loading={saving}
                disabled={step === 'business' && (!businessName || !industry)}
              >
                {step === 'referrals' ? 'Save & continue' : 'Next →'}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function IndustryPicker({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: string[];
  onToggle: (ind: string) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return INDUSTRIES;
    return INDUSTRIES.filter((i) => i.toLowerCase().includes(needle));
  }, [q]);

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-900">{label}</label>
        <span className="text-xs font-medium text-primary">{selected.length} selected</span>
      </div>
      <div className="relative mb-2">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search industries…"
          className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.map((ind) => {
          const active = selected.includes(ind);
          return (
            <button
              key={ind}
              type="button"
              onClick={() => onToggle(ind)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'bg-primary text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'
              }`}
            >
              {active && <Check size={10} className="mr-1 inline" />}
              {ind}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-gray-400">No industries match “{q}”.</p>}
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="space-y-5 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
    >
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      {children}
    </motion.div>
  );
}
