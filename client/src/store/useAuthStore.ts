/**
 * Auth store — current user + login/register/logout/google actions.
 *
 * State shape:
 *   user        PublicUser | null
 *   status      'loading' during initial fetchMe, 'idle' otherwise
 *   error       last auth error message (cleared on next attempt)
 *
 * On app boot, call `fetchMe()` once to rehydrate from the access cookie
 * (if present) — this is what keeps the user signed-in across refreshes.
 * httpOnly cookies are set by the server; we never touch the token itself.
 */

import { create } from 'zustand';
import { authApi, ApiError, type PublicUser } from '../services/api';

interface AuthState {
  user: PublicUser | null;
  status: 'idle' | 'loading';
  error: string | null;

  fetchMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  // Local helpers for optimistic credit updates after the server decrements.
  setUser: (user: PublicUser | null) => void;
  setCredits: (credits: { generateCredits: number; communityPoints?: number }) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  error: null,

  async fetchMe() {
    try {
      const { user } = await authApi.me();
      set({ user, status: 'idle' });
    } catch (err) {
      // 401 is expected when there's no cookie — leave user null silently.
      set({ user: null, status: 'idle' });
    }
  },

  async login(email, password) {
    set({ error: null });
    try {
      const { user } = await authApi.login({ email, password });
      set({ user });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      set({ error: msg });
      throw err;
    }
  },

  async register(email, password, name) {
    set({ error: null });
    try {
      const { user } = await authApi.register({ email, password, name });
      set({ user });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Register failed';
      set({ error: msg });
      throw err;
    }
  },

  async loginWithGoogle(credential) {
    set({ error: null });
    try {
      const { user } = await authApi.google(credential);
      set({ user });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Google login failed';
      set({ error: msg });
      throw err;
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // Ignore — client-side state still clears regardless.
    }
    set({ user: null });
  },

  setUser: (user) => set({ user }),

  setCredits: ({ generateCredits, communityPoints }) => {
    const user = get().user;
    if (!user) return;
    set({
      user: {
        ...user,
        generateCredits,
        communityPoints: communityPoints ?? user.communityPoints,
      },
    });
  },
}));
