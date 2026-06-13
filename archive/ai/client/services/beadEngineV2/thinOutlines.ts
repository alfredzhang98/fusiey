/**
 * Outline thinning — trim 2-cell-thick outer bands back to 1 cell.
 *
 * Reason for existing: Gemini reliably draws 1-chunk-thick outlines, but the
 * AI's chunk edges don't land exactly on our grid-cell boundaries. When a
 * single AI outline (3-5 px thick in 1024² output) straddles two adjacent
 * grid cells (each 20×20 px at 50-grid), BOTH cells cross the 12% dark-ratio
 * threshold in `pixelate.ts` → both map to pure black H7 in `paletteMap.ts`
 * → visible 2-cell outline. Pure sub-pixel misalignment bug.
 *
 * Deterministic fix: after palette mapping, any dark cell that (a) sits
 * adjacent to background AND (b) has a dark neighbour on the opposite side
 * is the OUTER cell of a 2-thick band. Trim it (replace with null).
 *
 * Safeguards to avoid eating legitimate features:
 *   - Only trims if the cell has ≥ 2 dark 4-neighbours (filters out single
 *     dark specks and 2-cell-wide tails where each cell has only 1 dark
 *     neighbour — those stay intact).
 *   - Only trims when the OUTER side is literal background (colorId=null),
 *     not when the outer side is another subject colour. This protects
 *     features like eye pupils inside a yellow face: pupils have no
 *     background neighbour, so they pass through untouched.
 *   - Single pass (no iterative erosion). 3-thick outlines would need
 *     another call — we haven't seen those from Gemini, so one pass is fine.
 *
 * Grid out-of-bounds DOES NOT count as background. Image-boundary outlines
 * (hood top / sides, feet bottom) must be preserved — trimming them causes
 * visible gaps where the canvas edge meets the subject. Only in-bounds
 * null cells (flood-filled background) trigger trim.
 */

import type { Color } from '../../types';
import type { MappedGrid } from './paletteMap';

type Dir = readonly [number, number];

// Pairs of [outer direction, inner direction]. A cell qualifies as "the
// outer layer of a 2-thick band" when moving `outer` lands on background
// AND moving `inner` lands on another dark cell.
const DIR_PAIRS: readonly (readonly [Dir, Dir])[] = [
  [[ 0, -1], [ 0,  1]], // outer=up,    inner=down
  [[ 0,  1], [ 0, -1]], // outer=down,  inner=up
  [[-1,  0], [ 1,  0]], // outer=left,  inner=right
  [[ 1,  0], [-1,  0]], // outer=right, inner=left
];

const NEIGHBOURS: readonly Dir[] = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
];

// Minimum number of cells along the outline direction that must match the
// same trim pattern before we actually trim. Long body outlines easily hit
// 15–40 cells; short feature outlines (toes, ear tips, thumbs) are 2–4
// cells. Threshold of 5 preserves the small stuff and only flattens the
// big bands.
const MIN_OUTLINE_RUN = 5;

/**
 * Trim 2-cell-thick dark outlines in place. Returns the number of cells
 * trimmed so callers can log it for debugging.
 */
export function thinOutlines(grid: MappedGrid, palette: Color[]): number {
  const darkIds = new Set(
    palette.filter((c) => c.isDark || c.isInk).map((c) => c.id),
  );
  if (darkIds.size === 0) return 0;

  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return 0;

  const isDark = (x: number, y: number): boolean => {
    if (y < 0 || y >= height || x < 0 || x >= width) return false;
    const id = grid[y][x].colorId;
    return id !== null && darkIds.has(id);
  };

  const isBackground = (x: number, y: number): boolean => {
    // Only in-bounds null cells count. OOB must NOT count, otherwise the
    // outermost row/column of a subject reaching the canvas edge always
    // trims (hood edges, feet bottoms) → visible gaps.
    if (y < 0 || y >= height || x < 0 || x >= width) return false;
    return grid[y][x].colorId === null;
  };

  // Does cell (x,y) match the "outer row of a 2-thick band" pattern in a
  // given direction pair? Used both to find trim candidates AND to count
  // how many neighbours along the outline share the same pattern.
  const matchesTrimPattern = (
    x: number,
    y: number,
    outer: Dir,
    inner: Dir,
  ): boolean =>
    isDark(x, y) &&
    isBackground(x + outer[0], y + outer[1]) &&
    isDark(x + inner[0], y + inner[1]);

  // Count consecutive cells (including self) that match the same trim
  // pattern along the direction perpendicular to `outer`. Scans both ways.
  // Used to separate long body outlines (runs of 15–40) from short feature
  // outlines (feet, toes, 2–4 cells) that must be preserved.
  const measureRun = (x: number, y: number, outer: Dir, inner: Dir): number => {
    // Perpendicular = rotate outer by 90°. outer=(0,±1) → perp=(±1,0), etc.
    const perp: Dir = [outer[1], -outer[0]];
    let len = 1;
    for (const sign of [1, -1]) {
      for (let k = 1; k < width + height; k++) {
        const nx = x + perp[0] * sign * k;
        const ny = y + perp[1] * sign * k;
        if (matchesTrimPattern(nx, ny, outer, inner)) len++;
        else break;
      }
    }
    return len;
  };

  // First pass — scan and mark. We batch the decisions then apply; otherwise
  // an already-trimmed cell would read as "background" to its dark neighbour
  // and cascade the trim inward past the 2-thick case we actually want.
  const toTrim: [number, number][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isDark(x, y)) continue;

      // Dark-neighbour count guard. Legitimate 2-cell-wide thin features
      // (narrow tail, antenna) have each cell with only 1 dark neighbour.
      // Outline-outer cells have ≥ 2 (inner row + adjacent outer cells
      // along the run). Threshold of 2 splits these cleanly.
      let darkNeighbours = 0;
      for (const [dx, dy] of NEIGHBOURS) {
        if (isDark(x + dx, y + dy)) darkNeighbours++;
      }
      if (darkNeighbours < 2) continue;

      // Outer-background + opposite-dark → outer layer of a 2-thick band.
      // BUT only trim if the band is long enough along the outline — short
      // runs (feet, toe tips, thumb nubs) must be preserved verbatim.
      for (const [outer, inner] of DIR_PAIRS) {
        if (!matchesTrimPattern(x, y, outer, inner)) continue;
        if (measureRun(x, y, outer, inner) < MIN_OUTLINE_RUN) continue;
        toTrim.push([x, y]);
        break;
      }
    }
  }

  for (const [x, y] of toTrim) {
    grid[y][x] = {
      colorId: null,
      originalColor: grid[y][x].originalColor,
    };
  }

  return toTrim.length;
}
