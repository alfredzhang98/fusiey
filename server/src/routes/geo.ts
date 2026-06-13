/**
 * Geo route — picks the display/charge currency from the visitor's country.
 *
 *   GET /api/geo  →  { country, currency }
 *
 * Country is resolved in priority order:
 *   1. Cloudflare's `cf-ipcountry` header (set automatically once deployed
 *      behind Cloudflare — the most reliable source). Note CF uses ISO codes:
 *      UK is "GB", not "UK".
 *   2. Offline geoip-lite lookup on the client IP (works without a CDN, e.g.
 *      local/dev or a non-CF host). Behind nginx, `trust proxy` makes req.ip +
 *      X-Forwarded-For reflect the real client.
 *
 * US → USD; everything else → GBP (UK is the home market + default).
 */

import { Router } from 'express';
import geoip from 'geoip-lite';

export const geoRoutes = Router();

/** Extract the best-guess client IP from the request. */
function clientIp(req: any): string {
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return fwd || req.ip || req.socket?.remoteAddress || '';
}

/** Resolve the visitor's ISO country code (CF header first, then GeoIP). */
function resolveCountry(req: any): string | null {
  const cf = (req.headers['cf-ipcountry'] as string | undefined)?.toUpperCase().trim();
  // CF sends "XX"/"T1" for unknown/Tor — treat those as no-country.
  if (cf && cf.length === 2 && cf !== 'XX' && cf !== 'T1') return cf;
  const ip = clientIp(req).replace(/^::ffff:/, ''); // unwrap IPv4-mapped IPv6
  return (ip ? geoip.lookup(ip)?.country : null) || null;
}

geoRoutes.get('/', (req, res) => {
  const country = resolveCountry(req);
  const currency = country === 'US' ? 'USD' : 'GBP';
  // Short cache — country won't change between requests from the same client.
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.json({ country, currency });
});
