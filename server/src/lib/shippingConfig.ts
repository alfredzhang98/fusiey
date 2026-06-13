/**
 * Shipping rules — admin-configurable, stored in SiteConfig under key
 * "shipping". Per region: a free-shipping threshold + a flat fee, in that
 * region's own currency (no FX). Falls back to sensible defaults when unset.
 */

import { prisma } from './prisma.js';

export type Region = 'GBP' | 'USD';

export interface ShippingRule {
  freeOver: number; // free shipping at/above this order subtotal
  fee: number;      // flat shipping fee below the threshold
}

export type ShippingConfig = Record<Region, ShippingRule>;

export const DEFAULT_SHIPPING: ShippingConfig = {
  GBP: { freeOver: 50, fee: 4.99 },
  USD: { freeOver: 65, fee: 6.99 },
};

function num(x: any, fallback: number): number {
  return typeof x === 'number' && isFinite(x) && x >= 0 ? x : fallback;
}

/** Read the shipping config from SiteConfig, merged over defaults. */
export async function getShippingConfig(): Promise<ShippingConfig> {
  const row = await prisma.siteConfig.findUnique({ where: { key: 'shipping' } });
  const v = (row?.value as any) || {};
  return {
    GBP: {
      freeOver: num(v?.GBP?.freeOver, DEFAULT_SHIPPING.GBP.freeOver),
      fee: num(v?.GBP?.fee, DEFAULT_SHIPPING.GBP.fee),
    },
    USD: {
      freeOver: num(v?.USD?.freeOver, DEFAULT_SHIPPING.USD.freeOver),
      fee: num(v?.USD?.fee, DEFAULT_SHIPPING.USD.fee),
    },
  };
}
