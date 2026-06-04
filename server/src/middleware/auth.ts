/**
 * Auth middleware — JWT verification + role guards.
 *
 * Clients receive access + refresh tokens as httpOnly cookies after a
 * successful login / register / google-oauth exchange. `requireAuth`
 * reads the access cookie, verifies it, and attaches the user record to
 * `req.user`. Downstream handlers can then rely on `req.user` existing.
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import type { User } from '../../../generated/prisma/client.js';

// Extend Express's Request type so TypeScript knows about req.user.
declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';

export const ACCESS_TTL = '15m';
export const REFRESH_TTL = '30d';

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string };
}

/**
 * Requires a valid access-token cookie. Attaches `req.user` on success.
 * Responds 401 if the cookie is missing, malformed, or refers to a user
 * that no longer exists.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const { userId } = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Role-gate middleware. Use after `requireAuth`:
 *   router.use('/admin', requireAuth, requireRole('ADMIN', 'SUPERADMIN'));
 */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// ──────────────────────────────────────────────────────────────────────
// Cookie helpers — httpOnly, secure-in-prod, SameSite=Lax.
// ──────────────────────────────────────────────────────────────────────

const ONE_DAY = 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * ONE_DAY;
const FIFTEEN_MIN = 15 * 60 * 1000;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function setAuthCookies(res: Response, userId: string, role: string) {
  res.cookie('access_token', signAccessToken({ userId, role }), cookieOptions(FIFTEEN_MIN));
  res.cookie('refresh_token', signRefreshToken(userId), cookieOptions(THIRTY_DAYS));
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}
