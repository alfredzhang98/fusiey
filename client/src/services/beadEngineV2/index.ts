/**
 * BeadEngine v2 — public entry point.
 *
 * Runs the deterministic Engine T pipeline end-to-end:
 *   1. Load + downscale image → per-cell raw colour (Stage 1)
 *   2. Map raw colours to palette with semantic guards    (Stage 2)
 *   3. Auto-tool passes driven by `analysis.autoTools`    (Stage 3)
 *   4. BFS islands + physics correction                   (Stage 4)
 *
 * AI preprocessing (Agent S Stylize) and quality-loop (Agent E Evaluate)
 * live in separate files and wrap this one — see the v2 plan.
 *
 * This module is completely deterministic: given the same inputs it always
 * produces the same grid. That's the "H — pixel-level stability" guarantee.
 */

import type { AnalysisV2, Color, GridCell, TuningSeeds } from '../../types';
import { loadImagePixels, pixelate, snapToBlockGrid, type RawGrid } from './pixelate';
import { mapToPalette, type MappedGrid } from './paletteMap';
import {
  buildProtectMask,
  colorSimplifyPass,
  greyRemovalPass,
  outlineReinforcePass,
  type EdgeMask,
} from './tools';
import { cleanupPass } from './cleanup';
import { detectBackgroundMask } from './background';
import { addEyeCatchlights } from './eyeCatchlight';
import { absorbLightSpecks, fillInteriorNulls } from './fillNulls';

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export interface EngineTInput {
  /** base64 data URL or any Image-loadable source. */
  imageSrc: string;
  /** Target grid dimensions — stored with the pattern. */
  width: number;
  height: number;
  /** Full palette to consider (before analysis subset is applied). */
  palette: Color[];
  /** Semantic hints. Pass `defaultAnalysis()` when there is no Gemini info. */
  analysis: AnalysisV2;
  /** True when `imageSrc` came from Gemini Stylize — enables pixel-art
   *  aware sampling and skips edge-detection smoothing. False means raw
   *  user upload (fallback path) → use classic box-average. */
  isAiStylized?: boolean;
  /** Minimal mode (default: true).
   *  Runs ONLY pixelate → palette mapping (+ background mask).
   *  Skips all Stage 3 autoTool passes AND Stage 4 BFS/physics cleanup.
   *  Use this as a debugging baseline to isolate what each post-processing
   *  pass is actually doing. Set false to re-enable the full pipeline. */
  minimal?: boolean;
}

export interface EngineTOutput {
  grid: GridCell[][];
  stats: GridStats;
}

export interface GridStats {
  uniqueColors: number;
  greyRatio: number;   // fraction of cells that are grey
  islands: number;     // count of regions < 3 cells (guard metric)
  greyCount: number;
}

/** Build a safe `AnalysisV2` when we have no Gemini data.
 *  All autoTools default to FALSE — minimal mode only does pixel → palette
 *  mapping. Post-processing passes are opt-in. */
export function defaultAnalysis(palette: Color[], subject = 'pattern'): AnalysisV2 {
  return {
    subject,
    keyFeatures: [],
    paletteSubset: palette.map((c) => c.id),
    autoTools: {
      greyRemoval: false,
      outlineReinforce: false,
      colorSimplify: false,
      skinProtect: false,
      eyeEnhance: false,
      featureProtect: false,
    },
    tuningSeeds: defaultTuning(),
    notes: 'Default analysis — minimal mode, all post-processing off.',
  };
}

export function defaultTuning(): TuningSeeds {
  return {
    edgeBias: 0.3,
    minRegion: 2,
    mergeThreshold: 25,
    greyTolerance: 1.2,
  };
}

/**
 * Main pipeline. Returns the final grid plus stats so callers (Evaluator,
 * UI) can decide whether to retry with tweaked tuning.
 */
