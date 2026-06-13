/**
 * Display + charge currency. Two regions only:
 *   GBP (£) — UK home market + default, and the currency PayPal settles into.
 *   USD ($) — US region.
 *
 * Region is determined SOLELY by the visitor's country (server `/api/geo`,
 * which prefers Cloudflare's cf-ipcountry header). There is no manual currency
 * switcher — the last detected currency is cached for a flicker-free first
 * paint, with a navigator-language fallback before geo resolves.
 *
 * Prices are NOT converted — each product carries its own manually-set GBP and
 * USD price. `regionPrice()` returns the price for the active currency, or null
 * when the product isn't sold in that region. VAT (20%) is included in prices.
 */

import { create } from 'zustand';

export type Currency = 'GBP' | 'USD';

export const CURRENCIES: Record<Currency, { symbol: string; label: string }> = {
  GBP: { symbol: '£', label: 'GBP £' },
  USD: { symbol: '$', label: 'USD $' },
};

export const VAT_RATE = 0.2; // UK standard rate, included in displayed prices

/** VAT portion already baked into a VAT-inclusive amount. */
export function vatPortion(gross: number): number {
  return gross - gross / (1 + VAT_RATE);
}

/** Format an amount that is ALREADY in the given currency (no conversion). */
export function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCIES[currency].symbol}${amount.toFixed(2)}`;
}

/** A product's price in the active region, or null if not sold there. */
export function regionPrice(
  product: { priceGBP: number; priceUSD: number | null },
  currency: Currency,
): number | null {
  return currency === 'USD' ? product.priceUSD : product.priceGBP;
}

/** Whether a product is purchasable in the active region. */
export function isAvailable(
  product: { priceGBP: number; priceUSD: number | null },
  currency: Currency,
): boolean {
  return regionPrice(product, currency) != null;
}

const STORAGE_KEY = 'fusiey_currency'; // caches the last geo-detected currency

/** Synchronous best-guess for first paint: cached geo result, else locale. */
function detectCurrency(): Currency {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'GBP' || saved === 'USD') return saved;
  } catch { /* ignore */ }
  const lang = (navigator.language || 'en-GB').toLowerCase();
  return lang.startsWith('en-us') ? 'USD' : 'GBP'; // default for a UK-first shop
}

interface CurrencyState {
  currency: Currency;
  /** Resolve the currency from the server's country lookup (cf-ipcountry / GeoIP). */
  initFromGeo: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  currency: detectCurrency(),

  async initFromGeo() {
    try {
      const res = await fetch('/api/geo', { credentials: 'include' });
      if (!res.ok) return;
      const { currency } = (await res.json()) as { currency: Currency };
      if (currency === 'GBP' || currency === 'USD') {
        try { localStorage.setItem(STORAGE_KEY, currency); } catch { /* ignore */ }
        set({ currency });
      }
    } catch { /* offline / blocked — keep the locale guess */ }
  },
}));
