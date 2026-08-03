'use client';

import { useEffect, useRef } from 'react';

/**
 * A tiny, dependency-free emoji picker. A curated set of the emojis people
 * actually reach for in a business chat, grouped into a few rows. Avoids
 * pulling in a multi-hundred-KB emoji library (and its remote asset fetches,
 * which a strict CSP would block on a static host).
 */

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀', '😄', '😁', '😊', '🙂', '😉', '😍', '😘', '😎', '🤩', '🥳', '😇', '🤗', '🤔', '😅', '😂'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '👌', '✌️', '🤞', '👋', '🫶', '🤙', '👇', '👆', '✍️'],
  },
  {
    label: 'Hearts & stars',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '⭐', '🌟', '✨', '🔥', '💯', '🎉', '🎊', '🏆', '💎'],
  },
  {
    label: 'Work',
    emojis: ['📈', '📊', '💰', '🤑', '📅', '⏰', '✅', '❌', '📎', '📌', '💡', '🚀', '☕', '📞', '💼', '🎯'],
  },
];

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen on 'click' (not 'mousedown'): the toggle button stops propagation
    // on its own click, so tapping the button closes the picker cleanly instead
    // of this handler closing it a beat before the button's onClick reopens it.
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-14 left-2 z-30 w-72 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl sm:left-4"
    >
      <div className="max-h-60 space-y-3 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {g.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {g.emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-gray-100"
                  aria-label={`Insert ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
