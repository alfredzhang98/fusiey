/**
 * Colour display helpers — naming + legible code-label colours.
 *
 * `codeTextColor(hex)` answers: "what text colour keeps the bead code
 * readable on top of THIS bead?" It compares WCAG contrast ratios of the
 * brand ink vs white against the bead colour and returns the winner — so
 * light beads get dark codes and dark beads get white codes, with mid-tones
 * resolved by actual contrast rather than a fragile brightness threshold.
 */

const INK = '#1B1213';   // darkest brand neutral (H16) — beats #572C5F on mid-tones
const WHITE = '#FFFFFF';

function srgbChannel(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a #RRGGBB hex. */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = srgbChannel((n >> 16) & 0xff);
  const g = srgbChannel((n >> 8) & 0xff);
  const b = srgbChannel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1–21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const textColorCache = new Map<string, string>();

/** Best-contrast label colour (ink or white) for text shown on `bgHex`. */
export function codeTextColor(bgHex: string): string {
  const cached = textColorCache.get(bgHex);
  if (cached) return cached;
  const result = contrastRatio(bgHex, INK) >= contrastRatio(bgHex, WHITE) ? INK : WHITE;
  textColorCache.set(bgHex, result);
  return result;
}

// ── auto-naming ─────────────────────────────────────────────────────────

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

const HUE_NAMES: [number, string][] = [
  [12, 'Red'], [38, 'Orange'], [66, 'Yellow'], [95, 'Lime'],
  [150, 'Green'], [180, 'Teal'], [200, 'Cyan'], [250, 'Blue'],
  [290, 'Purple'], [330, 'Magenta'], [348, 'Pink'], [360, 'Red'],
];

/**
 * Deterministic human-readable name from a hex value, e.g. "Light Green",
 * "Deep Blue", "Grey". Codes stay the canonical identifier; names are a
 * friendly hint, so collisions across similar shades are fine.
 */
export function autoName(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  if (s < 0.09 || l > 0.97 || l < 0.04) {
    if (l > 0.93) return 'White';
    if (l > 0.72) return 'Light Grey';
    if (l > 0.45) return 'Grey';
    if (l > 0.15) return 'Dark Grey';
    return 'Black';
  }
  const hue = HUE_NAMES.find(([max]) => h <= max)![1];
  if (l > 0.85) return `Pale ${hue}`;
  if (l > 0.68) return `Light ${hue}`;
  if (l < 0.22) return `Dark ${hue}`;
  if (l < 0.38) return `Deep ${hue}`;
  return hue;
}
