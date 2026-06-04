/**
 * Auth routes — email/password + Google OAuth.
 *
 * Endpoint contracts:
 *   POST /register   body: { email, password, name }   → 201 { user }, sets cookies
 *   POST /login      body: { email, password }         → 200 { user }, sets cookies
 *   POST /google     body: { credential }              → 200 { user }, sets cookies
 *   GET  /me                                            → 200 { user } | 401
 *   POST /logout                                        → 204
 *   POST /refresh    cookie: refresh_token             → 204 new access cookie
 *
 * Response `user` excludes `passwordHash`; always use `toPublicUser()`.
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  clearAuthCookies,
  requireAuth,
  setAuthCookies,
  signAccessToken,
  verifyRefreshToken,
} from '../middleware/auth.js';
import type { User } from '../../../generated/prisma/client.js';

export const authRoutes = Router();

const BCRYPT_ROUNDS = 10;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function toPublicUser(user: User) {
  // Strip sensitive / internal fields before responding.
  const { passwordHash: _pw, googleId: _g, ...safe } = user as any;
  return safe;
}

const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

const googleSchema = z.object({ credential: z.string().min(10) });

// ── POST /register ────────────────────────────────────────────────────
authRoutes.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  setAuthCookies(res, user.id, user.role);
  return res.status(201).json({ user: toPublicUser(user) });
});

// ── POST /login ───────────────────────────────────────────────────────
authRoutes.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    // passwordHash null = Google-only account; login via /google instead.
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  setAuthCookies(res, user.id, user.role);
  return res.json({ user: toPublicUser(user) });
});

// ── POST /google ──────────────────────────────────────────────────────
// Accepts a Google-issued id_token (credential) from the frontend.
// On success, either finds an existing account by googleId / email and
// merges, or creates a new user.
authRoutes.post('/google', async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: parsed.data.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (e: any) {
    console.warn('[auth] Google verifyIdToken failed:', e.message);
    return res.status(401).json({ error: 'Invalid Google credential' });
  }
  if (!payload?.sub || !payload.email) {
    return res.status(400).json({ error: 'Google payload missing sub/email' });
  }

  // 1. Match by googleId (existing OAuth user).
  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

  if (!user) {
    // 2. Match by email (link existing email account to Google).
    const byEmail = await prisma.user.findUnique({ where: { email: payload.email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: payload.sub,
          emailVerified: true,
          avatarUrl: byEmail.avatarUrl ?? payload.picture ?? null,
        },
      });
    } else {
      // 3. Create fresh account, no password.
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          googleId: payload.sub,
          emailVerified: true,
          avatarUrl: payload.picture ?? null,
        },
      });
    }
  }

  setAuthCookies(res, user.id, user.role);
  return res.json({ user: toPublicUser(user) });
});

// ── GET /me ───────────────────────────────────────────────────────────
authRoutes.get('/me', requireAuth, (req, res) => {
  return res.json({ user: toPublicUser(req.user!) });
});

// ── POST /logout ──────────────────────────────────────────────────────
authRoutes.post('/logout', (_req, res) => {
  clearAuthCookies(res);
  res.status(204).end();
});

// ── POST /refresh ─────────────────────────────────────────────────────
// Rotates the access token using the refresh cookie. Keeps refresh as-is
// (simpler; upgrade to rotating refresh later if we want strict security).
authRoutes.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const { userId } = verifyRefreshToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    // Issue new access cookie (reuse setAuthCookies's access-token branch).
    res.cookie('access_token', signAccessToken({ userId: user.id, role: user.role }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000,
    });
    return res.status(204).end();
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});
