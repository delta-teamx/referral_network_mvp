'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';

export function SignupPopup() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user || dismissed) return;
    if (status === 'loading' || status === 'idle') return;

    const alreadyShown = sessionStorage.getItem('signup_popup_dismissed');
    if (alreadyShown) {
      setDismissed(true);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [user, dismissed, status]);

  function dismiss() {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem('signup_popup_dismissed', '1');
  }

  if (!visible || user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Sparkles size={24} className="text-primary" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-gray-900">
          Grow your business through AI-matched referrals
        </h2>
        <p className="mb-2 text-sm text-gray-600">
          Join VirtualProsNetwork &mdash; where business owners (local, remote, and international) get warm introductions powered by AI.
        </p>
        <ul className="mb-5 space-y-1.5 text-sm text-gray-600">
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success text-xs">✓</span>
            Free to join — no credit card required
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success text-xs">✓</span>
            AI matches you with complementary businesses worldwide
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success text-xs">✓</span>
            Live Zoom networking pods — meet real people, close real deals
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success text-xs">✓</span>
            Works for local, remote, and international businesses
          </li>
        </ul>

        <div className="flex flex-col gap-2">
          <Link
            href="/signup"
            onClick={dismiss}
            className="w-full rounded-full bg-primary px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            Create free account →
          </Link>
          <button
            onClick={dismiss}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Maybe later
          </button>
        </div>

        <p className="mt-4 text-center text-[10px] text-gray-400">
          Powered by <span className="font-semibold">Referral Nova</span>
        </p>
      </div>
    </div>
  );
}
