'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  UserPlus,
  Video,
  Brain,
  CalendarCheck,
  Layers,
  Target,
  Repeat2,
  FileText,
  MapPin,
  ArrowLeftRight,
  AudioLines,
  Send,
  CalendarClock,
  BarChart3,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { fadeInUp, staggerContainer } from '../../../lib/animations';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const steps = [
  {
    icon: UserPlus,
    number: '01',
    title: 'Create Your Profile',
    description:
      'Tell us about your business, your ideal client, and the services you offer. Our guided wizard takes under 5 minutes and captures everything the AI needs to find your perfect referral partners.',
    visual: ['Business name & category', 'Ideal Client Profile (ICP)', 'Services & specialties', 'Barter / trade preferences'],
  },
  {
    icon: Video,
    number: '02',
    title: 'Record a 60-Second Video',
    description:
      'A short intro video lets other members see the person behind the business. Our AI also transcribes your video to surface keywords and context that text fields alone would miss.',
    visual: ['Webcam or upload', 'AI-powered transcription', 'Auto keyword extraction', 'Builds instant trust'],
  },
  {
    icon: Brain,
    number: '03',
    title: 'AI Matches You Automatically',
    description:
      'Our 7-factor matching engine continuously scans the network, scoring every possible connection on industry fit, ICP overlap, referral potential, and more. You wake up to a curated feed every morning.',
    visual: ['7-factor scoring engine', 'Daily match digest', 'Ranked by fit quality', 'Improves over time'],
  },
  {
    icon: CalendarCheck,
    number: '04',
    title: 'Book & Close',
    description:
      'Found a strong match? Send an intro request. Once accepted, book a Zoom call right inside Referral Nova. After the call, log the outcome so the AI can learn and refine future matches.',
    visual: ['One-click intro request', 'Built-in Zoom scheduling', 'Outcome tracking', 'Smarter matches over time'],
  },
];

const matchingFactors = [
  { icon: Layers, title: 'Industry Alignment', description: 'Pairs businesses in complementary verticals that naturally refer to each other.' },
  { icon: Target, title: 'ICP Matching', description: 'Compares your ideal client profile with what the other member actually serves.' },
  { icon: Repeat2, title: 'Referral Compatibility', description: 'Measures the likelihood both sides can send high-quality referrals back and forth.' },
  { icon: FileText, title: 'Keyword Overlap', description: 'Analyzes services, specialties, and profile text for semantic similarity.' },
  { icon: MapPin, title: 'Location Proximity', description: 'Factors in geography when local presence matters for the referral.' },
  { icon: ArrowLeftRight, title: 'Barter Exchange', description: 'Identifies members open to trading services, creating win-win value exchanges.' },
  { icon: AudioLines, title: 'Video Transcript Analysis', description: 'Extracts context, tone, and niche expertise from your recorded intro video.' },
];

const afterMatch = [
  { icon: Send, title: 'Intro Request', description: 'Send a personal note along with your profile. The recipient reviews your info before deciding to connect.' },
  { icon: CalendarClock, title: 'Zoom Booking', description: 'Once accepted, pick a mutual time and jump on a video call — no third-party scheduler needed.' },
  { icon: BarChart3, title: 'Outcome Tracking', description: 'After the call, tag the result: referral given, partnership formed, or follow-up needed. This data trains the AI.' },
];

const faqs = [
  {
    q: 'Is Referral Nova free to join?',
    a: 'Yes. The Free plan gives you a profile, up to 3 qualified leads per month, and access to 2 networking groups. Upgrade anytime to unlock more matches and premium features.',
  },
  {
    q: 'How does the AI know who to match me with?',
    a: 'Our 7-factor engine evaluates industry alignment, ICP overlap, referral compatibility, keyword similarity, location, barter interest, and your video transcript. It improves with every outcome you log.',
  },
  {
    q: 'Do I have to record a video?',
    a: 'It is strongly recommended. Members with videos receive 3x more intro requests. However, you can still participate and get matched based on your text profile alone.',
  },
  {
    q: 'Can I use Referral Nova with my existing BNI or networking group?',
    a: 'Absolutely. Group admins can create a branded instance and invite members. AI matching can be scoped to your group, your region, or the entire network.',
  },
  {
    q: 'How is this different from LinkedIn?',
    a: 'LinkedIn is a broad social network. Referral Nova is purpose-built for B2B referrals — every feature, from matching to scheduling, is designed to turn connections into revenue.',
  },
  {
    q: 'What happens to my data?',
    a: 'Your data is encrypted at rest and in transit. We never sell your information. You can export or delete your profile at any time from your account settings.',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div variants={fadeInUp} className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-gray-900">{q}</span>
        <ChevronDown
          size={20}
          className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="pb-5 text-sm leading-relaxed text-gray-600"
        >
          {a}
        </motion.p>
      )}
    </motion.div>
  );
}

export default function HowItWorksPage() {
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
            How It Works
          </motion.p>
          <motion.h1 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            How Referral Nova Works
          </motion.h1>
          <motion.p variants={fadeInUp} className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            From sign-up to signed deal in four simple steps. Our AI does the matchmaking so you can focus on
            building relationships that generate revenue.
          </motion.p>
        </motion.div>
      </section>

      {/* ---- 4-Step Walkthrough ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="space-y-16"
        >
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isEven = i % 2 === 0;
            return (
              <motion.div
                key={step.number}
                variants={fadeInUp}
                className={`flex flex-col items-center gap-10 md:flex-row ${!isEven ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Text */}
                <div className="flex-1 space-y-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Step {step.number}
                  </span>
                  <h3 className="text-2xl font-bold text-gray-900">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </div>

                {/* Visual card */}
                <div className="flex-1">
                  <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Icon size={24} className="text-primary" />
                    </div>
                    <ul className="space-y-3">
                      {step.visual.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ---- The AI Behind the Matches ---- */}
      <section className="bg-gray-950 px-6 py-20 text-white">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-6xl"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            Matching Engine
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold md:text-4xl">
            The AI Behind the Matches
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 max-w-2xl text-gray-400">
            Every potential connection is scored across seven dimensions. The result is a ranked feed of people who
            can actually move the needle for your business.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {matchingFactors.map((factor) => {
              const Icon = factor.icon;
              return (
                <motion.div
                  key={factor.title}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <h4 className="font-semibold">{factor.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{factor.description}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* ---- What Happens After a Match ---- */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            After a Match
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            What happens after a match?
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 max-w-2xl text-gray-600">
            A match is just the beginning. Here is how Referral Nova guides you from introduction to outcome.
          </motion.p>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {afterMatch.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon size={18} className="text-primary" />
                    <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="bg-gray-50 px-6 py-20">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mx-auto max-w-3xl"
        >
          <motion.p variants={fadeInUp} className="text-xs font-semibold uppercase tracking-wider text-primary">
            FAQ
          </motion.p>
          <motion.h2 variants={fadeInUp} className="mt-3 text-3xl font-bold text-gray-900 md:text-4xl">
            Frequently Asked Questions
          </motion.h2>

          <div className="mt-10">
            {faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ---- CTA ---- */}
      <section className="px-6 py-20 text-center">
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
            Ready to get matched?
          </motion.h2>
          <motion.p variants={fadeInUp} className="mt-4 text-gray-600">
            Join thousands of business owners who are growing revenue through AI-powered referrals — no cold calls, no awkward mixers.
          </motion.p>
          <motion.div variants={fadeInUp} className="mt-8">
            <Link
              href="/signup"
              className="inline-block rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-primary/90"
            >
              Join free
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
