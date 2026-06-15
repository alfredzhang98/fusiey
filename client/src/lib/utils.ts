import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SyntheticEvent } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Brand placeholder shown when a product image is missing or fails to load. */
export const PLACEHOLDER_IMG = '/placeholder-product.svg';

/**
 * `onError` handler for product <img> tags: swaps a broken source (e.g. a media
 * asset deleted from the library) to the placeholder. Guards against an infinite
 * loop if the placeholder itself ever fails.
 */
export function imgFallback(e: SyntheticEvent<HTMLImageElement>) {
  const el = e.currentTarget;
  if (el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.src = PLACEHOLDER_IMG;
}
