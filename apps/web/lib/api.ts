import type { ApiResponse } from '@refnet/shared';

/**
 * Typed fetch wrapper. Always hits `NEXT_PUBLIC_API_URL`, always sends
 * credentials so the HTTP-only refresh-token cookie rides along, and
 * always decodes the canonical `ApiResponse<T>` envelope.
 *
 * Access token is held in the Zustand auth store and attached via
 * `Authorization: Bearer` here.
 */

const API_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface ApiOptions {
  accessToken?: string;
  /** JSON body to send. */
  json?: unknown;
  /** URL search params. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Override the default credentials: 'include' (keep for dev simplicity). */
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    credentials: opts.credentials ?? 'include',
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    signal: opts.signal,
  });

  let envelope: ApiResponse<T>;
  try {
    envelope = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`Unexpected response (${res.status})`, res.status);
  }

  if (!res.ok || envelope.success === false) {
    throw new ApiError(
      envelope.error ?? `Request failed (${res.status})`,
      res.status,
      envelope.details,
    );
  }
  return envelope.data as T;
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => apiRequest<T>('GET', path, opts),
  post: <T>(path: string, json?: unknown, opts?: ApiOptions) =>
    apiRequest<T>('POST', path, { ...opts, json }),
  patch: <T>(path: string, json?: unknown, opts?: ApiOptions) =>
    apiRequest<T>('PATCH', path, { ...opts, json }),
  delete: <T>(path: string, opts?: ApiOptions) => apiRequest<T>('DELETE', path, opts),
};
