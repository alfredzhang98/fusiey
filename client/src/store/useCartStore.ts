/**
 * Cart store — persisted to localStorage so items survive refresh.
 *
 * Each cart item ties a Product to an optional SavedPattern (for custom
 * designs turned into orders). The same product+pattern combo bumps
 * quantity rather than creating a duplicate line.
 *
 * Items carry BOTH region prices (GBP + USD); the price shown/charged is
 * chosen by the active currency at render/checkout time (no FX conversion).
 * If a product has no price in the active region (priceUSD === null) it can't
 * be purchased there — the checkout flags it.
 */

import { create } from 'zustand';
import type { ProductItem } from '../services/api';
import type { Currency } from './useCurrencyStore';

export interface CartItem {
  /** Unique key for this cart line — `${productId}__${patternId || 'none'}` */
  key: string;
  productId: string;
  productName: string;
  productImage: string;
  priceGBP: number;
  priceUSD: number | null;
  patternId?: string;
  patternName?: string;
  quantity: number;
}

/** Unit price of a cart line in the active currency, or null if not sold there. */
export function unitPriceFor(item: CartItem, currency: Currency): number | null {
  return currency === 'USD' ? item.priceUSD : item.priceGBP;
}

interface CartState {
  items: CartItem[];
  addItem: (product: ProductItem, patternId?: string, patternName?: string, quantity?: number) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: () => number;
  /** Sum of line totals in the active currency (skips items not sold there). */
  subtotal: (currency: Currency) => number;
}

const STORAGE_KEY = 'fusiey_cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    // Migrate legacy carts that stored a single `unitPrice` (GBP).
    return parsed.map((i) =>
      i.priceGBP != null
        ? i
        : { ...i, priceGBP: i.unitPrice ?? 0, priceUSD: null },
    );
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: loadCart(),

  addItem: (product, patternId, patternName, quantity = 1) => {
    const key = `${product.id}__${patternId || 'none'}`;
    set((state) => {
      const existing = state.items.find((i) => i.key === key);
      let next: CartItem[];
      if (existing) {
        next = state.items.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i,
        );
      } else {
        next = [
          ...state.items,
          {
            key,
            productId: product.id,
            productName: product.name,
            productImage: product.images[0] || '',
            priceGBP: product.priceGBP,
            priceUSD: product.priceUSD,
            patternId,
            patternName,
            quantity,
          },
        ];
      }
      saveCart(next);
      return { items: next };
    });
  },

  removeItem: (key) => {
    set((state) => {
      const next = state.items.filter((i) => i.key !== key);
      saveCart(next);
      return { items: next };
    });
  },

  updateQuantity: (key, quantity) => {
    if (quantity <= 0) {
      get().removeItem(key);
      return;
    }
    set((state) => {
      const next = state.items.map((i) =>
        i.key === key ? { ...i, quantity } : i,
      );
      saveCart(next);
      return { items: next };
    });
  },

  clearCart: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ items: [] });
  },

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  subtotal: (currency) =>
    get().items.reduce((sum, i) => {
      const unit = unitPriceFor(i, currency);
      return unit == null ? sum : sum + unit * i.quantity;
    }, 0),
}));
