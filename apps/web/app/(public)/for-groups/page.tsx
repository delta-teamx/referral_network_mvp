'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  Palette,
  LayoutDashboard,
  Video,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
  Image,
  Type,
  MessageSquare,
  CreditCard,
  Check,
  ArrowRight,
  Sparkles,
  Building2,
  Globe,
  Award,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { useState, FormEvent } from 'react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const groupBenefits = [
  {
    icon: Globe,
    title: 'Branded Instance',
    description: 'Your own Referral Nova hub with your logo, colors, and welcome message. Members see your brand first.',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin Dashboard',
    description: 'Manage members, monitor engagement, view match activity, and export reports - all from a single control panel.',
  },
  {
    icon: Brain,
    title: 'AI Matching Scoped to Your Group',
    description: 'Run the 7-factor matching engine within your membership base, or open it up to the wider network.',
  },
  {
    icon: Video,
    title: 'Zoom Event Management',
    description: 'Schedule group meetings, generate Zoom links, send automated reminders, and track attendance.',
  },
  {
    icon: ShieldCheck,
    title: 'Member Verification',
    description: 'Approve or reject applicants before they join. Set criteria like industry, location, or membership tier.',
  },
  {
    icon: BarChart3,
    title: 'Referral Analytics',
    description: 'See how many intros, meetings, and deals flow through your network. Prove ROI to your members.',
  },
];

const whiteLabelFeatures = [
  { icon: Image, title: 'Custom Logo', description: 'Upload your organization logo. It appears on the member portal, emails, and Zoom invites.' },
  { icon: Palette, title: 'Brand Colors', description: 'Set primary and accent colors to match your brand identity across the entire platform.' },
  { icon: MessageSquare, title: 'Welcome Message', description: 'Greet new members with a personalized onboarding message from your leadership team.' },
  { icon: CreditCard, title: 'Billing Control', description: 'Choose to cover the cost for all members, pass it through, or offer a subsidized rate.' },
];

const perSeatTier = {
  name: 'Per-Seat',
  price: '$10 - $30',
  unit: '/ user / month',
  description: 'Pay only for active members. Perfect for groups that are still growing.',
  features: [
    'Full AI matching per member',
    'Admin dashboard & analytics',
    'White-label branding',
    'Zoom event scheduling',
    'Priority email support',
  ],
};

const flatRateTier = {
  name: 'Flat-Rate',
  price: '$99 - $499',
  unit: '/ month',
  description: 'Predictable pricing for established organizations. Includes unlimited seats at higher tiers.',
  features: [
    'Everything in Per-Seat',
    'Unlimited members (Premium tier)',
    'Custom onboarding flow',
    'Dedicated account manager',
    'API access for integrations',
  ],
};

