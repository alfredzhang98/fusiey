import { Flame, Gift, FileImage, Grip, PackagePlus, Wrench, type LucideIcon } from 'lucide-react';

/**
 * Product taxonomy for the shop. The `key` is the canonical value stored in
 * Product.category on the server; the labels/icons drive the tab navigation.
 *
 * "Hot" is not a category — it's a curated view (carousel of `featured`
 * products + grid of `hot`-tagged ones), so it lives separately from the five
 * real categories below.
 */

export interface ProductCategory {
  key: string;
  label: string;
  zh: string;
  blurb: string;
  icon: LucideIcon;
}

export const HOT_TAB = {
  key: 'hot',
  label: 'Hot',
  zh: '热门',
  blurb: "This week's most-loved kits, patterns and tools.",
  icon: Flame,
} as const;

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { key: 'kit-pattern', label: 'Kits + Patterns', zh: '带图纸的套装', blurb: 'Complete kits — beads, board, and a printed pattern to follow.', icon: Gift },
  { key: 'pattern', label: 'Patterns', zh: '图纸', blurb: 'Printable bead charts and PDF patterns, ready to make.', icon: FileImage },
  { key: 'beads', label: 'Bead Kits', zh: '豆子套装', blurb: 'Bead boxes and colour sets — bring your own design.', icon: Grip },
  { key: 'refill', label: 'Refills', zh: '补充件', blurb: 'Single-colour bead refills, ironing paper and spares.', icon: PackagePlus },
  { key: 'tool', label: 'Tools', zh: '小工具', blurb: 'Pegboards, tweezers, sorting trays and more.', icon: Wrench },
];

/** All tabs in display order — Hot first, then the five categories. */
export const PRODUCT_TABS = [HOT_TAB, ...PRODUCT_CATEGORIES];
