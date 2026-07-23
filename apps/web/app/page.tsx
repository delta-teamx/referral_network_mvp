'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  Globe,
  Handshake,
  Network,
  Play,
  Sparkles,
  Star,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { useEffect } from 'react';
import { fadeInUp, staggerContainer } from '../lib/animations';
import { HeroShowcase } from '../components/home/HeroShowcase';
import { FoundingOffer } from '../components/marketing/FoundingOffer';
import { useI18n } from '../lib/i18n';
import { isAppHost } from '../lib/domains';
import { useAuthStore } from '../stores/auth';

export default function HomePage() {
  const { t } = useI18n();
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  // On the app domain (dashboard.referralnova.com) the root is the app entry:
  // send signed-in members straight to their dashboard and everyone else to
  // login. The marketing homepage below only renders on referralnova.com.
  const onAppHost = typeof window !== 'undefined' && isAppHost();
  useEffect(() => {
    if (!onAppHost) return;
    if (status === 'idle') {
      void hydrate();
      return;
    }
    if (status === 'authenticated') window.location.href = '/dashboard';
    else if (status === 'unauthenticated') window.location.href = '/login';
  }, [onAppHost, status, hydrate]);

  if (onAppHost) {
    return <div className="min-h-screen bg-primary-light" />;
  }

  return (
    <>
      {/* ═══ FOUNDING-MEMBER ANNOUNCEMENT BAR ═══ */}
      <FoundingOffer variant="bar" />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-primary/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-blue-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* Left - copy */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeInUp} className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-2 text-sm text-primary">
                <Sparkles size={14} /> {t('hero.badge')}
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="mb-6 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl"
              >
                {t('hero.titleA')}{' '}
                <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  {t('hero.titleHighlight')}
                </span>{' '}
                {t('hero.titleB')}
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="mb-4 max-w-lg text-lg leading-relaxed text-gray-300"
              >
                {t('hero.sub')}
              </motion.p>
              <motion.p
                variants={fadeInUp}
                className="mb-8 max-w-lg text-base leading-relaxed text-gray-400"
              >
                {t('hero.sub2')}
              </motion.p>

              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                <Link
                  href="https://dashboard.referralnova.com/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
                >
                  {t('hero.ctaJoin')} <ArrowRight size={16} />
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/50 px-8 py-4 text-base font-semibold text-gray-200 backdrop-blur transition hover:border-gray-600 hover:bg-gray-800"
                >
                  <Play size={16} /> {t('hero.ctaHow')}
                </Link>
              </motion.div>

              <motion.div variants={fadeInUp} className="mt-10 flex flex-wrap gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" />
                  Free to join
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" />
                  AI matches in seconds
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" />
                  Built-in Zoom booking
                </div>
              </motion.div>
            </motion.div>

            {/* Right - 3D animated showcase */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden md:block"
            >
              <HeroShowcase />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="border-b border-gray-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-6 md:gap-16">
          {[
            { value: '500+', label: 'Active members' },
            { value: '2,400+', label: 'AI introductions made' },
            { value: '87%', label: 'Intro acceptance rate' },
            { value: '$1.2M+', label: 'Deals closed through platform' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-gray-900 md:text-3xl">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PROBLEM / SOLUTION ═══ */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">The problem</p>
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Networking groups are stuck in the 1990s
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              Manual referrals. Memory-based introductions. &ldquo;Who do I know?&rdquo; over
              breakfast. The result: missed connections and lost revenue - every single week.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Brain,
                title: 'Memory-based referrals',
                problem: 'Members forget who needs what. Great matches slip through the cracks.',
                solution: 'AI remembers everyone\'s profile and matches automatically.',
              },
              {
                icon: Users,
                title: 'Manual introductions',
                problem: 'Leaders spend hours coordinating who should meet whom.',
                solution: 'AI generates introduction suggestions with a reason for every match.',
              },
              {
                icon: BarChart3,
                title: 'No tracking or learning',
                problem: 'Nobody knows which introductions led to deals.',
                solution: 'Every outcome is tracked. The AI gets smarter with every closed deal.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                  <Icon size={28} className="mb-4 text-primary" />
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="mb-4 text-sm text-gray-500 line-through decoration-danger/50">{item.problem}</p>
                  <p className="flex items-start gap-2 text-sm font-medium text-gray-900">
                    <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-primary" />
                    {item.solution}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              From sign-up to your first deal in 4 steps
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-4">
            {[
              {
                step: '01',
                icon: Users,
                title: 'Create your profile',
                desc: 'Tell us your business, who you serve, who you want to meet, and who you can refer.',
              },
              {
                step: '02',
                icon: Video,
                title: 'Record your intro',
                desc: 'A 60-second video so members see the person behind the business. AI transcribes it for matching.',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'AI finds your matches',
                desc: 'Our engine scans every member and surfaces the people you should meet - with a reason why.',
              },
              {
                step: '04',
                icon: Calendar,
                title: 'Book & close deals',
                desc: 'Request an intro, book a Zoom call directly from the platform, and track every outcome.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Icon size={28} className="text-primary" />
                  </div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-primary">Step {item.step}</p>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═══ */}
      <section className="bg-gray-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Platform features</p>
            <h2 className="text-3xl font-bold md:text-4xl">
              Everything your network needs to thrive
            </h2>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {[
              { icon: Brain, title: 'AI Matching Engine', desc: '7-factor scoring: industry, ICP alignment, referral compatibility, keywords, location, barter, and more.' },
              { icon: Video, title: 'Video Profiles', desc: '60-second intro videos auto-transcribed by Whisper AI and indexed for smarter matching.' },
              { icon: Calendar, title: 'Direct Booking', desc: 'Set availability, pick a reason, book 30-min Zoom calls directly from any profile.' },
              { icon: Zap, title: 'Smart Introductions', desc: '"You should meet Sarah (Real Estate) - she can refer you clients." Request intros in one click.' },
              { icon: Network, title: 'Live Zoom Events', desc: 'Weekly referral rooms, expert panels, industry meetups. Register and join from the platform.' },
              { icon: Handshake, title: 'Barter Exchange', desc: 'Trade services with other members. "I\'ll do your taxes if you design my website."' },
              { icon: Globe, title: 'White-Label for Groups', desc: 'BNI chapters, Chambers, Masterminds can each run their own branded instance.' },
              { icon: BarChart3, title: 'Deal Tracking & Analytics', desc: 'Track every intro outcome: met, referred, deal closed. See 12-week trend charts.' },
              { icon: Star, title: 'Trust Scores', desc: 'AI-computed reputation: ratings + conversions + network strength + activity. Updated daily.' },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  variants={fadeInUp}
                  className="rounded-2xl border border-gray-800 bg-gray-900 p-6"
                >
                  <Icon size={24} className="mb-3 text-primary" />
                  <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══ FOR GROUPS / WHITE LABEL ═══ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">For organizations</p>
              <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
                Power your networking group with AI
              </h2>
              <p className="mb-6 text-gray-600">
                Whether you run a BNI chapter, a Chamber of Commerce, or a private Mastermind - our
                platform replaces manual referral tracking with an AI engine that never forgets a
                connection.
              </p>
              <ul className="mb-8 space-y-3">
                {[
                  'Your own branded instance with custom logo + colors',
                  'Per-seat or flat-rate billing - you set the price',
                  'Admin dashboard: manage members, approve profiles, create events',
                  'AI generates introductions scoped to YOUR group\'s members',
                  'Zoom events managed from one panel',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/for-groups"
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Learn more for organizations <ArrowRight size={14} />
              </Link>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-primary/5 via-white to-blue-50 p-10 shadow-xl">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
                  <Network size={24} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">STL Referral Nova</p>
                  <p className="text-xs text-gray-500">Powered by Virtual Pros</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Active members', value: '47' },
                  { label: 'AI intros this month', value: '124' },
                  { label: 'Deals closed', value: '18' },
                  { label: 'Avg response time', value: '4 hours' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between rounded-lg bg-white/80 px-4 py-3">
                    <span className="text-sm text-gray-600">{stat.label}</span>
                    <span className="font-bold text-gray-900">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">What members say</p>
            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              Real results from real connections
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                quote: 'The AI suggested I meet a mortgage broker I never would have found. We\'ve closed 6 deals together in 3 months.',
                name: 'Sarah J.',
                role: 'Realtor, St. Louis',
                stars: 5,
              },
              {
                quote: 'We replaced our BNI chapter\'s manual referral sheets with this platform. Introductions went up 300% in the first month.',
                name: 'Marcus D.',
                role: 'Group Leader, Clayton',
                stars: 5,
              },
              {
                quote: 'I booked 4 Zoom calls in my first week - all warm intros from the AI. One turned into a $12K project.',
                name: 'Emma C.',
                role: 'Photographer, STL',
                stars: 5,
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-4 flex gap-1">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mb-6 text-sm italic text-gray-700">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═══ */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Pricing</p>
          <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Start free. Upgrade when deals close.
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-gray-600">
            No credit card required. Every plan includes AI matching, video profiles, and booking.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { name: 'Free', price: '$0', desc: '3 AI intros/month, 1 listing, 2 groups', cta: 'Start free', href: '/signup' },
              { name: 'Pro', price: '$49', desc: '30 intros/month, 3 listings, analytics', cta: 'Upgrade to Pro', href: '/pricing', featured: true },
              { name: 'Premium', price: '$149', desc: 'Unlimited intros, priority ranking, dedicated support', cta: 'Go Premium', href: '/pricing' },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-2xl border p-8 ${
                  p.featured
                    ? 'border-primary bg-primary/5 shadow-xl ring-2 ring-primary'
                    : 'border-gray-200 bg-white shadow-sm'
                }`}
              >
                <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">{p.name}</p>
                <p className="mb-2 text-4xl font-bold text-gray-900">{p.price}<span className="text-base font-normal text-gray-500">/mo</span></p>
                <p className="mb-6 text-sm text-gray-600">{p.desc}</p>
                <Link
                  href={p.href}
                  className={`block w-full rounded-full py-3 text-center text-sm font-semibold transition ${
                    p.featured
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'border border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-gray-500">
            Groups + organizations: <Link href="/for-groups" className="font-semibold text-primary hover:underline">see white-label pricing →</Link>
          </p>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-primary/20 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl px-6">
          <Sparkles size={32} className="mx-auto mb-4 text-primary" />
          <h2 className="mb-4 text-3xl font-bold md:text-5xl">
            Your next referral partner is waiting on Referral Nova
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-gray-300">
            Built by Referral Nova, powered by AI. Sign up, complete your profile, and get your first
            introduction in under 5 minutes - whether you serve clients locally or worldwide.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="https://dashboard.referralnova.com/signup"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary/90"
            >
              Get started free <ArrowRight size={16} />
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800/50 px-8 py-4 text-base font-semibold text-gray-200 backdrop-blur transition hover:border-gray-600"
            >
              <Video size={16} /> Join a live networking event
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
