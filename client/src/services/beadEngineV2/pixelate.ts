/**
 * Stage 1 — Pixelation.
 *
 * Downsamples a stylised source image to canvasSize × canvasSize, and for
 * each target cell picks a representative colour using one of two strategies
 * based on the cell's internal variance:
 *
 *   - Low variance (smooth region)  → mean colour (preserves soft tones)
 *   - High variance (edge / detail) → dominant K=2 mode (preserves edges)
 *
 * The mix point is governed by `tuning.edgeBias` so Evaluator can bias the
 * whole pipeline toward "more edge" or "more smooth" during retry.
 */

import type { RGB } from './colorSpace';

/** Per-cell output before palette mapping. */
export interface CellRaw {
  rgb: RGB;         // chosen representative colour
  opaque: boolean;  // at least one pixel was non-transparent
  isEdge: boolean;  // had high internal variance → treat as edge in Stage 2
  variance: number; // luminance std-dev,0-255 ish,keep for debug / tools
}

/** Pixelation output — a 2D array of raw cell descriptors. */
export type RawGrid = CellRaw[][];

/** Load a base64 / URL string into an ImageData buffer via off-screen canvas. */
export async function loadImagePixels(
  src: string,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, img.width, img.height);
      resolve({ data: id.data, width: img.width, height: img.height });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Fix F — Grid-snap downsample for the AI path.
 *
 * Gemini's prompt asks for `blockPx × blockPx` AI blocks where
 * `blockPx = floor(1024 / max(gridW, gridH))`. But 1024/gridW is rarely
 * integer (e.g. 50 → 20.48), so after Gemini fills the 1024 canvas, its
 * block edges drift relative to our cell edges — a 1-AI-block outline ends
 * up straddling 2 cells and both fire the dark-mass gate → 2-cell-thick
 * outlines (classic Pikachu mouth artifact).
 *
 * Fix: rescale the AI image to exactly `gridW*blockPx × gridH*blockPx`
 * BEFORE pixelate. Cell boundaries then lock to AI block boundaries —
 * straddle eliminated at the root.
 *
 * Must mirror the server-side blockPx formula in
 * `server/src/services/geminiService.ts:187`.
 */
export async function snapToBlockGrid(
  src: string,
  gridW: number,
  gridH: number,
): Promise<{ data: Uint8ClampedArray; width: number; height: number; blockPx: number }> {
  const blockPx = Math.max(4, Math.floor(1024 / Math.max(gridW, gridH)));
  const targetW = gridW * blockPx;
  const targetH = gridH * blockPx;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      // Nearest-neighbor — bilinear bleed created mid-tone halos at AI
      // block edges that fired the dark-mass gate in adjacent cells →
      // fake 2-thick outlines that thinOutlines would then shift inward.
      // With smoothing off each AI block maps to exactly one cell, crisp.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve({
        data: ctx.getImageData(0, 0, targetW, targetH).data,
        width: targetW,
        height: targetH,
        blockPx,
      });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Sampling strategy:
 *   - 'box-average' — average all pixels in the cell (current default).
 *     Robust for messy photos but smears AI block boundaries into mid-tones.
 *   - 'center-patch' — average a 3×3 patch at the cell centre only.
 *     Ideal for clean pixel-art input (Gemini stylized output) because it
 *     dodges block-edge anti-aliasing entirely.
 */
export type SampleMode = 'box-average' | 'center-patch';

/**
 * Extra knobs for pixelate. Only the `center-patch` (AI) branch consumes
 * them; `box-average` ignores everything here.
 */
export interface PixelateOptions {
  /** After `snapToBlockGrid`, the integer AI block size in source pixels
   *  (= cellW = cellH). 0 or undefined = not snapped → dynamic threshold
   *  falls back to a neutral constant. */
  blockPx?: number;
  /** Normalised [bx, by, bw, bh] in 0..1 grid coords (same format as
   *  `AnalysisV2.eyeBboxes`). Cells inside any bbox use the tight pre-F
   *  dark gate so small pupils don't get lost when F raises the outside
   *  threshold. */
  eyeBboxes?: [number, number, number, number][];
}

