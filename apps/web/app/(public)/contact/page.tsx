'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Mail, MessageSquare } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    // In production this would POST to a contact endpoint. For now, a simple UX stub.
    await new Promise((r) => setTimeout(r, 600));
    setSent(true);
    setSending(false);
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Contact</p>
        <h1 className="mt-2 mb-6 text-4xl font-bold text-gray-900">Get in touch</h1>
        <p className="mb-10 text-lg text-gray-600">
          Questions about the platform, partnerships, or white-label licensing for your
          networking group? We&rsquo;d love to hear from you.
        </p>

        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="mb-8">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Mail size={18} />
                <h3 className="font-semibold">Email</h3>
              </div>
              <p className="text-gray-700">
                <a href="mailto:hello@referralnova.com" className="hover:text-primary">
                  hello@referralnova.com
                </a>
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <MessageSquare size={18} />
                <h3 className="font-semibold">Response time</h3>
              </div>
              <p className="text-gray-700">We reply within 1 business day.</p>
            </div>
          </div>

          <div>
            {sent ? (
              <div className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                  <Check size={24} />
                </div>
                <p className="font-semibold text-gray-900">Message sent.</p>
                <p className="mt-1 text-sm text-gray-600">We&rsquo;ll reply soon.</p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-200 p-6">
                <FormField label="Your name" name="name" required />
                <FormField label="Email" name="email" type="email" required />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-900">Message</label>
                  <textarea
                    name="message"
                    rows={5}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <Button type="submit" loading={sending}>Send message</Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
