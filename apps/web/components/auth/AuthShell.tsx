import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, footer, children }: Props) {
  return (
    <main className="flex flex-1 items-center justify-center bg-primary-light px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <a
          href="https://referralnova.com"
          className="mb-6 block text-center text-xs font-medium uppercase tracking-wider text-primary"
        >
          Virtual<span className="text-primary">Pros</span>Network
        </a>
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mb-6 text-center text-sm text-gray-600">{subtitle}</p>}
        {children}
        {footer && <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>}
        <p className="mt-4 text-center text-[10px] text-gray-400">
          Virtual<span className="font-semibold">Pros</span>Network &middot; Powered by{' '}
          <a href="https://referralnova.com" className="hover:text-primary">Referral Nova</a>
        </p>
      </div>
    </main>
  );
}