/**
 * Downscale `data` to `gridW × gridH` cells. Returns `RawGrid` containing
 * per-cell representative colour + metadata.
 *
 * @param data      pixel buffer in RGBA
 * @param origW     source pixel width
 * @param origH     source pixel height
 * @param gridW     target columns (e.g. 50)
 * @param gridH     target rows
 * @param edgeBias  0-1 (0 = always-mean, 1 = always-dominant). Only used in
 *                  'box-average' mode. Default 0.3.
 * @param sampleMode 'box-average' (default) | 'center-patch' (for AI input).
 * @param options   See `PixelateOptions` — only consumed by center-patch.
 */
export function pixelate(
  data: Uint8ClampedArray,
  origW: number,
  origH: number,
  gridW: number,
  gridH: number,
  edgeBias = 0.3,
  sampleMode: SampleMode = 'box-average',
  options: PixelateOptions = {},
): RawGrid {
  const varianceThreshold = (1 - edgeBias) * 60;

  const out: RawGrid = [];
  const bw = origW / gridW;
  const bh = origH / gridH;

  for (let gy = 0; gy < gridH; gy++) {
    const row: CellRaw[] = [];
    for (let gx = 0; gx < gridW; gx++) {
      const x0 = Math.floor(gx * bw);
      const y0 = Math.floor(gy * bh);
      const x1 = Math.min(origW, Math.ceil((gx + 1) * bw));
      const y1 = Math.min(origH, Math.ceil((gy + 1) * bh));

      row.push(
        sampleMode === 'center-patch'
          ? sampleCenterPatch(data, origW, x0, y0, x1, y1, gx, gy, gridW, gridH, options)
          : analyseCell(data, origW, x0, y0, x1, y1, varianceThreshold),
      );
    }
    out.push(row);
  }
  return out;
}

/**
 * Sample a cell primarily from its 3×3 centre, BUT also scan the whole
 * cell for dark pixels — if the dark-mass ratio exceeds the per-cell
 * `DARK_MASS` gate (luminance < `DARK_LUM_THRESHOLD`), an outline is
 * likely passing through. In that case we return the mean of the dark
 * pixels instead of the bright centre, and flag `isEdge: true` so the
 * palette mapper routes the cell through the dark/ink palette subset.
 *
 * This fixes a common failure mode: a 1-pixel outline in the AI image
 * passes through the edge of a 20×20 cell. Plain centre-patch samples
 * only the middle 3×3 → outline invisible → cell becomes the body colour
 * → outline breaks into fragments.
 */
