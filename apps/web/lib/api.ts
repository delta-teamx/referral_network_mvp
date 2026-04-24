import type { ApiResponse } from '@refnet/shared';
import { getMockResponse } from './mockData';

/**
 * Typed fetch wrapper. Always hits `NEXT_PUBLIC_API_URL`, always sends
 * credentials so the HTTP-only refresh-token cookie rides along, and
 * always decodes the canonical `ApiResponse<T>` envelope.
 *
 * **Demo mode**: when `NEXT_PUBLIC_API_URL` is unset OR the API rejects the
 * request with a network error, we fall back to `lib/mockData.ts`. This lets
 * us ship a frontend-only build to Netlify for client demos without a live
 * backend. Set `NEXT_PUBLIC_DEMO_MODE=force` to always use mocks.
 */

const RAW_API = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined;
const API_BASE = RAW_API && RAW_API.length > 0 ? RAW_API : '';
const FORCE_DEMO =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'force';

export const isDemoMode = (): boolean => FORCE_DEMO || !API_BASE;

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
  json?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

function buildPathWithQuery(path: string, query?: ApiOptions['query']): string {
  if (!query) return path;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

function mockOrThrow<T>(method: string, path: string, originalErr: unknown): T {
  const mock = getMockResponse(method, path);
  if (mock !== undefined) return mock as T;
  if (originalErr instanceof ApiError) throw originalErr;
  throw new ApiError('Demo mode: no mock for this endpoint', 0);
}

export async function apiRequest<T>(
  method: string,
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const fullPath = buildPathWithQuery(path, opts.query);

  // Force demo mode: short-circuit before any network call.
  if (isDemoMode()) {
    const mock = getMockResponse(method, fullPath);
    if (mock !== undefined) return mock as T;
    throw new ApiError('Demo mode: no mock for this endpoint', 0);
  }

  const doFetch = async (token?: string): Promise<T> => {
    const url = path.startsWith('http') ? new URL(path) : new URL(`${API_BASE}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.json !== undefined) headers['Content-Type'] = 'application/json';
    const activeToken = token ?? opts.accessToken;
    if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers,
        credentials: opts.credentials ?? 'include',
        body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
        signal: opts.signal,
      });
    } catch (networkErr) {
      return mockOrThrow<T>(method, fullPath, networkErr);
    }

    let envelope: ApiResponse<T>;
    try {
      envelope = (await res.json()) as ApiResponse<T>;
    } catch {
      return mockOrThrow<T>(method, fullPath, new ApiError(`Unexpected response (${res.status})`, res.status));
    }

    if (!res.ok || envelope.success === false) {
      if (res.status >= 500 || res.status === 0) {
        return mockOrThrow<T>(
          method,
          fullPath,
          new ApiError(envelope.error ?? `Request failed (${res.status})`, res.status, envelope.details),
        );
      }
      if (res.status === 401) {
        const mock = getMockResponse(method, fullPath);
        if (mock !== undefined) return mock as T;
      }
      throw new ApiError(
        envelope.error ?? `Request failed (${res.status})`,
        res.status,
        envelope.details,
      );
    }
    return envelope.data as T;
  };

  try {
    return await doFetch();
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 401 &&
      opts.accessToken &&
      !path.includes('/auth/')
    ) {
      try {
        const refreshed = await apiRequest<{ tokens: { accessToken: string; expiresIn: number }; user: unknown }>(
          'POST',
          '/api/v1/auth/refresh',
        );
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        store.setAuth(
          refreshed.user as Parameters<typeof store.setAuth>[0],
          refreshed.tokens.accessToken,
          Date.now() + refreshed.tokens.expiresIn * 1000,
        );
        return await doFetch(refreshed.tokens.accessToken);
      } catch {
        const { useAuthStore } = await import('../stores/auth');
        useAuthStore.setState({
          status: 'unauthenticated',
          user: null,
          accessToken: null,
          accessTokenExpiresAt: null,
        });
        if (typeof window !== 'undefined') {
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        }
        return undefined as unknown as T;
      }
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, opts?: ApiOptions) => apiRequest<T>('GET', path, opts),
  post: <T>(path: string, json?: unknown, opts?: ApiOptions) =>
    apiRequest<T>('POST', path, { ...opts, json }),
  patch: <T>(path: string, json?: unknown, opts?: ApiOptions) =>
    apiRequest<T>('PATCH', path, { ...opts, json }),
  put: <T>(path: string, json?: unknown, opts?: ApiOptions) =>
    apiRequest<T>('PUT', path, { ...opts, json }),
  delete: <T>(path: string, opts?: ApiOptions) => apiRequest<T>('DELETE', path, opts),
};
