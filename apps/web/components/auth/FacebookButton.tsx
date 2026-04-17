'use client';

export function FacebookButton({ label }: { label?: string }) {
  const apiBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  const href =
    !process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_DEMO_MODE === 'force'
      ? '/oauth/demo'
      : `${apiBase}/api/v1/auth/oauth/facebook`;

  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#1877F2"
          d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.025 4.388 11.018 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796v8.437C19.612 23.09 24 18.098 24 12.073z"
        />
      </svg>
      {label ?? 'Continue with Facebook'}
    </a>
  );
}
