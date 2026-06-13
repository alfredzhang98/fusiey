/**
 * Marketing / promo routes — public.
 *
 *   POST /api/promo/welcome   body: { email }   → issues + emails a "10% off
 *                                                  your first kit" discount code
 *
 * Abuse protection (layered):
 *   1. Per-IP rate limit (mounted in app.ts) caps bursts from one source.
 *   2. Per-email: one welcome code per email, ever. We never reveal whether an
 *      email already has/used a code, and we won't re-send within a short
 *      cooldown — so the endpoint can't be used to spam someone's inbox.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../services/emailService.js';
import { welcomeDiscountEmail } from '../services/emailTemplates.js';
import { getWelcomeDiscountPercent } from '../lib/siteConfig.js';

export const promoRoutes = Router();

const CODE_TTL_DAYS = 30;
const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // don't re-send the same code within 5 min

const welcomeSchema = z.object({ email: z.string().email().max(200) });

// Unambiguous alphabet (no 0/O/1/I) for human-typable codes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(): string {
  let body = '';
  for (let i = 0; i < 6; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `FSY10-${body}`;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const clash = await prisma.discountCode.findUnique({ where: { code } });
    if (!clash) return code;
  }
  // Astronomically unlikely; fall back to a timestamp-suffixed code.
  return `FSY10-${randomCode().slice(6)}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

// ── POST /promo/welcome ───────────────────────────────────────────────────
promoRoutes.post('/welcome', async (req, res) => {
  const parsed = welcomeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const now = new Date();

  const existing = await prisma.discountCode.findFirst({
    where: { email, campaign: 'WELCOME' },
    orderBy: { createdAt: 'desc' },
  });

  // Already redeemed → silently succeed (one welcome discount per email).
  if (existing?.used) {
    return res.json({ success: true });
  }

  let code: string;
  if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
    // A valid unused code already exists. Anti-spam: skip the re-send if we
    // emailed it just moments ago, otherwise resend the same code.
    if (now.getTime() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      return res.json({ success: true });
    }
    code = existing.code;
  } else {
    code = await uniqueCode();
    const percentOff = await getWelcomeDiscountPercent();
    await prisma.discountCode.create({
      data: {
        code,
        email,
        percentOff,
        campaign: 'WELCOME',
        expiresAt: new Date(now.getTime() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  }

  const mail = welcomeDiscountEmail(code);
  // Fire-and-forget — a slow mail provider shouldn't make the form hang.
  sendEmail({ ...mail, to: email }).catch(() => {});

  return res.json({ success: true });
});
