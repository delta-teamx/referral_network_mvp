'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthSuccessDto, AuthenticatedUserDto, LoginInput, SignupInput } from '@refnet/shared';
import { api, ApiError } from '../lib/api';

export interface AuthState {
  user: AuthenticatedUserDto | null;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;

  signup: (input: SignupInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
  setAuth: (user: AuthenticatedUserDto, accessToken: string, expiresAt: number) => void;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(set: (patch: Partial<AuthState>) => void): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const state = useAuthStore.getState();
  if (!state.accessTokenExpiresAt) return;

  // Refresh 2 minutes before expiry (or immediately if less than 2 min left)
  const msUntilExpiry = state.accessTokenExpiresAt - Date.now();
  const refreshIn = Math.max(0, msUntilExpiry - 2 * 60 * 1000);

  refreshTimer = setTimeout(async () => {
    try {
      const data = await api.post<AuthSuccessDto>('/api/v1/auth/refresh');
      applyAuthSuccess(data, set);
    } catch {
      // Refresh failed - token will expire, next API call handles it
    }
  }, refreshIn);
}

function applyAuthSuccess(data: AuthSuccessDto, set: (patch: Partial<AuthState>) => void): void {
  set({
    user: data.user,
    accessToken: data.tokens.accessToken,
    accessTokenExpiresAt: Date.now() + data.tokens.expiresIn * 1000,
    status: 'authenticated',
    error: null,
  });
  scheduleRefresh(set);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
  status: 'idle',
  error: null,

  async signup(input) {
    set({ status: 'loading', error: null });
    try {
      const data = await api.post<AuthSuccessDto>('/api/v1/auth/signup', input);
      applyAuthSuccess(data, set);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Signup failed';
      set({ status: 'unauthenticated', error: msg });
      throw err;
    }
  },

  async login(input) {
    set({ status: 'loading', error: null });
    try {
      const data = await api.post<AuthSuccessDto>('/api/v1/auth/login', input);
      applyAuthSuccess(data, set);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      set({ status: 'unauthenticated', error: msg });
      throw err;
    }
  },

  async logout() {
    if (refreshTimer) clearTimeout(refreshTimer);
    try {
      await api.post('/api/v1/auth/logout');
    } finally {
      set({
        user: null,
        accessToken: null,
        accessTokenExpiresAt: null,
        status: 'unauthenticated',
        error: null,
      });
    }
  },

  async hydrate() {
    const state = useAuthStore.getState();
    if (
      state.accessToken &&
      state.accessTokenExpiresAt &&
      state.accessTokenExpiresAt > Date.now() + 30_000
    ) {
      if (state.status !== 'authenticated') set({ status: 'authenticated' });
      scheduleRefresh(set);
      return;
    }
    set({ status: 'loading' });
    try {
      const data = await api.post<AuthSuccessDto>('/api/v1/auth/refresh');
      applyAuthSuccess(data, set);
    } catch (err) {
      // Only a definitive 401 means the session is truly gone. Anything else
      // (API cold-starting on Render's free tier, network blip, 5xx) must NOT
      // log the user out — keep the persisted identity and retry shortly.
      if (err instanceof ApiError && err.status === 401) {
        set({ status: 'unauthenticated', user: null, accessToken: null });
        return;
      }
      const s = useAuthStore.getState();
      if (s.user) {
        set({ status: 'authenticated' });
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void useAuthStore.getState().hydrate();
        }, 8000);
      } else {
        set({ status: 'unauthenticated' });
      }
    }
  },

  clearError() {
    set({ error: null });
  },

  setAuth(user, accessToken, expiresAt) {
    set({
      user,
      accessToken,
      accessTokenExpiresAt: expiresAt,
      status: 'authenticated',
      error: null,
    });
    scheduleRefresh(set);
  },
    }),
    {
      // Persist the session so navigating to a public page (member profile) or
      // reloading doesn't require a cross-domain refresh call to stay logged in.
      // The short-lived access token is stored client-side; the refresh token
      // stays HttpOnly. hydrate() still validates expiry and refreshes on time.
      name: 'rn-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        accessTokenExpiresAt: s.accessTokenExpiresAt,
      }),
      onRehydrateStorage: () => (state) => {
        // A still-valid persisted token means we're authenticated right away —
        // no need to wait on (or depend on) a refresh round-trip.
        if (
          state &&
          state.accessToken &&
          state.accessTokenExpiresAt &&
          state.accessTokenExpiresAt > Date.now()
        ) {
          state.status = 'authenticated';
        }
      },
    },
  ),
);
