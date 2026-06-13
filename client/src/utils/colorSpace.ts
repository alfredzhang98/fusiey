/**
 * Colour-space utilities used throughout BeadEngine v2.
 *
 * All palette matching happens in CIE LAB with CIEDE2000 distance — the
 * current industry standard for perceptual colour differences. This fixes
 * v1's biggest weakness (weighted RGB) where pastels frequently matched to
 * the "wrong" palette entry because Euclidean RGB doesn't track what the
 * eye actually sees.
 *
 * No external deps — pure math, ~3 KB gzipped.
 */

export type RGB = readonly [number, number, number]; // 0-255 ints
export type LAB = readonly [number, number, number]; // L* 0-100, a* / b* ~ ±128

// ──────────────────────────────────────────────────────────────────────
// Basic converters
// ──────────────────────────────────────────────────────────────────────

/** `"#F7A5B8"` → `[247, 165, 184]`. Accepts 3 or 6 hex digits. */
export function hexToRgb(hex: string): RGB {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Fast inverse (used by cache key / debug only). */
export function rgbToHex([r, g, b]: RGB): string {
  const h = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return `#${h}`;
}

/** sRGB → linear light. */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
}

/** RGB (sRGB, 0-255) → LAB (D65 reference white). */
export function rgbToLab([r, g, b]: RGB): LAB {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  // To XYZ (D65 illuminant)
  let X = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  let Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  let Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  // Normalise by D65 white point
  X /= 0.95047;
  Z /= 1.08883;

  // Non-linear f(t)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bStar = 200 * (fy - fz);
  return [L, a, bStar];
}

/** Chroma (saturation proxy): distance from the L axis in the a-b plane. */
export function labChroma(lab: LAB): number {
  return Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
}

/** Perceived lightness (0-100) — just the L channel. */
export function labLightness(lab: LAB): number {
  return lab[0];
}

// ──────────────────────────────────────────────────────────────────────
// CIEDE2000 — perceptual colour distance
// Reference: Sharma et al., "The CIEDE2000 Colour-Difference Formula"
// http://www2.ece.rochester.edu/~gsharma/ciede2000/ciede2000noteCRNA.pdf
// ──────────────────────────────────────────────────────────────────────

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

/** Returns the perceptual distance between two LAB colours (0 = identical). */
export function ciede2000(lab1: LAB, lab2: LAB): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  // Step 1 — calculate Ci, hi
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  const h1p = atan2Deg(b1, a1p);
  const h2p = atan2Deg(b2, a2p);

  // Step 2 — deltas
  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    const d = h2p - h1p;
    if (d > 180) dhp = d - 360;
    else if (d < -180) dhp = d + 360;
    else dhp = d;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  // Step 3 — weighting functions
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let Hbarp: number;
  if (C1p * C2p === 0) {
    Hbarp = h1p + h2p;
  } else {
    const d = Math.abs(h1p - h2p);
    const s = h1p + h2p;
    if (d <= 180) Hbarp = s / 2;
    else if (s < 360) Hbarp = (s + 360) / 2;
    else Hbarp = (s - 360) / 2;
  }

  const T =
    1
    - 0.17 * Math.cos((Hbarp - 30) * RAD)
    + 0.24 * Math.cos((2 * Hbarp) * RAD)
    + 0.32 * Math.cos((3 * Hbarp + 6) * RAD)
    - 0.20 * Math.cos((4 * Hbarp - 63) * RAD);

  const Lbar50Sq = (Lbar - 50) * (Lbar - 50);
  const Sl = 1 + (0.015 * Lbar50Sq) / Math.sqrt(20 + Lbar50Sq);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;

  const dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 6103515625));
  const Rt = -Math.sin(2 * dTheta * RAD) * Rc;

  // Step 4 — combine
  const termL = dLp / Sl;
  const termC = dCp / Sc;
  const termH = dHp / Sh;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + Rt * termC * termH);
}

function atan2Deg(y: number, x: number): number {
  if (y === 0 && x === 0) return 0;
  const d = Math.atan2(y, x) * DEG;
  return d < 0 ? d + 360 : d;
}

// ──────────────────────────────────────────────────────────────────────
// Convenience wrappers
// ──────────────────────────────────────────────────────────────────────

/** Perceptual distance between two sRGB colours (bypasses LAB if you want). */
export function rgbDistance(a: RGB, b: RGB): number {
  return ciede2000(rgbToLab(a), rgbToLab(b));
}

/** Minimum CIEDE2000 distance from a target colour to any colour in a palette.
 *  Returns `{ idx, distance }` where `idx` is the palette index of the winner. */
export function nearestLab(
  target: LAB,
  candidates: readonly LAB[],
): { idx: number; distance: number } {
  if (candidates.length === 0) return { idx: -1, distance: Infinity };
  let bestIdx = 0;
  let bestDist = ciede2000(target, candidates[0]);
  for (let i = 1; i < candidates.length; i++) {
    const d = ciede2000(target, candidates[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { idx: bestIdx, distance: bestDist };
}

// ──────────────────────────────────────────────────────────────────────
// Palette pre-computation cache
// ──────────────────────────────────────────────────────────────────────

/** One palette entry pre-converted to LAB for fast matching. */
export interface LabPaletteEntry<T = unknown> {
  lab: LAB;
  rgb: RGB;
  ref: T; // keeps the caller's original object (Color) untouched
}

/** Pre-compute LAB for every colour in a palette. Do this once per pipeline run. */
export function buildLabPalette<T extends { hex: string }>(items: readonly T[]): LabPaletteEntry<T>[] {
  return items.map((item) => {
    const rgb = hexToRgb(item.hex);
    return { lab: rgbToLab(rgb), rgb, ref: item };
  });
}
