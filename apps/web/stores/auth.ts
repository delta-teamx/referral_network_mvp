'use client';

import { create } from 'zustand';
import type { AuthSuccessDto, AuthenticatedUserDto, LoginInput, SignupInput } from '@refnet/shared';
import { api, ApiError } from '../lib/api';

/**
 * Auth state — lives in memory (never localStorage). On hard refresh the
 * page calls `hydrate()`, which POSTs /auth/refresh; the HTTP-only refresh
 * cookie keeps the session alive across reloads.
 */

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
  /** Used by the OAuth callback to seed state after an external redirect. */
  setAuth: (user: AuthenticatedUserDto, accessToken: string, expiresAt: number) => void;
}

function applyAuthSuccess(data: AuthSuccessDto, set: (patch: Partial<AuthState>) => void): void {
  set({
    user: data.user,
    accessToken: data.tokens.accessToken,
    accessTokenExpiresAt: Date.now() + data.tokens.expiresIn * 1000,
    status: 'authenticated',
    error: null,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
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
    set({ status: 'loading' });
    try {
      const data = await api.post<AuthSuccessDto>('/api/v1/auth/refresh');
      applyAuthSuccess(data, set);
    } catch {
      set({ status: 'unauthenticated', user: null, accessToken: null });
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
  },
}));
