'use client';

/**
 * A short, pleasant two-note notification chime synthesized with the Web Audio
 * API - no audio file to ship, cache, or trip a Content-Security-Policy on.
 *
 * Browsers suspend the AudioContext until the user has interacted with the
 * page, so the first ring may be silent if it arrives before any click. That's
 * an acceptable, standard limitation (and desktop notifications cover it).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** localStorage flag - sound on unless the user muted it. */
export function isChimeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('rn-notif-sound') !== 'off';
}

export function setChimeEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('rn-notif-sound', on ? 'on' : 'off');
}

/** Play the chime once (no-op when muted or audio is unavailable). */
export function playChime(): void {
  if (!isChimeEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  // Resume if the tab autosuspended it (best-effort).
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);

  const now = audio.currentTime;
  const master = audio.createGain();
  master.gain.value = 0.0001;
  master.connect(audio.destination);

  // Two rising notes (C6 -> E6) with a soft attack/decay = a gentle "ding-dong".
  const notes = [
    { freq: 1046.5, at: 0 },
    { freq: 1318.5, at: 0.12 },
  ];
  for (const n of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = n.freq;
    const start = now + n.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + 0.4);
  }
  master.gain.setValueAtTime(0.9, now);
}
