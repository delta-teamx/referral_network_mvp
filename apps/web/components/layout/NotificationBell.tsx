'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
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

export function NotificationBell() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

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

  async function loadAndOpen() {
    if (!accessToken) return;
    setOpen(!open);
    if (!open) {
      try {
        const data = await api.get<Notification[]>('/api/v1/notifications', {
          accessToken: accessToken ?? undefined,
        });
        setItems(data);
      } catch {
        /* silent */
      }
    }
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
    <div className="relative">
      <button
        onClick={() => void loadAndOpen()}
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
            {count > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check size={10} /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-gray-500">No notifications yet</li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-gray-50 px-4 py-3 ${n.isRead ? '' : 'bg-primary-light/30'}`}
                >
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-600">{n.body}</p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </li>
              ))
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
