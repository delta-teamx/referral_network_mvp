'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  Clock,
  Handshake,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Network,
  Settings,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';
import { fadeInUp } from '../../../lib/animations';

type DemoTab = 'overview' | 'ai' | 'analytics' | 'bookings' | 'network' | 'messages';

const TABS: { key: DemoTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'ai', label: 'AI Suggestions', icon: Sparkles },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'bookings', label: 'Bookings', icon: Calendar },
  { key: 'network', label: 'My Network', icon: Network },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
];

const DEMO_METRICS = [
  { label: 'Total views', value: '1,247', trend: '+18%', color: 'text-blue-600' },
  { label: 'Leads received', value: '34', trend: '+12%', color: 'text-emerald-600' },
  { label: 'Referrals sent', value: '18', trend: '+25%', color: 'text-orange-600' },
  { label: 'Avg rating', value: '4.8', trend: '+0.2', color: 'text-amber-500' },
];

const DEMO_AI_MATCHES = [
  { name: 'Sarah Johnson', biz: 'Johnson Realty Group', industry: 'Real Estate', match: 94, reason: 'She needs a CPA for her home-buying clients. You specialize in tax planning for new homeowners.' },
  { name: 'Daniel Rivera', biz: 'Two Rivers CPA', industry: 'Accounting', match: 89, reason: 'His clients need legal contracts for business formation. You handle LLC & corp filings.' },
  { name: 'Maya Chen', biz: 'Stonegate Weddings', industry: 'Wedding Planning', match: 87, reason: 'She refers couples who need prenup consultations. Great cross-referral potential.' },
];

const DEMO_BOOKINGS = [
  { name: 'Sarah Johnson', time: 'Tomorrow, 10:00 AM', reason: 'Referral opportunity', status: 'confirmed' },
  { name: 'Michael Torres', time: 'Wed, May 7, 2:00 PM', reason: 'Partnership discussion', status: 'confirmed' },
  { name: 'Emma Liu', time: 'Thu, May 8, 11:30 AM', reason: 'General introduction', status: 'pending' },
];

const DEMO_CONNECTIONS = [
  { name: 'Sarah Johnson', industry: 'Real Estate', strength: 8.5, since: 'Jan 2026' },
  { name: 'Daniel Rivera', industry: 'Accounting / CPA', strength: 7.2, since: 'Feb 2026' },
  { name: 'Maya Chen', industry: 'Wedding Planning', strength: 6.8, since: 'Mar 2026' },
  { name: 'Emma Liu', industry: 'Photography', strength: 5.4, since: 'Apr 2026' },
];

const DEMO_MESSAGES = [
  { name: 'Sarah Johnson', preview: 'Hey! I have a client looking for exactly what you offer...', time: '2 min ago', unread: true },
  { name: 'Daniel Rivera', preview: 'Thanks for the referral last week! They signed up.', time: '1 hr ago', unread: false },
  { name: 'Maya Chen', preview: 'Can we schedule a call to discuss the partnership?', time: '3 hrs ago', unread: false },
];

