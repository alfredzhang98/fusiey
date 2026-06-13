/**
 * Admin-configurable site settings, stored in SiteConfig (key/value JSON).
 * Read with sensible defaults so the site works before anything is set.
 */

import { prisma } from './prisma.js';

const DEFAULT_WELCOME_PERCENT = 10;

/** Welcome ("10% off your first kit") discount percentage. */
export async function getWelcomeDiscountPercent(): Promise<number> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'welcomeDiscountPercent' } });
  const v = Number(row?.value);
  return Number.isFinite(v) && v > 0 && v <= 100 ? Math.round(v) : DEFAULT_WELCOME_PERCENT;
}

export interface Announcement { enabled: boolean; text: string; }

/** Optional homepage announcement banner. */
export async function getAnnouncement(): Promise<Announcement> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'announcement' } });
  const v = (row?.value as any) || {};
  return { enabled: !!v.enabled, text: typeof v.text === 'string' ? v.text.slice(0, 300) : '' };
}

/** Public TikTok profile URL (homepage "follow us"). */
export async function getTiktokUrl(): Promise<string> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'tiktokUrl' } });
  const v = row?.value;
  return typeof v === 'string' ? v : '';
}

export interface WatermarkConfig {
  enabled: boolean;
  opacity: number; // 0–1 fraction (stored as a 1–100 percent in config)
  style: 'diagonal' | 'tiled' | 'corner';
}

/** Watermark settings applied to media-library image uploads. Default: on,
 *  12% centred diagonal (matches the original hard-coded behaviour). */
export async function getWatermarkConfig(): Promise<WatermarkConfig> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'watermark' } });
  const v = (row?.value as any) || {};
  const pct = Number(v.opacity);
  const opacity = Number.isFinite(pct) && pct > 0 && pct <= 100 ? pct / 100 : 0.12;
  const style = ['diagonal', 'tiled', 'corner'].includes(v.style) ? v.style : 'diagonal';
  const enabled = v.enabled === undefined ? true : !!v.enabled;
  return { enabled, opacity, style };
}

/** Bundle of public, non-sensitive site settings for the storefront. */
export async function getPublicSiteConfig() {
  const [welcomeDiscountPercent, announcement, tiktokUrl] = await Promise.all([
    getWelcomeDiscountPercent(),
    getAnnouncement(),
    getTiktokUrl(),
  ]);
  return { welcomeDiscountPercent, announcement, tiktokUrl };
}
