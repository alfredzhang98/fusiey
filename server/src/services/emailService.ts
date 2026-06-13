/**
 * Transactional email — Resend primary, MailerSend fallback.
 *
 * Resend free tier: ~100/day, 3000/month. MailerSend: ~500/month. We always
 * try Resend first; if it fails (including hitting its quota) we fall back to
 * MailerSend so delivery degrades gracefully instead of failing outright.
 *
 * Credentials come from env (kept out of source):
 *   RESEND_API_TOKEN / RESEND_SENDER_EMAIL
 *   MAILERSEND_API_TOKEN / MAILERSEND_SENDER_EMAIL
 *   EMAIL_SENDER_NAME (shared "from" name)
 */

const RESEND_URL = 'https://api.resend.com/emails';
const MAILERSEND_URL = 'https://api.mailersend.com/v1/email';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function senderName(): string {
  return process.env.EMAIL_SENDER_NAME || 'Fusiey';
}

async function sendViaResend(msg: EmailMessage): Promise<boolean> {
  const token = process.env.RESEND_API_TOKEN;
  const from = process.env.RESEND_SENDER_EMAIL;
  if (!token || !from) return false;
  try {
    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${senderName()} <${from}>`,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (resp.ok) return true;
    console.warn(`[email] Resend failed (${resp.status}): ${await resp.text()}`);
    return false;
  } catch (err) {
    console.warn('[email] Resend error:', err);
    return false;
  }
}

async function sendViaMailerSend(msg: EmailMessage): Promise<boolean> {
  const token = process.env.MAILERSEND_API_TOKEN;
  const from = process.env.MAILERSEND_SENDER_EMAIL;
  if (!token || !from) return false;
  try {
    const resp = await fetch(MAILERSEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { email: from, name: senderName() },
        to: [{ email: msg.to }],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (resp.ok) return true; // 200/202
    console.warn(`[email] MailerSend failed (${resp.status}): ${await resp.text()}`);
    return false;
  } catch (err) {
    console.warn('[email] MailerSend error:', err);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_TOKEN || process.env.MAILERSEND_API_TOKEN);
}

/**
 * Send an email. Tries Resend, then MailerSend. Returns true if either
 * provider accepted it. Never throws — callers can fire-and-forget.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  if (await sendViaResend(msg)) {
    console.log(`[email] sent via Resend → ${msg.to}`);
    return true;
  }
  if (await sendViaMailerSend(msg)) {
    console.log(`[email] sent via MailerSend (fallback) → ${msg.to}`);
    return true;
  }
  console.error(`[email] all providers failed → ${msg.to}`);
  return false;
}
