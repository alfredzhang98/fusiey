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
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
}

// Bumped on every manual auth action (login/register/google/logout). A
// `fetchMe()` started before such an action must NOT overwrite its result —
// otherwise a slow boot-time /me request can wipe a just-logged-in user
// (the "nav only updates after refresh" bug).
let authEpoch = 0;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  error: null,

  async fetchMe() {
    const epoch = authEpoch;
    try {
      const { user } = await authApi.me();
      if (epoch === authEpoch) set({ user, status: 'idle' });
      else set({ status: 'idle' });
    } catch (err) {
      // 401 is expected when there's no cookie. Only clear the user if no
      // manual auth happened while this request was in flight.
      if (epoch === authEpoch) set({ user: null, status: 'idle' });
      else set({ status: 'idle' });
    }
  },

  async login(email, password) {
    set({ error: null });
    try {
      const { user } = await authApi.login({ email, password });
      authEpoch++;
      set({ user, status: 'idle' });
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
      authEpoch++;
      set({ user, status: 'idle' });
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
      authEpoch++;
      set({ user, status: 'idle' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Google login failed';
      set({ error: msg });
      throw err;
    }
  },

  async updateProfile(data) {
    set({ error: null });
    try {
      const { user } = await authApi.updateProfile(data);
      set({ user });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Profile update failed';
      set({ error: msg });
      throw err;
    }
  },

  async changePassword(data) {
    set({ error: null });
    try {
      await authApi.changePassword(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Password change failed';
      set({ error: msg });
      throw err;
    }
  },

  async logout() {
    authEpoch++;
    try {
      await authApi.logout();
    } catch {
      // Ignore — client-side state still clears regardless.
    }
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));
