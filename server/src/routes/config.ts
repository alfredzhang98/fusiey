/**
 * Public, read-only site config — values the storefront needs before login.
 *
 *   GET /api/config/shipping  →  { GBP: {freeOver, fee}, USD: {freeOver, fee} }
 *
 * Admins edit these via /api/admin/config (key "shipping").
 */

import { Router } from 'express';
import { getShippingConfig } from '../lib/shippingConfig.js';
import { getPublicSiteConfig } from '../lib/siteConfig.js';

export const configRoutes = Router();

configRoutes.get('/shipping', async (_req, res) => {
  const shipping = await getShippingConfig();
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.json(shipping);
});

// Public storefront settings: welcome discount %, announcement banner, TikTok URL.
configRoutes.get('/site', async (_req, res) => {
  const site = await getPublicSiteConfig();
  res.setHeader('Cache-Control', 'public, max-age=120');
  return res.json(site);
});
