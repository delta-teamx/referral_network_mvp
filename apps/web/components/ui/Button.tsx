'use client';

import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60';
  const styles: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-white text-primary border border-primary hover:bg-primary-light',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
