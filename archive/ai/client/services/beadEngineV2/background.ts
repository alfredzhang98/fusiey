/**
 * Background detection — flood-fill of near-white cells from the canvas edges.
 *
 * Cells reachable from any edge by walking through "near-white" neighbours
 * are marked as background. Downstream paletteMap turns these into
 * `colorId: null` so the user sees an empty peg pattern (× marks) instead
 * of a sea of white beads — physical perler boards actually have nothing
 * at those positions.
 *
 * Crucially this DOES NOT touch white pixels in the *interior* of the
 * subject (e.g. Tom's belly, eye highlights) — those are surrounded by
 * non-white cells so the flood never reaches them.
 */

import type { RawGrid } from './pixelate';
import { rgbToLab, labChroma, type RGB } from './colorSpace';

/** L* > 92 AND chroma < 5 ≈ "off-white or pure white". */
const WHITE_LIGHTNESS = 92;
const WHITE_CHROMA = 5;

function isNearWhite(rgb: RGB): boolean {
  const lab = rgbToLab(rgb);
  return lab[0] > WHITE_LIGHTNESS && labChroma(lab) < WHITE_CHROMA;
}

/**
 * Compute a `boolean[][]` background mask for `raw` (true = background).
 *
 * Two strategies, in order:
 *
 *   1. **Alpha pass (preferred)**. If ANY cell is non-opaque, the source
 *      image arrived with a real alpha channel — Replicate's RMBG-2.0
 *      handed us a transparent PNG. Trust it directly: every non-opaque
 *      cell is background, every opaque cell is subject. No flood-fill,
 *      no leakage into the subject's interior whites.
 *
 *   2. **Flood-fill fallback**. When the image is fully opaque (e.g.
 *      Replicate not configured, AI returned solid-white background),
 *      flood near-white from the four canvas edges. Imperfect — narrow
 *      white channels in the subject (mouths, eyes) can leak — which is
 *      exactly why we prefer path 1 above.
 */
export function detectBackgroundMask(raw: RawGrid): boolean[][] {
  const h = raw.length;
  const w = raw[0]?.length ?? 0;
  if (w === 0 || h === 0) return [];

  // Path 1 — alpha-based detection.
  const hasTransparency = raw.some((row) => row.some((c) => !c.opaque));
  if (hasTransparency) {
    return raw.map((row) => row.map((c) => !c.opaque));
  }

  // Path 2 — flood-fill from edges (legacy heuristic).
  const mask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
  const stack: [number, number][] = [];

  const seedIfWhite = (x: number, y: number) => {
    if (mask[y][x]) return;
    const cell = raw[y][x];
    if (!cell.opaque || isNearWhite(cell.rgb)) {
      mask[y][x] = true;
      stack.push([x, y]);
    }
  };
  for (let x = 0; x < w; x++) {
    seedIfWhite(x, 0);
    seedIfWhite(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    seedIfWhite(0, y);
    seedIfWhite(w - 1, y);
  }

  const NEIGH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of NEIGH) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      if (mask[ny][nx]) continue;
      const c = raw[ny][nx];
      if (!c.opaque || isNearWhite(c.rgb)) {
        mask[ny][nx] = true;
        stack.push([nx, ny]);
      }
    }
  }

  return mask;
}
