/**
 * Stage 4 — Structural cleanup.
 *
 * Two passes run after colour work is done:
 *
 *   1. BFS small-island removal — any connected region smaller than
 *      `minRegion` gets absorbed into its dominant neighbour's colour.
 *      Cells flagged in `protectMask` (e.g. eye bboxes) are exempt.
 *
 *   2. Physics correction — perler beads snap to a square peg grid, so
 *      diagonally-adjacent singletons and 1-bead "bridges" between large
 *      regions don't actually exist physically. We either remove them or
 *      thicken them to at least 2 neighbouring cells.
 */

import type { MappedGrid } from './paletteMap';

const NEIGHBOURS: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export interface CleanupOptions {
  /** Minimum connected-region size (cells). Regions below this get absorbed. */
  minRegion: number;
  /** Optional protect mask — `true` cells are never replaced by cleanup. */
  protectMask?: boolean[][];
  /** Optional per-cell region-size override. eyeEnhance passes {minRegion: 1}
   *  inside eye bboxes so 1-pixel iris highlights survive. */
  regionSizeForCell?: (x: number, y: number) => number;
}

/**
 * Run both cleanup passes. Returns a new grid.
 */
export function cleanupPass(grid: MappedGrid, opts: CleanupOptions): MappedGrid {
  const afterIslands = bfsIslandCleanup(grid, opts);
  return physicsFixPass(afterIslands, opts.protectMask);
}

// ──────────────────────────────────────────────────────────────────────
// BFS small-island removal
// ──────────────────────────────────────────────────────────────────────

function bfsIslandCleanup(grid: MappedGrid, opts: CleanupOptions): MappedGrid {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = grid.map((row) => row.map((cell) => ({ ...cell })));
  const visited: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (visited[y][x]) continue;
      const startId = out[y][x].colorId;
      if (!startId) { visited[y][x] = true; continue; }

      // Flood-fill 4-connected
      const region: [number, number][] = [];
      const neighbourVotes = new Map<string, number>();
      const stack: [number, number][] = [[x, y]];
      let regionProtected = false;

      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        if (visited[cy][cx]) continue;
        const id = out[cy][cx].colorId;
        if (id !== startId) {
          if (id) neighbourVotes.set(id, (neighbourVotes.get(id) ?? 0) + 1);
          continue;
        }
        visited[cy][cx] = true;
        region.push([cx, cy]);
        if (opts.protectMask?.[cy]?.[cx]) regionProtected = true;
        for (const [dx, dy] of NEIGHBOURS) stack.push([cx + dx, cy + dy]);
      }

      if (regionProtected) continue; // don't touch protected regions

      // Per-cell override (e.g. eye region allows size-1)
      const threshold = opts.regionSizeForCell
        ? Math.min(opts.minRegion, opts.regionSizeForCell(x, y))
        : opts.minRegion;

      if (region.length < threshold && neighbourVotes.size > 0) {
        const winner = [...neighbourVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
        for (const [rx, ry] of region) {
          out[ry][rx] = { ...out[ry][rx], colorId: winner };
        }
      }
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────
// Physics correction — patches small artefacts that look OK on screen
// but can't be made with real beads:
//
//   (a) Diagonal singletons: a cell whose 4-neighbours are all a different
//       colour but whose 4-diagonals carry the cell's colour. Visually
//       looks like a zig-zag; physically the cell is an orphan. Replace
//       with the 4-neighbour majority.
//
//   (b) 1-bead bridges: a single cell of colour X connecting two larger
//       X regions via a thin link (left/right or up/down singleton with
//       different-colour flank). Currently we leave these alone — trying
//       to "thicken" them without context hurts quality. TODO: use analysis
//       to decide thicken vs remove.
// ──────────────────────────────────────────────────────────────────────

function physicsFixPass(grid: MappedGrid, protectMask?: boolean[][]): MappedGrid {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const out = grid.map((row) => row.map((cell) => ({ ...cell })));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (protectMask?.[y]?.[x]) continue;
      const id = out[y][x].colorId;
      if (!id) continue;

      // 4-neighbour votes
      const fourVotes = new Map<string, number>();
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx, ny = y + dy;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const nid = out[ny][nx].colorId;
        if (nid) fourVotes.set(nid, (fourVotes.get(nid) ?? 0) + 1);
      }

      // If 3+ of the 4 neighbours agree on a different colour → this cell
      // is a diagonal-only singleton. Replace with neighbour colour.
      const matching = fourVotes.get(id) ?? 0;
      if (matching > 0) continue; // at least one cardinal neighbour matches → not orphan
      const winnerEntry = [...fourVotes.entries()].sort((a, b) => b[1] - a[1])[0];
      if (winnerEntry && winnerEntry[1] >= 3) {
        out[y][x] = { ...out[y][x], colorId: winnerEntry[0] };
      }
    }
  }
  return out;
}
