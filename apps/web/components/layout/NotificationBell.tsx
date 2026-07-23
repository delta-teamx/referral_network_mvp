'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

/** Where each notification type takes you when clicked. */
const TYPE_HREF: Record<string, string> = {
  message: '/dashboard/messages',
  intro_accepted: '/dashboard/messages',
  intro_request: '/dashboard/leads',
  referral: '/dashboard/referrals',
  contract: '/dashboard/referrals',
  booking_request: '/dashboard/bookings',
  booking_confirmed: '/dashboard/bookings',
  booking_declined: '/dashboard/bookings',
  booking_reminder: '/dashboard/bookings',
  support_ticket: '/admin/support',
};

/**
 * Notification bell. The panel stays open until you press the bell again,
 * hit the small ✕, or click anywhere else on the page — it never closes on
 * its own while you're reading inside it. Zoom reminders arrive here (type
 * booking_reminder), not by email.
 */
export function NotificationBell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken || !user) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await api.get<{ count: number }>('/api/v1/notifications/unread-count', {
          accessToken: accessToken ?? undefined,
        });
        if (!cancelled) setCount(res.count);
      } catch {
        /* silent */
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 30_000);
    // Instant refresh when the app marks notifications read (tab opened).
    const onChanged = () => void poll();
    window.addEventListener('rn:notifications-changed', onChanged);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('rn:notifications-changed', onChanged);
    };
  }, [accessToken, user]);

  // Clicking anywhere outside the bell/panel closes it.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function loadItems() {
    if (!accessToken) return;
    try {
      const data = await api.get<Notification[]>('/api/v1/notifications', {
        accessToken: accessToken ?? undefined,
      });
      setItems(data);
    } catch {
      /* silent */
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadItems();
  }

  async function markAllRead() {
    if (!accessToken) return;
    try {
      await api.post('/api/v1/notifications/read-all', {}, { accessToken: accessToken ?? undefined });
      setCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      /* silent */
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={toggle}
        className="relative rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-primary"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Check size={10} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close notifications"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-gray-500">No notifications yet</li>
            ) : (
              items.map((n) => {
                const href = TYPE_HREF[n.type];
                const isReminder = n.type === 'booking_reminder';
                const inner = (
                  <>
                    <p className={`text-sm font-medium ${isReminder ? 'text-primary' : 'text-gray-900'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-600">{n.body}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </>
                );
                return (
                  <li
                    key={n.id}
                    className={`border-b border-gray-50 ${
                      isReminder && !n.isRead
                        ? 'bg-primary-light/50'
                        : n.isRead
                          ? ''
                          : 'bg-primary-light/30'
                    }`}
                  >
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition hover:bg-gray-50"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-gray-50"
          >
            View dashboard →
          </Link>
        </div>
      )}
    </div>
  );
}
