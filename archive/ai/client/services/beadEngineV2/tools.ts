/**
 * Stage 3 — Auto-tool passes over the mapped grid.
 *
 * Each function is a single deterministic pass that operates on the grid
 * in place (returning a new grid reference for immutability). The orchestrator
 * in index.ts decides which to run based on `analysis.autoTools`.
 *
 * Order matters — see index.ts for the canonical sequence. All passes only
 * use palette / grid data; no image re-sampling needed after Stage 2.
 */

import type { Color } from '../../types';
import type { MappedGrid } from './paletteMap';
import { buildLabPalette, ciede2000, type LabPaletteEntry } from './colorSpace';

// ──────────────────────────────────────────────────────────────────────
// Grey removal — replaces grey cells with the neighbour majority's
// non-grey colour. Run after palette mapping to scrub residual neutrals
// that survived Stage 2's soft grey-tolerance filter.
// ──────────────────────────────────────────────────────────────────────

export function greyRemovalPass(grid: MappedGrid, palette: Color[]): MappedGrid {
  const greyIds = new Set(palette.filter((c) => c.isGrey).map((c) => c.id));
  if (greyIds.size === 0) return grid;

  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = cloneGrid(grid);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = out[y][x].colorId;
      if (!id || !greyIds.has(id)) continue;

      // Find majority non-grey neighbour (4-connected)
      const votes = new Map<string, number>();
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx, ny = y + dy;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const nid = out[ny][nx].colorId;
        if (nid && !greyIds.has(nid)) {
          votes.set(nid, (votes.get(nid) ?? 0) + 1);
        }
      }
      if (votes.size === 0) continue; // all neighbours are grey or null → leave alone
      out[y][x] = { ...out[y][x], colorId: pickBest(votes) };
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Outline reinforce — edge-detected cells whose current colour is not
// dark get pushed to the nearest dark/ink palette entry. This is what
// keeps the silhouette readable after pixelation without drawing a thick
// uniform black border around everything.
// ──────────────────────────────────────────────────────────────────────

/** Edge map from Stage 1's per-cell isEdge flag, one bit per cell. */
export type EdgeMask = boolean[][];

export function outlineReinforcePass(
  grid: MappedGrid,
  edgeMask: EdgeMask,
  palette: Color[],
): MappedGrid {
  const darkPalette = buildLabPalette(palette.filter((c) => c.isDark || c.isInk));
  if (darkPalette.length === 0) return grid;

  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = cloneGrid(grid);
  const paletteById = new Map(palette.map((c) => [c.id, c]));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edgeMask[y]?.[x]) continue;
      const cell = out[y][x];
      if (!cell.colorId) continue;

      const current = paletteById.get(cell.colorId);
      if (!current) continue;
      if (current.isDark || current.isInk) continue; // already dark → leave

      // Only reinforce when the local region's surrounding is darker on
      // one side — prevents flipping random mid-tone cells to ink.
      if (!hasDarkerNeighbour(out, x, y, w, h, paletteById)) continue;

      // Snap to nearest dark — use original source hex (stored on cell) as
      // the reference, so we pick the dark palette entry closest to what
      // the cell actually looked like in the source image.
      const srcHex = cell.originalColor;
      const targetLab = buildLabPalette([{ hex: srcHex }])[0].lab;
      const nearest = nearestInSet(targetLab, darkPalette);
      out[y][x] = { ...cell, colorId: nearest.ref.id };
    }
  }
  return out;
}

function hasDarkerNeighbour(
  grid: MappedGrid,
  x: number,
  y: number,
  w: number,
  h: number,
  paletteById: Map<string, Color>,
): boolean {
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = x + dx, ny = y + dy;
    if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
    const nid = grid[ny][nx].colorId;
    if (!nid) continue;
    const n = paletteById.get(nid);
    if (n && (n.isDark || n.isInk)) return true;
  }
  return false;
}

// ──────────────────────────────────────────────────────────────────────
// Colour simplify — any palette colour used in fewer than N cells gets
// folded into its LAB-nearest kept colour. Keeps final SKU count low
// (user spec: ≤ 25). Threshold scales with grid size.
// ──────────────────────────────────────────────────────────────────────

export function colorSimplifyPass(
  grid: MappedGrid,
  palette: Color[],
  thresholdFraction = 0.005, // 0.5 % of total cells
): MappedGrid {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const total = h * w;
  const minCount = Math.max(3, Math.floor(total * thresholdFraction));

  // Tally
  const counts = new Map<string, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = grid[y][x].colorId;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const kept = new Set([...counts.entries()].filter(([, c]) => c >= minCount).map(([id]) => id));
  const removed = [...counts.keys()].filter((id) => !kept.has(id));
  if (removed.length === 0) return grid;

  // Map each removed id → nearest kept id (in LAB)
  const keptPalette = buildLabPalette(palette.filter((c) => kept.has(c.id)));
  if (keptPalette.length === 0) return grid; // edge case: everything rare

  const remap = new Map<string, string>();
  for (const rid of removed) {
    const removedHex = palette.find((c) => c.id === rid)?.hex;
    if (!removedHex) continue;
    const lab = buildLabPalette([{ hex: removedHex }])[0].lab;
    remap.set(rid, nearestInSet(lab, keptPalette).ref.id);
  }

  // Apply
  const out = cloneGrid(grid);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = out[y][x].colorId;
      if (id && remap.has(id)) {
        out[y][x] = { ...out[y][x], colorId: remap.get(id)! };
      }
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Feature protect — flags cells inside `focusRegions` / eye bboxes so
// subsequent cleanup passes don't merge them. Returns a boolean mask
// the cleanup stage consumes.
// ──────────────────────────────────────────────────────────────────────

export function buildProtectMask(
  w: number,
  h: number,
  eyeBboxes?: [number, number, number, number][],
  // focusRegions is currently semantic-only (strings like "face"); we rely
  // on bboxes from Gemini for spatial protection. Future: NLP → bbox.
): boolean[][] {
  const mask: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));
  if (!eyeBboxes || eyeBboxes.length === 0) return mask;

  for (const [nx, ny, nw, nh] of eyeBboxes) {
    const x0 = Math.max(0, Math.floor(nx * w));
    const y0 = Math.max(0, Math.floor(ny * h));
    const x1 = Math.min(w, Math.ceil((nx + nw) * w));
    const y1 = Math.min(h, Math.ceil((ny + nh) * h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y][x] = true;
  }
  return mask;
}

// ──────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────

const NEIGHBOURS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function cloneGrid(grid: MappedGrid): MappedGrid {
  return grid.map((row) => row.map((cell) => ({ ...cell })));
}

function pickBest(votes: Map<string, number>): string {
  let bestId = '';
  let bestCount = -1;
  for (const [id, c] of votes) if (c > bestCount) { bestCount = c; bestId = id; }
  return bestId;
}

function nearestInSet<T>(
  target: readonly [number, number, number],
  set: LabPaletteEntry<T>[],
): LabPaletteEntry<T> {
  let best = set[0];
  let bestD = ciede2000(target, best.lab);
  for (let i = 1; i < set.length; i++) {
    const d = ciede2000(target, set[i].lab);
    if (d < bestD) { best = set[i]; bestD = d; }
  }
  return best;
}
