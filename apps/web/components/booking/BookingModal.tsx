'use client';

import { useEffect, useState } from 'react';
import { Calendar, Check, Clock, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { Button } from '../ui/Button';

interface Props {
  hostUserId: string;
  hostName: string;
  open: boolean;
  onClose: () => void;
}

interface Slot {
  startsAt: string;
  endsAt: string;
}

const REASONS = [
  { key: 'referral', label: 'Referral opportunity' },
  { key: 'partnership', label: 'Partnership discussion' },
  { key: 'service_inquiry', label: 'Service inquiry' },
  { key: 'general_intro', label: 'General introduction' },
] as const;

export function BookingModal({ hostUserId, hostName, open, onClose }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState<'reason' | 'slot' | 'confirm' | 'done'>('reason');
  const [reason, setReason] = useState<typeof REASONS[number]['key']>('referral');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ zoomUrl: string | null; startsAt: string } | null>(null);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep('reason');
      setReason('referral');
      setNotes('');
      setSlots([]);
      setSelected(null);
      setError(null);
      setResult(null);
      return;
    }
    if (step === 'slot' && slots.length === 0) {
      setLoading(true);
      api
        .get<Slot[]>(`/api/v1/bookings/availability/${hostUserId}?days=14`)
        .then((data) => setSlots(data))
        .catch((err) =>
          setError(err instanceof ApiError ? err.message : 'Could not load availability'),
        )
        .finally(() => setLoading(false));
    }
  }, [open, step, hostUserId, slots.length]);

  async function confirm() {
    if (!selected || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const booking = await api.post<{ zoomUrl: string | null; startsAt: string }>(
        '/api/v1/bookings',
        {
          hostUserId,
          startsAt: selected.startsAt,
          endsAt: selected.endsAt,
          reason,
          notes: notes || undefined,
        },
        { accessToken: accessToken ?? undefined },
      );
      setResult(booking);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  // Filter out past slots and group by day
  const now = Date.now();
  const futureSlots = slots.filter((s) => new Date(s.startsAt).getTime() > now);
  const slotsByDay = new Map<string, Slot[]>();
  for (const s of futureSlots) {
    const day = new Date(s.startsAt).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const arr = slotsByDay.get(day) ?? [];
    arr.push(s);
    slotsByDay.set(day, arr);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Book a call
            </p>
            <h2 className="text-xl font-bold text-gray-900">with {hostName}</h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {step === 'reason' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Why do you want to connect?</p>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                    reason === r.key
                      ? 'border-primary bg-primary-light/50'
                      : 'border-gray-200 hover:border-primary'
                  }`}
                >
                  <input
                    type="radio"
                    checked={reason === r.key}
                    onChange={() => setReason(r.key)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-gray-900">{r.label}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-900">
                Note (optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="Give some context so they know what to prepare."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={() => setStep('slot')} className="w-full">
              See available times →
            </Button>
          </div>
        )}

        {step === 'slot' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar size={16} className="text-primary" /> Pick a 30-min slot
              <span className="ml-auto text-xs text-gray-400">
                Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>
            {loading ? (
              <p className="py-6 text-center text-sm text-gray-500">Loading availability…</p>
            ) : futureSlots.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                <p className="text-sm text-gray-600">
                  {hostName} hasn&rsquo;t set availability yet. Send a message instead to request a
                  time.
                </p>
              </div>
            ) : (
              <div className="max-h-80 space-y-4 overflow-y-auto">
                {[...slotsByDay.entries()].map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {day}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {daySlots.map((s) => {
                        const active = selected?.startsAt === s.startsAt;
                        return (
                          <button
                            key={s.startsAt}
                            onClick={() => setSelected(s)}
                            className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                              active
                                ? 'border-primary bg-primary text-white'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-primary'
                            }`}
                          >
                            {new Date(s.startsAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('reason')} className="flex-1">
                ← Back
              </Button>
              <Button
                onClick={() => setStep('confirm')}
                disabled={!selected}
                className="flex-1"
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm' && selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Confirm
              </p>
              <p className="mb-1 text-sm text-gray-900">
                <strong>With:</strong> {hostName}
              </p>
              <p className="mb-1 text-sm text-gray-900">
                <strong>Reason:</strong> {REASONS.find((r) => r.key === reason)?.label}
              </p>
              <p className="mb-1 inline-flex items-center gap-1 text-sm text-gray-900">
                <Clock size={14} />
                {new Date(selected.startsAt).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                (30 min)
              </p>
            </div>
            <p className="text-xs text-gray-500">
              A Zoom link will be generated and emailed to both of you with a calendar invite.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('slot')} className="flex-1">
                ← Back
              </Button>
              <Button onClick={() => void confirm()} loading={loading} className="flex-1">
                Confirm booking
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <Check size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Booked!</h3>
            <p className="text-sm text-gray-600">
              Calendar invite sent. Your Zoom link is in your email and on your dashboard.
            </p>
            {result.zoomUrl ? (
              <a
                href={result.zoomUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-semibold text-primary hover:underline"
              >
                Copy Zoom link →
              </a>
            ) : (
              <p className="text-xs text-gray-500">
                Zoom link is being generated - check your email shortly.
              </p>
            )}
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
