/**
 * Stage 2 — Palette mapping.
 *
 * For each cell in the pixelated grid, choose the closest palette colour in
 * LAB space using CIEDE2000. Three semantic guards (driven by Gemini's
 * analysis JSON or static defaults) narrow the candidate set *before* the
 * distance minimisation:
 *
 *   1. Outline cells with dark targets → only ink/dark palette entries
 *   2. Cells inside skin bbox          → only skin palette entries
 *   3. Cells inside eye bboxes         → only dark + saturated entries
 *
 * After candidates are decided, a fourth pass (grey suppression) optionally
 * pushes neutral matches toward the nearest chromatic alternative when the
 * two are within `greyTolerance` × distance. This is what kills the
 * "fifty-shades-of-grey" failure mode v1 suffered on photos.
 */

import type { AnalysisV2, BBox, Color } from '../../types';
import type { RawGrid } from './pixelate';
import {
  buildLabPalette,
  ciede2000,
  labChroma,
  rgbToLab,
  type LabPaletteEntry,
} from './colorSpace';

export interface MappedCell {
  colorId: string | null;   // palette colour id (null = transparent)
  originalColor: string;    // source hex (for hover / debugging)
}
export type MappedGrid = MappedCell[][];

export interface MapOptions {
  /** Paint palette to match against (already filtered by subset if desired). */
  palette: Color[];
  /** Semantic analysis from Gemini (or default). */
  analysis: AnalysisV2;
  /** Non-grey distance advantage factor (1.0 = no bias, 2.0 = strong). */
  greyTolerance: number;
  /** Optional background mask — cells where true become `colorId: null`
   *  regardless of their source colour. Used to keep backgrounds empty
   *  (× peg marks) instead of covering them with white beads. */
  backgroundMask?: boolean[][];
}

const LAB_SATURATION_THRESHOLD = 30; // chroma above this = "colourful"

// Absolute CIEDE2000 distance above which a bbox gate is rejected. When a
// cell inside an eye/skin bbox is this far from ALL entries in the
// restricted set, the bbox is wrong for this cell (typically a Gemini
// mis-use of skinProtect on a non-skin subject, or a loose bbox that
// swallowed hair / clothing) → fall back to the full palette.
// Calibration (tightened from 25 → 18):
//   dist ~8  — real skin vs G1 Cream. Must PASS → threshold > 8. ✓
//   dist ~18 — white vs G1 Cream. Borderline — at threshold it's a
//              coin flip; acceptable either way.
//   dist ~25 — yellow (Pikachu face) vs G1 Cream. Must FAIL → threshold
//              < 25. ✓ This is the bug that produced cream face on
//              Pikachu when Gemini wrongly set skinProtect=true.
//   dist ~60 — hoodie blue vs skin. Must FAIL → well covered. ✓
const BBOX_MAX_DISTANCE = 18;