function sampleCenterPatch(
  data: Uint8ClampedArray,
  stride: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gx: number,
  gy: number,
  gridW: number,
  gridH: number,
  options: PixelateOptions,
): CellRaw {
  const ch = 4;
  const cellW = x1 - x0;
  const cellH = y1 - y0;
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const half = 1;

  // ── Dynamic dark-gate thresholds (Fix D) ─────────────────────────────
  // Inside an eye bbox we KEEP the pre-F tight gate so small pupils
  // (~6-8 % cell area at 50×50) still fire. Outside, after F has locked
  // cell↔AI-block alignment, expectedBlockMass ≈ 1.0 → DARK_MASS ≈ 0.25,
  // so a 1-AI-block outline straddling two cells (~30 % + ~70 %) only
  // stamps the strong side and the weak side stays clean.
  const cellArea = cellW * cellH;
  const nx = (gx + 0.5) / gridW;
  const ny = (gy + 0.5) / gridH;
  const insideEye =
    options.eyeBboxes?.some(
      ([bx, by, bw, bh]) => nx >= bx && nx <= bx + bw && ny >= by && ny <= by + bh,
    ) ?? false;
  const bp = options.blockPx ?? 0;
  const expectedBlockMass = bp > 0 ? (bp * bp) / cellArea : 1;
  const DARK_MASS = insideEye ? 0.12 : Math.min(0.25, 0.30 * expectedBlockMass);
  const DARK_COUNT = Math.max(2, Math.round(cellArea * 0.01));

  // Centre 3×3 accumulators
  let rc = 0, gc = 0, bc = 0, nc = 0;
  // Full-cell dark accumulators (L < DARK_LUM_THRESHOLD)
  let rd = 0, gd = 0, bd = 0, nd = 0;
  let opaqueCount = 0;

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * stride + px) * ch;
      const a = data[i + 3];
      if (a < 128) continue;
      opaqueCount++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < DARK_LUM_THRESHOLD) {
        nd++; rd += r; gd += g; bd += b;
      }
      // Centre 3×3
      if (py >= cy - half && py <= cy + half && px >= cx - half && px <= cx + half) {
        nc++; rc += r; gc += g; bc += b;
      }
    }
  }

  if (opaqueCount === 0) {
    return { rgb: [255, 255, 255], opaque: false, isEdge: false, variance: 0 };
  }

  const totalArea = cellW * cellH;
  const darkRatio = nd / totalArea;

  // Gate dark-branch on TWO disjoint conditions:
  //   (1) darkRatio > 12%  → cell is dominated by dark pixels (real outline),
  //       no need to check centre — the cell IS dark.
  //   (2) nd >= 4 AND the centre 3×3 is also dark → small feature at the
  //       cell centre (eye pupil, pin-sized detail).
  //
  // Why the centre-must-also-be-dark clause: R3-批1 had only "nd >= 4" as
  // the small-feature rescue. On Pikachu, an eye-WHITE cell sitting next
  // to an eye-PUPIL cell catches anti-alias bleed (~10-20 dark px on its
  // rim) → nd passes the threshold → the sclera cell gets painted black
  // → eye pupil + sclera merge into one black blob → "eye disappears".
  // Requiring centre lum < 60 as well means:
  //   - real pupil cell: centre dark   → fires, stays black ✓
  //   - neighbouring sclera: centre white, only rim dark → skips ✓
  //   - full outline: dominated by dark, clause (1) fires ✓
  const centerLum = nc > 0
    ? (0.299 * rc + 0.587 * gc + 0.114 * bc) / nc
    : 255;
  const centerIsDark = centerLum < DARK_LUM_THRESHOLD;

  if (
    darkRatio > DARK_MASS ||
    (nd >= DARK_COUNT && centerIsDark && nd > 0)
  ) {
    return {
      rgb: [Math.round(rd / nd), Math.round(gd / nd), Math.round(bd / nd)],
      opaque: true,
      isEdge: true,
      variance: 0,
    };
  }

  // Normal case — centre-patch mean. Falls back to full-opaque mean if the
  // centre happened to be transparent (rare but possible on thin subjects).
  if (nc > 0) {
    return {
      rgb: [Math.round(rc / nc), Math.round(gc / nc), Math.round(bc / nc)],
      opaque: true,
      isEdge: false,
      variance: 0,
    };
  }
  return { rgb: [255, 255, 255], opaque: false, isEdge: false, variance: 0 };
}

// Luminance cut-off for "dark pixel" classification. Tuned for Gemini's
// pixel-art outputs: clean subject colours > 90 luminance, natural outlines
// 0-40. The mass / count thresholds are now computed dynamically per-cell
// inside `sampleCenterPatch` (Fix D).
const DARK_LUM_THRESHOLD = 60;

/** Analyse one cell: mean, dominant, variance, then pick which to output. */
function analyseCell(
  data: Uint8ClampedArray,
  stride: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  varianceThreshold: number,
): CellRaw {
  const ch = 4;
  let rs = 0, gs = 0, bs = 0, n = 0; // mean accum
  let lumSum = 0, lumSqSum = 0;      // variance accum (on luminance)
  // Dominant-colour bucket (quantised). We coarsen to 4-bit per channel
  // (4096 buckets) so near-identical colours cluster.
  const freq = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = (py * stride + px) * ch;
      const a = data[i + 3];
      if (a < 128) continue; // treat transparent as non-existent
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      n++;
      rs += r; gs += g; bs += b;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum;
      lumSqSum += lum * lum;

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const entry = freq.get(key);
      if (entry) {
        entry.count++;
        entry.r += r; entry.g += g; entry.b += b;
      } else {
        freq.set(key, { count: 1, r, g, b });
      }
    }
  }

  if (n === 0) {
    return { rgb: [255, 255, 255], opaque: false, isEdge: false, variance: 0 };
  }

  const mean: RGB = [Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)];

  // Dominant = bucket with highest count
  let domEntry = { count: 0, r: 0, g: 0, b: 0 };
  for (const e of freq.values()) if (e.count > domEntry.count) domEntry = e;
  const dominant: RGB = [
    Math.round(domEntry.r / domEntry.count),
    Math.round(domEntry.g / domEntry.count),
    Math.round(domEntry.b / domEntry.count),
  ];

  const lumMean = lumSum / n;
  const variance = Math.sqrt(Math.max(0, lumSqSum / n - lumMean * lumMean));
  const isEdge = variance >= varianceThreshold;

  return {
    rgb: isEdge ? dominant : mean,
    opaque: true,
    isEdge,
    variance,
  };
}
