import type { ApiResponse } from '@refnet/shared';

/**
 * Typed fetch wrapper. Always hits `NEXT_PUBLIC_API_URL`, always sends
 * credentials so the HTTP-only refresh-token cookie rides along, and always
 * decodes the canonical `ApiResponse<T>` envelope.
 *
 * There is no mock/demo fallback: the app talks only to the real API, and
 * surfaces real errors instead of ever showing placeholder data.
 */

const RAW_API = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : undefined;
const DEFAULT_API_BASE = RAW_API && RAW_API.length > 0 ? RAW_API : '';

/** The API the app talks to, configured via NEXT_PUBLIC_API_URL. */
function apiBase(): string {
  return DEFAULT_API_BASE;
}

/** True only when no API URL is configured (e.g. a preview build). */
export const isDemoMode = (): boolean => !DEFAULT_API_BASE;

/** The resolved API origin, for callers that need to build raw URLs (uploads, file links). */
export const apiBaseUrl = (): string => apiBase();

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

export async function apiRequest<T>(
  method: string,
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const doFetch = async (token?: string): Promise<T> => {
    const url = path.startsWith('http') ? new URL(path) : new URL(`${apiBase()}${path}`);
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
        // API responses must never be served from the browser's HTTP cache —
        // Express sends ETags, and a cached 304 has no JSON body, which parsed
        // as a silent failure (empty lists).
        cache: 'no-store',
        // Nothing may hang the UI forever: 25s cap on every request. A sleeping
        // server or dead connection surfaces as a visible, retryable error.
        signal: opts.signal ?? AbortSignal.timeout(25_000),
      });
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new ApiError(
          'The server took too long to respond (it may be waking up). Please try again in ~30 seconds.',
          0,
        );
      }
      throw new ApiError('Network error — please try again.', 0);
    }

    let envelope: ApiResponse<T>;
    try {
      envelope = (await res.json()) as ApiResponse<T>;
    } catch {
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new ApiError(
          'The server is waking up — please try again in about 30 seconds.',
          res.status,
        );
      }
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
      } catch (refreshErr) {
        // Only a definitive 401 from the refresh endpoint means the session is
        // dead — log out and round-trip through login. A cold-starting API
        // (Render free tier), network blip or 5xx must NOT nuke the session;
        // surface the original error so the page can show "try again".
        if (refreshErr instanceof ApiError && refreshErr.status === 401) {
          const { useAuthStore } = await import('../stores/auth');
          useAuthStore.setState({
            status: 'unauthenticated',
            user: null,
            accessToken: null,
            accessTokenExpiresAt: null,
          });
          if (typeof window !== 'undefined') {
            // Preserve the full path INCLUDING query (e.g. /members?id=…) so a
            // redirect through login lands the user back on the exact page.
            window.location.href =
              '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search);
          }
          return undefined as unknown as T;
        }
        throw err;
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
