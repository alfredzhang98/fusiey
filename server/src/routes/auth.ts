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
import { sendEmail } from '../services/emailService.js';
import { passwordResetEmail } from '../services/emailTemplates.js';

export const authRoutes = Router();

const BCRYPT_ROUNDS = 10;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function toPublicUser(user: User) {
  // Strip sensitive / internal fields before responding.
  const { passwordHash: _pw, googleId: _g, ...safe } = user as any;
  return { ...safe, hasPassword: !!user.passwordHash };
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

const profileUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().max(200).optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

// ── GET /me ───────────────────────────────────────────────────────────
authRoutes.get('/me', requireAuth, (req, res) => {
  return res.json({ user: toPublicUser(req.user!) });
});

// ── PATCH /me ─────────────────────────────────────────────────────────
// Update profile fields (name, email). Email must not be taken by another user.
authRoutes.patch('/me', requireAuth, async (req, res) => {
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { name, email } = parsed.data;
  if (!name && !email) return res.status(400).json({ error: 'No fields to update' });

  const user = req.user!;

  // If email is changing, check uniqueness.
  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) {
      return res.status(409).json({ error: 'Email already in use' });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(name ? { name } : {}),
      ...(email && email !== user.email ? { email, emailVerified: false } : {}),
    },
  });

  return res.json({ user: toPublicUser(updated) });
});

// ── PATCH /me/password ────────────────────────────────────────────────
// Only works for email/password accounts (users with a passwordHash).
authRoutes.patch('/me/password', requireAuth, async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const user = req.user!;
  if (!user.passwordHash) {
    return res.status(400).json({ error: 'Google-only accounts have no password. Use Google to sign in.' });
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return res.json({ success: true });
});

// ── POST /forgot-password ─────────────────────────────────────────────
// Sends a 6-digit reset code to the account email. Always returns success
// (never reveals whether the email exists). Only email/password accounts
// can reset; Google-only accounts are silently ignored.
const forgotSchema = z.object({ email: z.string().email().max(200) });

authRoutes.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  // Generic success regardless — don't leak account existence or validity.
  if (!parsed.success) return res.json({ success: true });

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.passwordHash) {
    // Invalidate any earlier unused codes, then issue a fresh one.
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });
    const mail = passwordResetEmail(code);
    sendEmail({ ...mail, to: user.email }).catch(() => {});
  }

  return res.json({ success: true });
});

// ── POST /reset-password ──────────────────────────────────────────────
// Verifies the 6-digit code and sets a new password.
const resetSchema = z.object({
  email: z.string().email().max(200),
  code: z.string().length(6),
  newPassword: z.string().min(8).max(200),
});

authRoutes.post('/reset-password', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

  const reset = await prisma.passwordReset.findFirst({
    where: { userId: user.id, used: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset || reset.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  if (reset.attempts >= 5) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } });
    return res.status(429).json({ error: 'Too many attempts — request a new code.' });
  }

  const ok = await bcrypt.compare(parsed.data.code, reset.codeHash);
  if (!ok) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
  ]);

  return res.json({ success: true });
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
