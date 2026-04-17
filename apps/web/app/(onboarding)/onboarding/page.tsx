'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Users, Video } from 'lucide-react';
import { fadeInUp } from '../../../lib/animations';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { api, ApiError } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

const INDUSTRIES = [
  'Real Estate', 'Mortgage / Lending', 'Home Inspection', 'Moving / Relocation',
  'Plumbing', 'Electrical', 'General Contracting', 'Painting', 'Cleaning',
  'Photography', 'Wedding Planning', 'Catering / Food', 'Floral', 'DJ / Entertainment',
  'Accounting / CPA', 'Law', 'Insurance', 'Web Design / Development', 'Marketing',
  'Interior Design', 'Healthcare', 'Financial Planning', 'Roofing', 'HVAC',
  'Landscaping', 'Auto Services', 'Consulting', 'Other',
];

type Step = 'business' | 'icp' | 'referrals' | 'video' | 'done';
const STEPS: Step[] = ['business', 'icp', 'referrals', 'video', 'done'];

export default function OnboardingPage() {
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

  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [icpRoles, setIcpRoles] = useState('');
  const [icpProblems, setIcpProblems] = useState('');
  const [icpDealSize, setIcpDealSize] = useState('');

  const [canReferIndustries, setCanReferIndustries] = useState<string[]>([]);
  const [canReferTypes, setCanReferTypes] = useState('');

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
          icpIndustries,
          icpRoles: icpRoles.split(',').map((r) => r.trim()).filter(Boolean),
          icpProblems: icpProblems.split('\n').map((p) => p.trim()).filter(Boolean),
          icpDealSize: icpDealSize || undefined,
          canReferIndustries,
          canReferTypes: canReferTypes.split('\n').map((t) => t.trim()).filter(Boolean),
          city: city || undefined,
          state: state || undefined,
          zipCode: zipCode || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setStep('video');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function next() {
    const idx = STEPS.indexOf(step);
    if (step === 'referrals') {
      void saveProfile();
      return;
    }
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!);
  }

  function prev() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]!);
  }

  if (!user) return null;

  const stepNum = STEPS.indexOf(step);
  const progress = Math.round(((stepNum + 1) / STEPS.length) * 100);

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-light via-white to-amber-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <span>Step {stepNum + 1} of {STEPS.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

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
            <FormField label="Business name" name="businessName" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Industry</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
                <option value="">Select your industry…</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <FormField label="Headline" name="headline" hint="One sentence: what you do + where" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">About your business</label>
              <textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="What makes you different? What types of clients do you serve?" />
            </div>
            <FormField label="Services offered" name="services" hint="Comma-separated" value={services} onChange={(e) => setServices(e.target.value)} />
            <FormField label="Keywords for matching" name="keywords" hint="Comma-separated: roofing, residential, insurance claims" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <FormField label="City" name="city" value={city} onChange={(e) => setCity(e.target.value)} />
              <FormField label="State" name="state" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} />
              <FormField label="ZIP" name="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
            </div>
            <FormField label="Years in business" name="years" type="number" value={years} onChange={(e) => setYears(e.target.value)} />
          </StepCard>
        )}

        {step === 'icp' && (
          <StepCard
            icon={<Users size={20} />}
            title="Who do you WANT to meet?"
            subtitle="The AI will scan the network and suggest introductions to people matching this profile."
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Industries you want to connect with</label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setIcpIndustries((prev) => prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind])}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${icpIndustries.includes(ind) ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'}`}
                  >
                    {icpIndustries.includes(ind) && <Check size={10} className="mr-1 inline" />}
                    {ind}
                  </button>
                ))}
              </div>
            </div>
            <FormField label="Roles you want to meet" name="icpRoles" hint="Comma-separated: agents, brokers, adjusters" value={icpRoles} onChange={(e) => setIcpRoles(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Problems they solve for YOUR clients</label>
              <textarea rows={3} value={icpProblems} onChange={(e) => setIcpProblems(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="One per line:&#10;Homebuyer needs roof inspection&#10;Storm damage insurance claims" />
            </div>
            <FormField label="Typical deal size" name="icpDealSize" hint="e.g. $5K-$25K" value={icpDealSize} onChange={(e) => setIcpDealSize(e.target.value)} />
          </StepCard>
        )}

        {step === 'referrals' && (
          <StepCard
            icon={<ArrowRight size={20} />}
            title="Who can YOU refer business to?"
            subtitle="This completes the two-sided matching engine. When someone in the network needs a pro you can vouch for, the AI connects them through you."
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Industries you regularly refer clients to</label>
              <div className="flex flex-wrap gap-2">
                {INDUSTRIES.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setCanReferIndustries((prev) => prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind])}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${canReferIndustries.includes(ind) ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-gray-700 hover:border-primary'}`}
                  >
                    {canReferIndustries.includes(ind) && <Check size={10} className="mr-1 inline" />}
                    {ind}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">Types of clients you can send them</label>
              <textarea rows={3} value={canReferTypes} onChange={(e) => setCanReferTypes(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="One per line:&#10;Homeowners needing repairs&#10;New construction projects" />
            </div>
          </StepCard>
        )}

        {step === 'video' && (
          <StepCard
            icon={<Video size={20} />}
            title="Record your 60-second intro"
            subtitle="Members are 3x more likely to accept an intro when they can see a face. You can skip this for now and add it later."
          >
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <Video size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="mb-4 text-sm text-gray-600">
                Video upload is coming next. For now, your text profile is enough to start getting matched.
              </p>
              <Button onClick={() => setStep('done')}>Skip for now →</Button>
            </div>
          </StepCard>
        )}

        {step === 'done' && (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <Check size={32} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">You&rsquo;re all set!</h2>
            <p className="mb-6 text-sm text-gray-600">
              The AI is now scanning the network for people you should meet. Check your dashboard for your first suggested introductions.
            </p>
            <Button onClick={() => router.push('/dashboard')}>Go to my dashboard →</Button>
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
            <Button onClick={next} loading={saving} disabled={step === 'business' && (!businessName || !industry)}>
              {step === 'referrals' ? 'Save & continue' : 'Next →'}
            </Button>
          </div>
        )}
      </div>
    </main>
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