export async function runEngineT(input: EngineTInput): Promise<EngineTOutput> {
  const { imageSrc, width, height, palette, analysis } = input;
  const tuning = input.analysis.tuningSeeds;
  const isAiStylized = input.isAiStylized ?? false;
  // Default ON — debug-friendly baseline. Flip to false when ready to
  // layer the Stage 3/4 passes back in one at a time.
  const minimal = input.minimal ?? true;

  // Stage 1 — pixelate.
  //   AI path: snap the source to an integer multiple of blockPx first
  //   (Fix F) so cell boundaries lock to AI block boundaries — eliminates
  //   the 2-cell-thick outline artifact at the root. Then center-patch
  //   sample with eye-bbox-aware dynamic dark gates (Fix D).
  //   Non-AI path: classic load + box-average, unchanged.
  const loaded = isAiStylized
    ? await snapToBlockGrid(imageSrc, width, height)
    : { ...(await loadImagePixels(imageSrc)), blockPx: 0 };
  const { data, width: origW, height: origH, blockPx } = loaded;
  if (isAiStylized) {
    console.log(
      `[engineT] snapToBlockGrid: blockPx=${blockPx} → ${origW}×${origH} (grid ${width}×${height})`,
    );
  }
  const raw: RawGrid = pixelate(
    data,
    origW,
    origH,
    width,
    height,
    tuning.edgeBias,
    isAiStylized ? 'center-patch' : 'box-average',
    { blockPx, eyeBboxes: analysis.eyeBboxes },
  );

  // Detect background once, reuse in Stage 2 + Stage 4. The flood-fill is
  // O(W·H) so the cost is trivial (~2500 cells for 50×50).
  const backgroundMask = detectBackgroundMask(raw);

  // Stage 2 — palette mapping (with background → null)
  let mapped: MappedGrid = mapToPalette(raw, {
    palette,
    analysis,
    greyTolerance: tuning.greyTolerance,
    backgroundMask,
  });

  // Outline thinning — DISABLED. Originally trimmed 2-cell-thick outer
  // bands caused by AI-block ↔ cell-edge straddle. After Fix F
  // (snapToBlockGrid) + nearest-neighbor scaling, the straddle and
  // bilinear halo that created those 2-thick bands are both gone. The
  // only remaining triggers are real 2-thick outlines Gemini occasionally
  // draws — and `thinOutlines` can ONLY trim silhouette-adjacent cells,
  // so running it shifts the silhouette inward by 1 cell, producing the
  // "hood edge disappeared / feet bottom gapped" symptom seen on user's
  // test image. Keeping the file for future interior-feature erosion.

  // Eye catchlight — add a pure-white bead at the top-left of each dark
  // pupil cluster Gemini drew. This is what separates "lively eyes" from
  // "dead black blobs" on characters like Pikachu. Additive only: no
  // existing cells are destroyed, only one is swapped per bbox, and only
  // when a confirmed dark pupil already exists.
  if (analysis.autoTools.eyeEnhance && analysis.eyeBboxes?.length) {
    const placed = addEyeCatchlights(mapped, palette, analysis.eyeBboxes);
    if (placed > 0) console.log(`[engineT] added ${placed} eye catchlight(s)`);
  }

  // Fill interior nulls — any null cell INSIDE the subject silhouette gets
  // absorbed into its 4-neighbour majority. Runs in both minimal and full
  // mode: correctness fix, not semantic. Sources of interior null include
  // RMBG over-aggressive alpha removal and flood-fill leaks through
  // near-white seams. User requirement: no null inside the pattern.
  const nullsFilled = fillInteriorNulls(mapped, palette, analysis);
  if (nullsFilled > 0) console.log(`[engineT] fillInteriorNulls filled ${nullsFilled} cell(s)`);

  // Absorb isolated light-colour specks (1-2 cell H1/H2 blobs) into their
  // chromatic neighbours — kills hair-shine / anti-alias white specks on
  // face / hair. Eye-bbox-protected so catchlights survive.
  const absorbed = absorbLightSpecks(mapped, palette, analysis);
  if (absorbed > 0) console.log(`[engineT] absorbLightSpecks absorbed ${absorbed} cell(s)`);

  // Small-region cleanup (minimal mode) — absorbs single-cell speckles
  // into their neighbour majority. Targets the "body colour speckle" on
  // flat Pikachu-yellow body where scattered A6/A7 cells from Gemini's
  // anti-alias get isolated. minRegion=2 keeps legitimate 2-cell features
  // (narrow tail-body gaps, thin outline breaks) intact. Eye bboxes are
  // protected so catchlights + pupils survive.
  const protectMask = analysis.eyeBboxes?.length
    ? buildProtectMask(width, height, analysis.eyeBboxes)
    : undefined;
  mapped = cleanupPass(mapped, { minRegion: 2, protectMask });

  // Early-out in minimal mode — everything above is additive/corrective;
  // Stage 3 semantic tool passes + Stage 4 physics chain still skipped.
  if (minimal) {
    console.log('[engineT] minimal mode — skipping Stage 3 + Stage 4 semantic passes');
    const final: GridCell[][] = mapped.map((row) =>
      row.map((cell) => ({ colorId: cell.colorId, originalColor: cell.originalColor })),
    );
    return { grid: final, stats: computeStats(mapped, palette) };
  }

  // ── Full pipeline (only when minimal=false) ───────────────────────
  // Stage 3 — auto-tool passes, in canonical order
  if (analysis.autoTools.greyRemoval) {
    mapped = greyRemovalPass(mapped, palette);
  }
  if (analysis.autoTools.outlineReinforce) {
    const edgeMask: EdgeMask = raw.map((row) => row.map((cell) => cell.isEdge));
    mapped = outlineReinforcePass(mapped, edgeMask, palette);
  }
  if (analysis.autoTools.colorSimplify) {
    const frac = Math.max(0.003, Math.min(0.015, tuning.mergeThreshold / 3000));
    mapped = colorSimplifyPass(mapped, palette, frac);
  }

  // Stage 4 — structural cleanup
  const stage4ProtectMask = analysis.autoTools.featureProtect
    ? buildProtectMask(width, height, analysis.eyeBboxes)
    : undefined;

  const grid = cleanupPass(mapped, {
    minRegion: tuning.minRegion,
    protectMask: stage4ProtectMask,
    regionSizeForCell: analysis.autoTools.eyeEnhance && analysis.eyeBboxes?.length
      ? makeEyeRegionSizer(analysis.eyeBboxes, width, height)
      : undefined,
  });

  const final: GridCell[][] = grid.map((row) =>
    row.map((cell) => ({ colorId: cell.colorId, originalColor: cell.originalColor })),
  );
  const stats = computeStats(grid, palette);
  return { grid: final, stats };
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function makeEyeRegionSizer(
  eyeBboxes: [number, number, number, number][],
  w: number,
  h: number,
): (x: number, y: number) => number {
  return (x, y) => {
    const nx = x / w, ny = y / h;
    for (const [bx, by, bw, bh] of eyeBboxes) {
      if (nx >= bx && nx <= bx + bw && ny >= by && ny <= by + bh) return 1;
    }
    return 99; // effectively disable override (use caller's minRegion)
  };
}

function computeStats(grid: MappedGrid, palette: Color[]): GridStats {
  const greyIds = new Set(palette.filter((c) => c.isGrey).map((c) => c.id));
  const counts = new Map<string, number>();
  let opaqueCells = 0;
  let greyCount = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.colorId) continue;
      opaqueCells++;
      counts.set(cell.colorId, (counts.get(cell.colorId) ?? 0) + 1);
      if (greyIds.has(cell.colorId)) greyCount++;
    }
  }
  const greyRatio = opaqueCells > 0 ? greyCount / opaqueCells : 0;

  // Count islands (regions < 3 cells) — approximate via per-colour clusters.
  // Precise 4-connected BFS here would double the cost of cleanup; we trust
  // cleanup already removed most. This is a health metric, not a hard gate.
  let islands = 0;
  for (const [, count] of counts) if (count < 3) islands++;

  return {
    uniqueColors: counts.size,
    greyRatio,
    islands,
    greyCount,
  };
}
