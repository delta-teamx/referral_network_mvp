'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Calendar,
  Handshake,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Users,
  Video,
} from 'lucide-react';

const SLIDES = [
  {
    id: 'ai-match',
    icon: Brain,
    accent: 'from-blue-500 to-cyan-400',
    glow: 'bg-blue-500/20',
    title: 'AI Matching',
    subtitle: 'Instantly matched',
    mockup: (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/30 text-sm font-bold text-blue-300">SJ</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Sarah Johnson</p>
            <p className="text-xs text-gray-400">Real Estate Agent</p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">92% match</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/30 text-sm font-bold text-purple-300">DR</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Daniel Reyes</p>
            <p className="text-xs text-gray-400">CPA / Accountant</p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">87% match</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/30 text-sm font-bold text-amber-300">MP</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Maya Patel</p>
            <p className="text-xs text-gray-400">Wedding Planner</p>
          </div>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">81% match</span>
        </div>
      </div>
    ),
  },
  {
    id: 'zoom-call',
    icon: Video,
    accent: 'from-violet-500 to-purple-400',
    glow: 'bg-violet-500/20',
    title: 'Zoom Meetings',
    subtitle: 'Auto-generated links',
    mockup: (
      <div className="space-y-3">
        <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Upcoming call</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">Confirmed</span>
          </div>
          <p className="text-sm font-semibold text-white">Partnership Discussion</p>
          <p className="mt-1 text-xs text-gray-400">with Sarah Johnson · Tomorrow 10:00 AM</p>
          <div className="mt-3 flex gap-2">
            <div className="flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1.5 text-[10px] font-semibold text-blue-300">
              <Video size={10} /> Join Zoom
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-gray-300">
              <Calendar size={10} /> Add to Cal
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
          <p className="text-sm font-semibold text-white">Referral Exchange</p>
          <p className="mt-1 text-xs text-gray-400">with Daniel Reyes · Fri 2:00 PM</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 bg-violet-500" />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'referrals',
    icon: Handshake,
    accent: 'from-emerald-500 to-green-400',
    glow: 'bg-emerald-500/20',
    title: 'Smart Referrals',
    subtitle: 'AI-powered introductions',
    mockup: (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">AI Suggestion</span>
          </div>
          <p className="text-sm text-white">&ldquo;Sarah needs a roofer for her client - you do residential roofing in her area.&rdquo;</p>
          <div className="mt-3 flex gap-2">
            <div className="rounded-full bg-emerald-500/30 px-3 py-1.5 text-[10px] font-bold text-emerald-300">Request Intro</div>
            <div className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-gray-300">Save for later</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <Handshake size={16} className="text-amber-400" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-white">Deal closed: $12,500</p>
            <p className="text-[10px] text-gray-400">via intro from Daniel Reyes</p>
          </div>
          <TrendingUp size={14} className="text-emerald-400" />
        </div>
      </div>
    ),
  },
  {
    id: 'network',
    icon: Users,
    accent: 'from-amber-500 to-orange-400',
    glow: 'bg-amber-500/20',
    title: 'Live Events',
    subtitle: 'Weekly Zoom networking',
    mockup: (
      <div className="space-y-3">
        <div className="rounded-xl bg-white/10 p-4 backdrop-blur">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Live now</span>
          </div>
          <p className="text-sm font-semibold text-white">Tuesday Morning Referrals</p>
          <p className="mt-1 text-xs text-gray-400">18 members · 42 min remaining</p>
          <div className="mt-3 flex -space-x-2">
            {['SJ', 'DR', 'MP', 'EC', '+6'].map((init, i) => (
              <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-900 text-[10px] font-bold ${i === 4 ? 'bg-gray-700 text-gray-300' : 'bg-primary/30 text-primary'}`}>
                {init}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
          <MessageSquare size={14} className="text-amber-400" />
          <div className="flex-1">
            <p className="text-xs text-white">&ldquo;Great session! Got 3 warm intros.&rdquo;</p>
            <p className="text-[10px] text-gray-500">- Maya P.</p>
          </div>
        </div>
      </div>
    ),
  },
];

export function HeroShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % SLIDES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[active]!;
  const Icon = slide.icon;

  return (
    <div className="relative" style={{ perspective: '1200px' }}>
      {/* Ambient glow */}
      <div className={`absolute -inset-8 rounded-3xl ${slide.glow} blur-3xl transition-colors duration-1000`} />

      {/* 3D tilted card */}
      <div
        className="relative"
        style={{
          transform: 'rotateY(-8deg) rotateX(4deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="rounded-2xl border border-white/10 bg-gray-900/80 p-6 shadow-2xl backdrop-blur-xl"
          >
            {/* Card header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${slide.accent} shadow-lg`}>
                  <Icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{slide.title}</p>
                  <p className="text-[10px] text-gray-400">{slide.subtitle}</p>
                </div>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5">
                <Sparkles size={10} className="text-primary" />
              </div>
            </div>

            {/* Card content */}
            {slide.mockup}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Slide indicators */}
      <div className="mt-6 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-8 bg-primary' : 'w-1.5 bg-gray-700 hover:bg-gray-600'
            }`}
            aria-label={s.title}
          />
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute -right-4 top-8 h-3 w-3 animate-pulse rounded-full bg-primary/40" />
      <div className="absolute -left-6 bottom-16 h-2 w-2 animate-pulse rounded-full bg-blue-400/30" style={{ animationDelay: '1s' }} />
      <div className="absolute right-12 -bottom-4 h-2 w-2 animate-pulse rounded-full bg-emerald-400/30" style={{ animationDelay: '2s' }} />
    </div>
  );
}
