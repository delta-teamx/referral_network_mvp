'use client';

import Link from 'next/link';
import { Calendar, Clock, Mail, MessageSquare, Sparkles, UserCheck, Video } from 'lucide-react';

const STEPS = [
  {
    icon: <UserCheck className="h-5 w-5" />,
    title: 'Polish your profile',
    body: 'Other members will only refer you if they can describe what you do. Add a clear headline, the industries you serve, your ideal client, and a short video intro if you have one.',
    href: '/dashboard/settings',
    cta: 'Edit profile',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Set your availability',
    body: 'When an intro request is accepted, we auto-book a Zoom call at the earliest mutual slot. We can only do that if you have weekly availability windows set.',
    href: '/dashboard/availability',
    cta: 'Set availability',
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: 'Review your first 10 matches',
    body: 'Our scoring engine has already curated your first 10 referrals. Each comes with a score, a reason, and a per-signal breakdown. Hit Request intro on anyone interesting.',
    href: '/dashboard/matches',
    cta: 'View matches',
  },
];

const PERKS = [
  { icon: <Sparkles className="h-4 w-4" />, label: '10 curated matches per month for your first 3 months' },
  { icon: <Mail className="h-4 w-4" />, label: 'Weekly digest of new high-fit matches every Monday' },
  { icon: <MessageSquare className="h-4 w-4" />, label: 'Automatic SMS + email when you request an intro' },
  { icon: <Video className="h-4 w-4" />, label: 'Auto-booked Zoom call at the earliest mutual slot' },
  { icon: <Calendar className="h-4 w-4" />, label: 'Activity dashboard tracking every intro and meeting' },
];

export default function WelcomePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Welcome to NRG</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          A referral-first network. Here&apos;s how to get the most out of your first month.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Your first three steps
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <article key={step.title} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-primary">
                {step.icon}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.body}</p>
              <Link
                href={step.href}
                className="mt-4 inline-block rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
              >
                {step.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
          What you get from your membership
        </h2>
        <ul className="space-y-2 text-sm text-gray-700">
          {PERKS.map((perk) => (
            <li key={perk.label} className="flex items-start gap-2">
              <span className="mt-0.5 text-primary">{perk.icon}</span>
              {perk.label}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-gray-500">
        Questions? Reply to the welcome packet email — we read every one.
      </p>
    </div>
  );
}