const socialProofOrgs = [
  'Regional BNI Chapters',
  'Chamber of Commerce Networks',
  'Mastermind Groups',
  'Women in Business Associations',
  'Industry Trade Groups',
  'Startup Founder Circles',
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ForGroupsPage() {
  const [formData, setFormData] = useState({ name: '', email: '', orgName: '', groupSize: '' });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // In production this would POST to an API endpoint
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-white">
      {/* ---- Hero ---- */}
      <section className="bg-gradient-to-br from-white via-primary-light/30 to-amber-50 px-6 py-24 text-center">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            For Groups
          </motion.p>
          <motion.h1 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            Power your networking group with AI
          </motion.h1>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Whether you run a BNI chapter, a Chamber of Commerce, or a private mastermind, Referral Nova
            gives your members AI-powered referral matching, Zoom scheduling, and analytics - under your brand.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-block rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary/90"
            >
              Start your free trial
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
            >
              Request a demo <ArrowRight size={16} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ---- What You Get as a Group ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Platform Features
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            What you get as a group
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 max-w-2xl text-gray-600">
            A turnkey platform that makes your networking organization smarter, more engaging, and easier to manage.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {groupBenefits.map((b) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{b.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* ---- White-Label ---- */}
      <section className="bg-gray-950 px-6 py-20 text-white">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-6xl"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Branding
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold md:text-4xl">
            White-label your network
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 max-w-2xl text-gray-400">
            Your members see your brand, not ours. Customize the look, feel, and messaging so the platform feels
            like a natural extension of your organization.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            {whiteLabelFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <h4 className="font-semibold">{f.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* ---- Group Pricing ---- */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.p variants={fadeInUp} className="text-center text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            Group pricing
          </motion.h2>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            Two flexible models so you can pick the one that fits your organization. Volume discounts available for
            large networks.
          </motion.p>

          <motion.div variants={staggerContainer} className="mt-12 grid gap-8 md:grid-cols-2">
            {[perSeatTier, flatRateTier].map((tier) => (
              <motion.div
                key={tier.name}
                variants={fadeInUp}
                className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
              >
                <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{tier.name}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-sm text-gray-500">{tier.unit}</span>
                </div>
                <p className="mt-3 text-sm text-gray-600">{tier.description}</p>
                <ul className="my-6 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check size={14} className="mt-0.5 flex-shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="#demo"
                  className="block w-full rounded-full bg-primary py-3 text-center text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Request a demo
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <motion.p variants={fadeInUp} className="mt-6 text-center text-sm text-gray-500">
            Need a custom plan for 500+ members?{' '}
            <Link href="#demo" className="text-primary underline hover:text-primary/80">
              Talk to sales
            </Link>
          </motion.p>
        </motion.div>
      </section>

      {/* ---- Request a Demo ---- */}
      <section id="demo" className="bg-gray-50 px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-2xl"
        >
          <motion.p variants={fadeInUp} className="text-center text-xs font-semibold uppercase tracking-wider text-primary">
            Get Started
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-center text-3xl font-bold text-gray-900 md:text-4xl">
            Request a demo
          </motion.h2>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-lg text-center text-gray-600">
            See how Referral Nova can transform your networking group. Fill out the form and we will be in
            touch within one business day.
          </motion.p>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-10 rounded-2xl border border-green-200 bg-green-50 p-8 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check size={24} className="text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Thank you!</h3>
              <p className="mt-2 text-sm text-gray-600">
                We received your request. A member of our team will reach out within one business day.
              </p>
            </motion.div>
          ) : (
            <motion.form
              variants={fadeInUp}
              onSubmit={handleSubmit}
              className="mt-10 space-y-5 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
            >
              <div>
                <label htmlFor="demo-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Your name
                </label>
                <input
                  id="demo-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label htmlFor="demo-email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="jane@organization.com"
                />
              </div>
              <div>
                <label htmlFor="demo-org" className="mb-1 block text-sm font-medium text-gray-700">
                  Organization name
                </label>
                <input
                  id="demo-org"
                  type="text"
                  required
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Acme Networking Chapter"
                />
              </div>
              <div>
                <label htmlFor="demo-size" className="mb-1 block text-sm font-medium text-gray-700">
                  Estimated group size
                </label>
                <input
                  id="demo-size"
                  type="text"
                  required
                  value={formData.groupSize}
                  onChange={(e) => setFormData({ ...formData, groupSize: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. 50 members"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary/90"
              >
                Request a demo
              </button>
            </motion.form>
          )}
        </motion.div>
      </section>

      {/* ---- Social Proof ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="text-center"
        >
          <motion.div variants={fadeInUp} className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Award size={14} /> Social Proof
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold text-gray-900 md:text-4xl">
            Trusted by 20+ networking organizations
          </motion.h2>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-gray-600">
            From local BNI chapters to national industry associations, group leaders rely on Referral Nova to
            keep their members engaged and referring.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {socialProofOrgs.map((org) => (
              <motion.div
                key={org}
                variants={fadeInUp}
                className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 size={20} className="text-primary" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{org}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ---- CTA ---- */}
      <section className="bg-gradient-to-br from-primary/5 via-white to-amber-50 px-6 py-20 text-center">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mx-auto max-w-2xl"
        >
          <motion.div variants={fadeInUp} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles size={14} /> Get Started
          </motion.div>
          <motion.h2 variants={fadeInUp} className="text-3xl font-bold text-gray-900 md:text-4xl">
            Start your free trial
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-gray-600">
            Launch your AI-powered networking group in minutes. No credit card required.
            See the difference intelligent matching makes for member engagement and referral volume.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-block rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary/90"
            >
              Start your free trial
            </Link>
            <Link
              href="#demo"
              className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
            >
              Request a demo <ArrowRight size={16} />
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
