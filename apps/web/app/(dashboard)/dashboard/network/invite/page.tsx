'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Copy, Mail } from 'lucide-react';
import { fadeInUp } from '../../../../../lib/animations';
import { api, ApiError } from '../../../../../lib/api';
import { useAuthStore } from '../../../../../stores/auth';
import { Button } from '../../../../../components/ui/Button';
import { FormField } from '../../../../../components/ui/FormField';

interface InvitationResult {
  id: string;
  token: string;
  recipientEmail: string;
  status: string;
}

export default function InvitePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<InvitationResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    setSending(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      recipientEmail: String(form.get('recipientEmail') ?? '').trim(),
      message: String(form.get('message') ?? '').trim() || undefined,
    };
    try {
      const inv = await api.post<InvitationResult>('/api/v1/invitations', payload, {
        accessToken,
      });
      setSent(inv);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invite failed');
    } finally {
      setSending(false);
    }
  }

  const inviteUrl =
    typeof window !== 'undefined' && sent
      ? `${window.location.origin}/invite?token=${sent.token}`
      : sent
        ? `/invite?token=${sent.token}`
        : '';

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/dashboard/network"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <ArrowLeft size={14} /> Back to network
      </Link>

      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Grow</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Invite a business</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Every invite you send seeds a mutual connection as soon as they sign up. Your trust score
          lifts a bit every time someone in your network converts a referral.
        </p>
      </header>

      {sent ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="max-w-2xl rounded-2xl border border-success/30 bg-success/5 p-6"
        >
          <div className="mb-3 flex items-center gap-2 font-semibold text-success">
            <Check size={18} /> Invitation {sent.status === 'accepted' ? 'auto-accepted' : 'ready'}
          </div>
          {sent.status === 'accepted' ? (
            <p className="mb-4 text-sm text-gray-700">
              <strong>{sent.recipientEmail}</strong> already has an account — we sent them a
              connection request instead. Check your pending connections.
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-700">
                Share this link with <strong>{sent.recipientEmail}</strong>. When they visit and
                sign up, you&rsquo;ll auto-connect.
              </p>
              <div className="mb-4 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-700">
                <span className="flex-1 truncate">{inviteUrl}</span>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-white"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setSent(null)}>
              Send another
            </Button>
            <Link
              href="/dashboard/network"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              View my network →
            </Link>
          </div>
        </motion.div>
      ) : (
        <motion.form
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          onSubmit={onSubmit}
          className="max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <FormField
            label="Recipient email"
            name="recipientEmail"
            type="email"
            required
            hint="We'll send them a personal invite link."
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-900">
              Personal note (optional)
            </label>
            <textarea
              name="message"
              rows={4}
              maxLength={500}
              placeholder="Hey Alex — you'd be a great fit for our referral network. No cost, 5 min to sign up."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Max 500 characters.</p>
          </div>

          {error && (
            <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" loading={sending}>
            <Mail size={14} className="mr-2" /> Send invitation
          </Button>
        </motion.form>
      )}
    </div>
  );
}
