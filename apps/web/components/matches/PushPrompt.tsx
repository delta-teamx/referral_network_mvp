'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { getPushState, isPushSupported, subscribeToPush, type PushState } from '../../lib/push';

interface Props {
  accessToken: string;
}

const DISMISSED_KEY = 'nrg.push.dismissed';

export function PushPrompt({ accessToken }: Props) {
  const [state, setState] = useState<PushState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
    if (!isPushSupported()) {
      setState({ supported: false, permission: 'unsupported', subscribed: false, endpoint: null });
      return;
    }
    void getPushState().then(setState);
  }, []);

  if (!state || dismissed) return null;
  if (!state.supported) return null;
  if (state.subscribed) return null;
  if (state.permission === 'denied') return null;

  async function enable() {
    setBusy(true);
    try {
      const result = await subscribeToPush(accessToken);
      if (result.ok) {
        setState(await getPushState());
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <div>
          <p className="font-medium text-blue-900">Get notified instantly</p>
          <p className="text-xs text-blue-800">
            Browser notifications for new intro requests, accepts, and booked calls — only fires when something
            actually happens.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? 'Enabling…' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-blue-700 hover:bg-blue-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