export default function DemoPage() {
  const [tab, setTab] = useState<DemoTab>('overview');

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="border-b border-gray-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Interactive Demo</p>
          <h1 className="mb-3 text-3xl font-bold text-gray-900 md:text-4xl">
            Experience VirtualProsNetwork
          </h1>
          <p className="mx-auto mb-6 max-w-2xl text-gray-600">
            Explore the full dashboard with sample data. See AI suggestions, analytics, booking system,
            messaging, and network management - exactly what your members will use.
          </p>
          <Link
            href="https://virtualprosnetwork.com/signup"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Start free - no credit card <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Demo Dashboard */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          {/* Dashboard header */}
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">JD</div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Jane Doe</p>
                <p className="text-xs text-gray-500">Doe Financial Planning · PRO member</p>
              </div>
              <span className="ml-auto rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">DEMO</span>
            </div>
          </div>

          <div className="flex min-h-[600px]">
            {/* Sidebar */}
            <div className="hidden w-52 border-r border-gray-200 bg-gray-50 md:block">
              <nav className="p-3">
                {TABS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                        tab === t.key
                          ? 'bg-primary-light font-semibold text-primary'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} /> {t.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Mobile tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 p-2 md:hidden">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                    tab === t.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              {tab === 'overview' && (
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  <h2 className="mb-1 text-xl font-bold text-gray-900">Welcome back, Jane</h2>
                  <p className="mb-6 text-sm text-gray-500">Your AI-powered referral hub</p>
                  <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {DEMO_METRICS.map((m) => (
                      <div key={m.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-xs text-gray-500">{m.label}</p>
                        <p className="text-2xl font-bold text-gray-900">{m.value}</p>
                        <p className={`text-xs font-semibold ${m.color}`}>{m.trend} this month</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-primary" />
                      <p className="text-sm font-semibold text-gray-900">AI picked 3 matches for you today</p>
                    </div>
                    <p className="text-xs text-gray-600">Based on your ICP, industry, and referral history. Check the AI Suggestions tab.</p>
                  </div>
                </motion.div>
              )}

              {tab === 'ai' && (
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  <h2 className="mb-1 text-xl font-bold text-gray-900">AI Suggestions</h2>
                  <p className="mb-6 text-sm text-gray-500">People you should meet this week</p>
                  <div className="space-y-4">
                    {DEMO_AI_MATCHES.map((m) => (
                      <div key={m.name} className="rounded-xl border border-gray-200 p-5">
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{m.name}</p>
                            <p className="text-xs text-gray-500">{m.biz} · {m.industry}</p>
                          </div>
                          <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">{m.match}% match</span>
                        </div>
                        <div className="mb-3 rounded-lg bg-blue-50 px-3 py-2">
                          <p className="flex items-start gap-2 text-sm text-blue-900">
                            <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                            {m.reason}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">Request intro</button>
                          <button className="rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-600">View profile</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'analytics' && (
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  <h2 className="mb-1 text-xl font-bold text-gray-900">Analytics</h2>
                  <p className="mb-6 text-sm text-gray-500">12-week activity breakdown</p>
                  <div className="mb-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-primary" />
                        <h3 className="font-semibold text-gray-900">Leads & Conversions</h3>
                      </div>
                      <div className="flex items-end gap-1 h-32">
                        {[4,6,3,8,5,10,7,12,9,14,11,16].map((v, i) => (
                          <div key={i} className="flex-1 rounded-t bg-primary/20" style={{ height: `${(v / 16) * 100}%` }}>
                            <div className="rounded-t bg-primary" style={{ height: `${(v * 0.6 / 16) * 100}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/20" /> Leads</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Converted</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <Star size={16} className="text-amber-500" />
                        <h3 className="font-semibold text-gray-900">Rating Distribution</h3>
                      </div>
                      {[5,4,3,2,1].map((star) => (
                        <div key={star} className="mb-1 flex items-center gap-2 text-sm">
                          <span className="w-3 text-gray-600">{star}</span>
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          <div className="h-2 flex-1 rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${star === 5 ? 72 : star === 4 ? 20 : star === 3 ? 5 : star === 2 ? 2 : 1}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {tab === 'bookings' && (
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  <h2 className="mb-1 text-xl font-bold text-gray-900">Zoom Bookings</h2>
                  <p className="mb-6 text-sm text-gray-500">Upcoming calls with auto-generated Zoom links</p>
                  <div className="space-y-3">
                    {DEMO_BOOKINGS.map((b) => (
                      <div key={b.name} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                        <div>
                          <p className="font-semibold text-gray-900">{b.name}</p>
                          <p className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock size={12} /> {b.time} · {b.reason}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {b.status}
                          </span>
                          <button className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                            <Video size={10} /> Join Zoom
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'network' && (
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  <h2 className="mb-1 text-xl font-bold text-gray-900">My Network</h2>
                  <p className="mb-6 text-sm text-gray-500">Your referral connections and strength scores</p>
                  <div className="space-y-3">
                    {DEMO_CONNECTIONS.map((c) => (
                      <div key={c.name} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                        <div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.industry}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">Strength {c.strength}</span>
                          <span className="text-gray-400 text-xs">since {c.since}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'messages' && (
                <motion.div variants={fadeInUp} initial="hidden" animate="visible">
                  <h2 className="mb-1 text-xl font-bold text-gray-900">Messages</h2>
                  <p className="mb-6 text-sm text-gray-500">In-app messaging with your connections</p>
                  <div className="space-y-1">
                    {DEMO_MESSAGES.map((m) => (
                      <div key={m.name} className={`flex items-start gap-3 rounded-xl p-4 ${m.unread ? 'bg-primary-light/30' : 'hover:bg-gray-50'}`}>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {m.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm ${m.unread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{m.name}</p>
                            <span className="text-xs text-gray-400">{m.time}</span>
                          </div>
                          <p className="truncate text-xs text-gray-500">{m.preview}</p>
                        </div>
                        {m.unread && <span className="mt-2 h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Demo footer */}
          <div className="border-t border-gray-200 bg-gradient-to-r from-primary/5 to-amber-50 px-6 py-4 text-center">
            <p className="mb-2 text-sm font-semibold text-gray-900">This is a live preview. Ready to try it for real?</p>
            <Link
              href="https://virtualprosnetwork.com/signup"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Create your free account <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