export function mapToPalette(raw: RawGrid, opts: MapOptions): MappedGrid {
  const { palette, analysis, greyTolerance, backgroundMask } = opts;

  // Pre-compute LAB for every palette entry
  const subsetIds = new Set(analysis.paletteSubset);
  const subsetPalette = palette.filter((c) => subsetIds.has(c.id));
  const effectivePalette = subsetPalette.length > 0 ? subsetPalette : palette;
  const lab = buildLabPalette(effectivePalette);

  // Pre-partition by semantic role — re-use across every cell
  const darkSet = lab.filter((e) => e.ref.isDark || e.ref.isInk);
  const skinSet = lab.filter((e) => e.ref.isSkin);
  const eyeSet  = lab.filter((e) => e.ref.isDark || labChroma(e.lab) > LAB_SATURATION_THRESHOLD);
  const greySet  = lab.filter((e) => e.ref.isGrey);
  const colorSet = lab.filter((e) => !e.ref.isGrey);

  const height = raw.length;
  const width = raw[0]?.length ?? 0;
  const out: MappedGrid = [];

  for (let y = 0; y < height; y++) {
    const row: MappedCell[] = [];
    for (let x = 0; x < width; x++) {
      const cell = raw[y][x];
      if (!cell.opaque) {
        row.push({ colorId: null, originalColor: 'transparent' });
        continue;
      }
      // Background mask wins over palette matching — these become empty
      // peg cells on the final grid instead of white beads.
      if (backgroundMask?.[y]?.[x]) {
        row.push({ colorId: null, originalColor: rgbToHex(cell.rgb) });
        continue;
      }

      const targetLab = rgbToLab(cell.rgb);
      const L = targetLab[0];
      const ctx = cellContext(x, y, width, height, cell.isEdge, L, analysis);

      // Semantic narrowing. Outline routing is ALWAYS on when the sampling
      // flagged this cell as a dark edge — this is a correctness guarantee,
      // not an optional feature. Without it, dark outline cells get matched
      // to the nearest chromatic (often dark green / dark brown) and
      // outlines fragment. Gated only on darkSet having entries.
      // Priority: eye bbox > dark outline > skin bbox > default.
      // Dark outlines MUST win over skinProtect because face outlines
      // (eyebrows, eyelashes, mouth) sit inside the skinBbox but are
      // L<40 cells — the skin palette has no dark entries, so picking
      // from it would erase the outline into cream. eyeSet already
      // contains dark entries so inEye still handles pupils correctly.
      //
      // Each gate runs a sanity check: if the restricted set's best match
      // is far worse than the full palette's best, the bbox was wrong for
      // this cell — fall back to the full palette. This defends against
      // Gemini returning loose bboxes that swallow hair / clothing.
      let candidates: LabPaletteEntry<Color>[];
      if (ctx.inEye && analysis.autoTools.eyeEnhance && eyeSet.length > 0) {
        candidates = bboxSanityCheck(targetLab, eyeSet) ? eyeSet : lab;
      } else if (ctx.isOutlineDark && darkSet.length > 0) {
        candidates = darkSet;
      } else if (ctx.inSkin && analysis.autoTools.skinProtect && skinSet.length > 0) {
        // Sanity check only: if target is hopelessly far from the skin
        // palette (e.g. hoodie blue inside a loose skinBbox), fall back to
        // full palette. Near-white hair highlights stay in skinSet and
        // map to G1 cream — H1 pure white looked worse than G1 cream in
        // user testing.
        candidates = bboxSanityCheck(targetLab, skinSet) ? skinSet : lab;
      } else {
        candidates = lab;
      }

      // Grey suppression — applies regardless of guard above, but only to the
      // final choice between grey/chromatic neighbours within the candidates.
      let chosen: LabPaletteEntry<Color>;
      if (analysis.autoTools.greyRemoval) {
        const localGrey  = candidates.filter((e) => e.ref.isGrey);
        const localColor = candidates.filter((e) => !e.ref.isGrey);
        if (localGrey.length > 0 && localColor.length > 0) {
          const bestGrey  = nearest(targetLab, localGrey);
          const bestColor = nearest(targetLab, localColor);
          chosen = bestColor.distance < bestGrey.distance * greyTolerance
            ? bestColor.entry
            : bestGrey.entry;
        } else {
          chosen = nearest(targetLab, candidates).entry;
        }
      } else {
        chosen = nearest(targetLab, candidates).entry;
      }

      row.push({
        colorId: chosen.ref.id,
        originalColor: rgbToHex(cell.rgb),
      });
    }
    out.push(row);
  }

  // Silence unused-var lints for pre-partitions we intentionally computed
  // upfront but only sometimes use (greySet / colorSet — referenced by tests).
  void greySet; void colorSet;

  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function nearest<T>(
  target: readonly [number, number, number],
  set: LabPaletteEntry<T>[],
): { entry: LabPaletteEntry<T>; distance: number } {
  let best = set[0];
  let bestD = ciede2000(target, best.lab);
  for (let i = 1; i < set.length; i++) {
    const d = ciede2000(target, set[i].lab);
    if (d < bestD) { best = set[i]; bestD = d; }
  }
  return { entry: best, distance: bestD };
}

/**
 * Returns true if restricting candidates to `restricted` is reasonable
 * for this cell — i.e. the best match inside the restricted set is within
 * `BBOX_MAX_DISTANCE` CIEDE2000 units of the target. Returns false when
 * the target is clearly not in the restricted set's gamut (e.g.
 * hoodie-blue cell inside an over-generous skinBbox).
 */
function bboxSanityCheck<T>(
  target: readonly [number, number, number],
  restricted: LabPaletteEntry<T>[],
): boolean {
  return nearest(target, restricted).distance <= BBOX_MAX_DISTANCE;
}

function rgbToHex(rgb: readonly [number, number, number]): string {
  const n = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
  return `#${n.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** Derives per-cell semantic flags from the analysis JSON. */
function cellContext(
  x: number,
  y: number,
  w: number,
  h: number,
  isEdge: boolean,
  L: number,
  analysis: AnalysisV2,
): { inSkin: boolean; inEye: boolean; isOutlineDark: boolean } {
  const nx = x / w;
  const ny = y / h;
  return {
    inSkin: analysis.skinBbox ? inBox(nx, ny, analysis.skinBbox) : false,
    inEye: analysis.eyeBboxes
      ? analysis.eyeBboxes.some((box) => inBox(nx, ny, box))
      : false,
    isOutlineDark: isEdge && L < 40,
  };
}

function inBox(nx: number, ny: number, [x, y, w, h]: BBox): boolean {
  return nx >= x && nx <= x + w && ny >= y && ny <= y + h;
}
