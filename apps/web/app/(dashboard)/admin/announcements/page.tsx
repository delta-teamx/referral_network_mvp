'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, Send, Users } from 'lucide-react';
import { api, ApiError } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth';

/**
 * Founder / team announcements. An admin writes one message; it is delivered to
 * every member's Messages inbox (a one-way "Referral Nova" announcement thread)
 * and their email. It never touches the pipeline or analytics - it's an
 * announcement, not a lead.
 */

interface Broadcast {
  id: string;
  senderName: string;
  senderTitle: string | null;
  subject: string;
  body: string;
  recipientCount: number;
  emailCount: number;
  createdAt: string;
}

export default function AdminAnnouncementsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  const [audience, setAudience] = useState<number | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const [senderName, setSenderName] = useState('');
  const [senderTitle, setSenderTitle] = useState('Founder');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await api.get<{ broadcasts: Broadcast[]; audience: number }>(
        '/api/v1/admin/broadcasts',
        { accessToken },
      );
      setHistory(data.broadcasts);
      setAudience(data.audience);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load announcements.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Default the sender name to the current admin's name once loaded.
  useEffect(() => {
    if (!senderName && user) setSenderName(`${user.firstName} ${user.lastName}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function send() {
    if (!accessToken) return;
    setError(null);
    setSuccess(null);
    if (!senderName.trim() || !subject.trim() || !body.trim()) {
      setError('Sender name, subject, and message are all required.');
      return;
    }
    const count = audience ?? 0;
    const ok = window.confirm(
      `Send this announcement to all ${count} member${count === 1 ? '' : 's'}?\n\n` +
        `It will appear in their Messages inbox and be emailed to them. ` +
        `This does not affect the pipeline or analytics.`,
    );
    if (!ok) return;
    setSending(true);
    try {
      const result = await api.post<{ recipientCount: number; emailCount: number }>(
        '/api/v1/admin/broadcasts',
        {
          senderName: senderName.trim(),
          senderTitle: senderTitle.trim() || undefined,
          subject: subject.trim(),
          body: body.trim(),
        },
        { accessToken },
      );
      setSuccess(
        `Sent to ${result.recipientCount} member${result.recipientCount === 1 ? '' : 's'} ` +
          `(${result.emailCount} emailed).`,
      );
      setSubject('');
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send the announcement.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-6 md:p-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
          <Megaphone size={14} /> Announcements
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Message all members</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">
          Write once — it lands in every member&apos;s Messages inbox as a one-way announcement and
          in their email. It never creates a pipeline lead or shows up in analytics.
        </p>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      {/* Composer */}
      <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-400">
          <Users size={14} className="text-amber-400" />
          {audience === null ? 'Counting members…' : `Reaches all ${audience} members`}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              From (name)
            </span>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Brian Parnel"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Title (optional)
            </span>
            <input
              value={senderTitle}
              onChange={(e) => setSenderTitle(e.target.value)}
              placeholder="Founder"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
            placeholder="A quick update from the team"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Message
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={7}
            placeholder="Write your announcement to the whole community…"
            className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
          />
          <span className="mt-1 block text-right text-[11px] text-gray-600">{body.length}/5000</span>
        </label>

        {/* Live preview of the signature line members will see */}
        {(senderName || subject || body) && (
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Preview
            </p>
            <p className="text-sm font-semibold text-white">📣 {subject || 'Subject'}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">
              {body || 'Your message…'}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              — {senderName || 'Name'}
              {senderTitle ? `, ${senderTitle}` : ''}
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            onClick={() => void send()}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-gray-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Sending…' : 'Send to all members'}
          </button>
        </div>
      </div>

      {/* History */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Sent announcements
      </h2>
      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-gray-900" />
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-500">
          <Megaphone size={28} className="mx-auto mb-3 text-gray-700" />
          <p>No announcements sent yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {history.map((b) => (
            <li key={b.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{b.subject}</p>
                  <p className="text-xs text-gray-400">
                    {b.senderName}
                    {b.senderTitle ? `, ${b.senderTitle}` : ''} ·{' '}
                    {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-800 px-2.5 py-1 text-[11px] font-semibold text-gray-300">
                  {b.recipientCount} in-app · {b.emailCount} emailed
                </span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-gray-300">{b.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
