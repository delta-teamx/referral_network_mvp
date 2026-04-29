'use client';

import type { ReactNode, InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  dark?: boolean;
}

export function FormField({ label, error, hint, id, className = '', dark, ...inputProps }: Props) {
  const inputId = id ?? inputProps.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className={`mb-1 block text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-900'}`}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
          dark
            ? `border-gray-700 bg-gray-800 text-gray-100 ${error ? 'border-red-500' : ''}`
            : `${error ? 'border-danger' : 'border-gray-300'}`
        } ${className}`}
      />
      {hint && !error && <p className={`mt-1 text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
