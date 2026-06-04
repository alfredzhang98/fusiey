/**
 * Eye catchlight post-process.
 *
 * Why: Gemini reliably paints eye pupils as 2-3 block dark blobs but often
 * forgets the tiny white "shine" highlight inside them (user screenshots:
 * Pikachu ends up with featureless black eyes → looks dead). Prompting for
 * a sclera ring is also unreliable because the character's canonical design
 * may not have one (e.g. Pokémon).
 *
 * Deterministic fix: after palette mapping, take the eye bounding boxes
 * Gemini's analysis already returns, find the dark pixel cluster inside
 * each bbox, and flip ONE cell at the cluster's top-left corner to pure
 * white. That single white bead reads as a catchlight and brings the
 * eye to life.
 *
 * Guards:
 *   - Caller gates on `analysis.autoTools.eyeEnhance && eyeBboxes?.length`
 *   - Silently no-ops when the bbox contains no dark cells (bbox was wrong
 *     or the AI failed to draw eyes — we don't invent dark pixels where
 *     none exist).
 *   - Skips bboxes with only 1 dark cell — single-cell "clusters" are
 *     likely noise, not a real pupil.
 */

import type { Color } from '../../types';
import type { MappedGrid } from './paletteMap';

/** Pick the brightest (highest luminance) palette entry — usually H1 white. */
function whitestColor(palette: Color[]): Color | null {
  let best: Color | null = null;
  let bestLum = -1;
  for (const c of palette) {
    const h = c.hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > bestLum) {
      bestLum = lum;
      best = c;
    }
  }
  return best;
}

/**
 * Add a white catchlight inside each eye bbox. Mutates `grid` in place.
 *
 * @returns number of catchlights actually placed (for debug / telemetry).
 */
export function addEyeCatchlights(
  grid: MappedGrid,
  palette: Color[],
  eyeBboxes: readonly [number, number, number, number][] | undefined,
): number {
  if (!eyeBboxes || eyeBboxes.length === 0) return 0;

  const white = whitestColor(palette);
  if (!white) return 0;

  const darkIds = new Set(
    palette.filter((c) => c.isDark || c.isInk).map((c) => c.id),
  );
  if (darkIds.size === 0) return 0;

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return 0;

  let placed = 0;

  for (const [nx, ny, nw, nh] of eyeBboxes) {
    // Normalized bbox → grid cell coordinates. Clamp to grid bounds so
    // a Gemini bbox extending past the canvas doesn't crash the loop.
    const x0 = Math.max(0, Math.floor(nx * width));
    const y0 = Math.max(0, Math.floor(ny * height));
    const x1 = Math.min(width, Math.ceil((nx + nw) * width));
    const y1 = Math.min(height, Math.ceil((ny + nh) * height));
    if (x1 <= x0 || y1 <= y0) continue;

    // Collect dark cells within the bbox.
    const darkCells: [number, number][] = [];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const cell = grid[y]?.[x];
        if (cell?.colorId && darkIds.has(cell.colorId)) {
          darkCells.push([x, y]);
        }
      }
    }

    // Need at least 2 dark cells to be confident this is a real pupil and
    // not a stray dark speck from Gemini over-drawing a lash or freckle.
    if (darkCells.length < 2) continue;

    // Classic anime catchlight goes at the top-left of the pupil. Sort
    // (y, x) ascending and take the first hit — the top-leftmost dark cell.
    darkCells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const [cx, cy] = darkCells[0];

    // Paint the cell white. Keep the originalColor so hover / debug tooling
    // can still show what the sampler saw before the override.
    grid[cy][cx] = {
      colorId: white.id,
      originalColor: grid[cy][cx]?.originalColor ?? white.hex,
    };
    placed++;
  }

  return placed;
}
