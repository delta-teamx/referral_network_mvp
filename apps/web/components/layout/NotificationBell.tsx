'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { connectSocket, disconnectSocket, onSocketEvent } from '../../lib/socket';
import { isChimeEnabled, playChime, setChimeEnabled } from '../../lib/chime';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: { ticketId?: string; conversationId?: string } | null;
}

/** Real-time payload pushed by the API when a notification is created. */
interface NotificationEvent {
  notification: Notification;
  unreadCount: number;
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
  pod_invite: '/events',
  support_ticket: '/admin/support',
  support_escalation: '/admin/roul',
  roul_system_request: '/admin/roul',
  roul_reply: '/admin/messages',
  reward: '/dashboard/rewards',
  billing_past_due: '/dashboard/billing',
};

/**
 * Notification bell. The panel stays open until you press the bell again,
 * hit the small ✕, or click anywhere else on the page - it never closes on
 * its own while you're reading inside it. Zoom reminders arrive here (type
 * booking_reminder), not by email.
 */
export function NotificationBell() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [flash, setFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Reflect the persisted mute preference once mounted (localStorage is
  // client-only, so we can't read it during the initial render).
  useEffect(() => {
    setSoundOn(isChimeEnabled());
  }, []);

  // ---- Realtime connection: the bell owns the shared socket -----------------
  // It's always mounted in the authenticated shell (member + admin), so this is
  // the natural place to connect. Reconnects on token rotation, drops on logout.
  useEffect(() => {
    if (!accessToken || !user) {
      disconnectSocket();
      return;
    }
    connectSocket(accessToken);
  }, [accessToken, user]);

  // Fire a desktop/browser notification when the app isn't focused. Silent
  // no-op unless the user granted permission (requested from the bell click).
  function showDesktopNotification(n: Notification) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Don't double-notify when the person is already looking at the tab.
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    try {
      const notif = new Notification(n.title, {
        body: n.body,
        tag: n.id,
        icon: '/nrg-logo.png',
      });
      notif.onclick = () => {
        window.focus();
        const href = TYPE_HREF[n.type];
        if (href) router.push(href as Parameters<typeof router.push>[0]);
        notif.close();
      };
    } catch {
      /* some browsers throw if constructed without a service worker - ignore */
    }
  }

  // ---- Live notifications over the socket -----------------------------------
  useEffect(() => {
    if (!accessToken || !user) return;
    const off = onSocketEvent<NotificationEvent>('notification', (evt) => {
      if (!evt?.notification) return;
      setCount((c) => (typeof evt.unreadCount === 'number' ? evt.unreadCount : c + 1));
      // Prepend to the open panel so it appears without a reload.
      setItems((prev) =>
        prev.some((n) => n.id === evt.notification.id)
          ? prev
          : [evt.notification, ...prev].slice(0, 30),
      );
      playChime();
      showDesktopNotification(evt.notification);
      // Brief visual pulse on the bell.
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1_200);
      // Keep the sidebar red-dots in sync.
      window.dispatchEvent(new Event('rn:notifications-changed'));
    });
    return off;
  }, [accessToken, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Polling fallback (covers reconnect gaps + realtime-disabled builds) --
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
    // Socket delivers instantly; this is just a safety net, so a slower cadence.
    const timer = setInterval(() => void poll(), 60_000);
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
    if (next) {
      void loadItems();
      // Opening the panel is a user gesture - a good moment to ask for desktop
      // notification permission (once) so app-open alerts can pop even when the
      // tab is in the background.
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        void Notification.requestPermission().catch(() => undefined);
      }
    }
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setChimeEnabled(next);
    if (next) playChime(); // preview the sound when turning it on
  }

  // Open the support widget on a specific ticket. The widget lives in the app
  // shell (not on the Messages page or admin), so we stash the ticket id, fire
  // an event for the same-page case, and route to the dashboard so the widget
  // is mounted to pick it up. Works on mobile too (no URL param needed).
  function openSupportThread(ticketId: string) {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('rn-open-support-ticket', ticketId);
      window.dispatchEvent(new CustomEvent('rn:open-support', { detail: { ticketId } }));
    }
    setOpen(false);
    router.push('/dashboard');
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
        className={`relative rounded-full p-2 text-gray-600 transition hover:bg-gray-100 hover:text-primary ${
          flash ? 'animate-bounce text-primary' : ''
        }`}
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
              <button
                onClick={toggleSound}
                className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label={soundOn ? 'Mute notification sound' : 'Unmute notification sound'}
                title={soundOn ? 'Sound on' : 'Sound off'}
              >
                {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
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
                // Precedence: a per-type destination (href) wins. Only fall back
                // to opening the member support widget on a ticket when the type
                // has NO href - i.e. member-facing support pings (admin_message,
                // support_reply). Admin-facing types (support_ticket,
                // support_escalation, roul_system_request) carry a ticketId too
                // but must navigate to their admin page, not the member widget.
                const href = TYPE_HREF[n.type];
                const ticketId = href ? undefined : n.data?.ticketId;
                const isReminder = n.type === 'booking_reminder';
                const isAdmin = n.type === 'admin_message';
                const inner = (
                  <>
                    {isAdmin && (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                        <ShieldCheck size={10} /> ROUL · Admin
                      </span>
                    )}
                    <p
                      className={`text-sm font-medium ${
                        isAdmin ? 'text-gray-900' : isReminder ? 'text-primary' : 'text-gray-900'
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="whitespace-pre-line text-xs text-gray-600">{n.body}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </>
                );
                return (
                  <li
                    key={n.id}
                    className={`border-b border-gray-50 ${
                      isAdmin
                        ? `border-l-2 border-l-blue-500 ${n.isRead ? 'bg-blue-50/40' : 'bg-blue-50'}`
                        : isReminder && !n.isRead
                          ? 'bg-primary-light/50'
                          : n.isRead
                            ? ''
                            : 'bg-primary-light/30'
                    }`}
                  >
                    {ticketId ? (
                      <button
                        onClick={() => openSupportThread(ticketId)}
                        className="block w-full px-4 py-3 text-left transition hover:bg-gray-50"
                      >
                        {inner}
                      </button>
                    ) : href ? (
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
