/**
 * Fusiey-branded email templates. Email clients don't support web fonts or
 * external CSS, so everything is inline table-based HTML with the brand
 * palette: plum ink #572C5F, butter #FBD96B, cotton #F4A6C0, paper #FDFBF5.
 * Each template returns { subject, html, text }.
 */

import type { EmailMessage } from './emailService.js';

const INK = '#572C5F';
const BUTTER = '#FBD96B';
const COTTON = '#F4A6C0';
const MINT = '#A7E8C4';
const SKY = '#A6D8F0';
const PAPER = '#FDFBF5';
const SHOP_URL = process.env.APP_URL || 'https://fusiey.com';
const SUPPORT = 'fusiey@worldangle.work';
// Hosted logo image. The Fusiey logo PNG ships in the frontend (public/
// email-logo.png), so once APP_URL points at the live domain the email shows
// the real logo automatically. EMAIL_LOGO_URL overrides if hosted elsewhere.
// (Gmail blocks inline/base64 + SVG, so a hosted PNG URL is the only reliable
// way to show an image logo.)
const LOGO_URL =
  process.env.EMAIL_LOGO_URL ||
  (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/email-logo.png` : '');

/** Brand header: the hosted Fusiey logo if a public URL is available,
 *  otherwise an HTML "logo" (bead dots + wordmark) that renders in every
 *  client including Gmail. */
function brandHeader(): string {
  if (LOGO_URL) {
    return `<tr><td style="background:${INK};padding:24px;text-align:center;">
      <img src="${LOGO_URL}" alt="Fusiey" width="132" style="display:block;margin:0 auto 6px;border:0;max-width:60%;height:auto;">
      <div style="font-size:10px;letter-spacing:4px;color:${BUTTER};">PERLER&nbsp;BEAD&nbsp;STUDIO</div>
    </td></tr>`;
  }
  const dots = [COTTON, BUTTER, MINT, SKY]
    .map((c) => `<td style="padding:0 3px;"><div style="width:13px;height:13px;border-radius:50%;background:${c};border:1.5px solid #ffffff;"></div></td>`)
    .join('');
  return `<tr><td style="background:${INK};padding:26px 24px;text-align:center;">
    <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto 10px;"><tr>${dots}</tr></table>
    <div style="font-size:30px;font-weight:800;letter-spacing:2px;color:#ffffff;line-height:1;">Fusiey</div>
    <div style="margin-top:8px;font-size:10px;letter-spacing:4px;color:${BUTTER};">PERLER&nbsp;BEAD&nbsp;STUDIO</div>
  </td></tr>`;
}

/** Shared shell: plum header with the Fusiey wordmark + content + footer. */
function shell(contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:2px solid ${INK};border-radius:16px;overflow:hidden;">
        ${brandHeader()}
        <tr><td style="padding:32px 28px;color:#2D2D2D;">${contentHtml}</td></tr>
        <tr><td style="background:${PAPER};padding:18px 28px;text-align:center;border-top:1px solid #eee;">
          <p style="margin:0;font-size:11px;color:#999;">Fusiey · Shanghai Worldangle Technology Co., Ltd.</p>
          <p style="margin:5px 0 0;font-size:11px;color:#bbb;">This email was sent automatically — please don't reply. Need help? ${SUPPORT}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Email-verification code (registration). */
export function verificationCodeEmail(code: string): EmailMessage {
  const html = shell(`
    <h1 style="margin:0 0 8px;font-size:20px;color:${INK};">Verify your email</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.55;">Welcome to Fusiey! Enter this code to confirm your email and start designing.</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:#FBF4D0;border:2px dashed ${INK};border-radius:12px;padding:16px 32px;">
        <span style="font-size:38px;font-weight:bold;letter-spacing:10px;color:${INK};">${code}</span>
      </div>
    </div>
    <p style="margin:0;font-size:13px;color:#888;">This code is valid for <strong>10 minutes</strong>. Please don't share it with anyone.</p>
  `);
  return {
    to: '',
    subject: 'Your Fusiey verification code',
    html,
    text: `Your Fusiey verification code is ${code}. It is valid for 10 minutes. Do not share it with anyone.`,
  };
}

/** Password-reset code (forgot password). 6-digit, short-lived. */
export function passwordResetEmail(code: string): EmailMessage {
  const html = shell(`
    <h1 style="margin:0 0 8px;font-size:20px;color:${INK};">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.55;">We got a request to reset your Fusiey password. Enter this code to choose a new one.</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;background:#FBF4D0;border:2px dashed ${INK};border-radius:12px;padding:16px 32px;">
        <span style="font-size:38px;font-weight:bold;letter-spacing:10px;color:${INK};">${code}</span>
      </div>
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:#888;">This code is valid for <strong>10 minutes</strong>. Please don't share it with anyone.</p>
    <p style="margin:0;font-size:13px;color:#888;">If you didn't ask to reset your password, you can safely ignore this email — your password stays the same.</p>
  `);
  return {
    to: '',
    subject: 'Reset your Fusiey password',
    html,
    text: `Your Fusiey password reset code is ${code}. It is valid for 10 minutes. If you didn't request this, ignore this email.`,
  };
}

/** Welcome + first-order discount, sent after the email is verified. */
export function welcomeDiscountEmail(discountCode: string): EmailMessage {
  const html = shell(`
    <h1 style="margin:0 0 8px;font-size:20px;color:${INK};">Welcome to Fusiey! 🎉</h1>
    <p style="margin:0 0 18px;font-size:14px;color:#555;line-height:1.55;">Your email is verified. As a thank-you, here's <strong>10% off your first kit</strong>.</p>
    <div style="text-align:center;margin:22px 0;">
      <div style="display:inline-block;background:${COTTON};border:2px solid ${INK};border-radius:14px;padding:14px 30px;">
        <div style="font-size:10px;letter-spacing:2px;color:${INK};margin-bottom:4px;">YOUR 10% OFF CODE</div>
        <span style="font-size:26px;font-weight:bold;letter-spacing:3px;color:${INK};">${discountCode}</span>
      </div>
    </div>
    <p style="margin:0 0 22px;font-size:13px;color:#888;">Enter it at checkout on your first kit. Happy beading!</p>
    <div style="text-align:center;">
      <a href="${SHOP_URL}/products" style="display:inline-block;background:${BUTTER};border:2px solid ${INK};border-radius:24px;padding:11px 28px;font-size:14px;font-weight:bold;color:${INK};text-decoration:none;">Shop kits →</a>
    </div>
  `);
  return {
    to: '',
    subject: 'Welcome to Fusiey — 10% off your first kit 🎉',
    html,
    text: `Welcome to Fusiey! Here's 10% off your first kit: ${discountCode}. Use it at checkout. Shop: ${SHOP_URL}/products`,
  };
}

/** Security notice after a password change. */
export function passwordChangedEmail(): EmailMessage {
  const html = shell(`
    <h1 style="margin:0 0 8px;font-size:20px;color:${INK};">Your password was changed</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.55;">The password for your Fusiey account was just updated. If this was you, no action is needed.</p>
    <p style="margin:0;font-size:13px;color:#888;">If you did <strong>not</strong> make this change, please contact us immediately at <a href="mailto:${SUPPORT}" style="color:${INK};">${SUPPORT}</a>.</p>
  `);
  return {
    to: '',
    subject: 'Your Fusiey password was changed',
    html,
    text: `The password for your Fusiey account was just changed. If this wasn't you, contact ${SUPPORT} immediately.`,
  };
}
