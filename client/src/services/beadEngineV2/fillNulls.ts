/**
 * Fill interior null cells.
 *
 * Why: null cells represent background (outside the subject silhouette).
 * After pixelate + palette mapping + backgroundMask, we sometimes end up
 * with null cells INSIDE the subject — sources include:
 *   - RMBG over-aggressive alpha removal (hair strand edges → !opaque)
 *   - flood-fill leaking through near-white seams into face highlights
 *   - other edge cases around thin outlines
 * User expectation: "拼豆里面不应该有 null" — every cell inside the
 * silhouette must be a real bead. Only OUTSIDE the subject is null valid.
 *
 * Algorithm (per interior null):
 *   1. Preferred — re-map via `originalColor`. If the cell was marked null
 *      by `backgroundMask` path 2 (flood-fill), its originalColor holds
 *      the actual source RGB — just palette-match that. This is what the
 *      cell would have been if backgroundMask hadn't wrongly claimed it.
 *   2. Inside an eye bbox with no usable originalColor ('transparent' from
 *      path 1 !opaque) — force WHITE. Eye-area nulls are almost always
 *      sclera or catchlight positions Gemini drew that RMBG erased; the
 *      right answer is not "copy neighbour pupil colour" (that produces
 *      black eyes on user's test). Use the whitest palette entry.
 *   3. Fallback — 4-neighbour majority among NON-DARK colours. Excluding
 *      dark keeps eye regions not covered by bbox from getting black-
 *      flooded, and keeps thin body highlights from absorbing outlines.
 *      If every neighbour is dark, use the raw 4-neighbour majority (rare
 *      — means the cell is deep inside a dark feature).
 */

import type { AnalysisV2, Color } from '../../types';
import type { MappedGrid } from './paletteMap';
import { buildLabPalette, ciede2000, hexToRgb, labChroma, rgbToLab } from './colorSpace';

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
];

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Fill interior null cells in place. Returns the count of filled cells.
 */
export function fillInteriorNulls(
  grid: MappedGrid,
  palette: Color[],
  analysis: AnalysisV2,
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return 0;

  const lab = buildLabPalette(palette);
  const darkIds = new Set(
    palette.filter((c) => c.isDark || c.isInk).map((c) => c.id),
  );
  const whiteEntry = pickWhitest(palette);
  const eyeBboxes = analysis.eyeBboxes ?? [];

  // Step 1 — mark "outside" null cells (reachable from canvas edges).
  const outside: boolean[][] = Array.from({ length: height }, () =>
    new Array(width).fill(false),
  );
  const queue: [number, number][] = [];

  const seedIfNull = (x: number, y: number) => {
    if (grid[y][x].colorId === null) {
      outside[y][x] = true;
      queue.push([x, y]);
    }
  };
  for (let x = 0; x < width; x++) {
    seedIfNull(x, 0);
    seedIfNull(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seedIfNull(0, y);
    seedIfNull(width - 1, y);
  }
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (outside[ny][nx]) continue;
      if (grid[ny][nx].colorId !== null) continue;
      outside[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }

  // Step 2 — identify interior null REGIONS and their sizes. Only SMALL
  // interior gaps (≤ MAX_INTERIOR_NULL_REGION cells) get filled — larger
  // transparent regions are legitimate subject-internal cutouts (e.g. the
  // gap between a character's tail and body, the hole between an arm and
  // the torso). Filling those produces visible black blobs where the user
  // expected background to show through.
  const MAX_INTERIOR_NULL_REGION = 3;
  const regionId: number[][] = Array.from({ length: height }, () =>
    new Array(width).fill(-1),
  );
  const regionSize: number[] = [];
  let nextRegion = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x].colorId !== null) continue;
      if (outside[y][x]) continue;
      if (regionId[y][x] !== -1) continue;
      const id = nextRegion++;
      let size = 0;
      const stack: [number, number][] = [[x, y]];
      while (stack.length) {
        const [sx, sy] = stack.pop()!;
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
        if (regionId[sy][sx] !== -1) continue;
        if (grid[sy][sx].colorId !== null) continue;
        if (outside[sy][sx]) continue;
        regionId[sy][sx] = id;
        size++;
        for (const [dx, dy] of NEIGHBOURS) stack.push([sx + dx, sy + dy]);
      }
      regionSize.push(size);
    }
  }

  // Step 3 — fill small interior nulls.
  let filled = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x].colorId !== null) continue;
      if (outside[y][x]) continue;
      const rid = regionId[y][x];
      if (rid === -1) continue;
      if (regionSize[rid] > MAX_INTERIOR_NULL_REGION) continue;

      const cell = grid[y][x];
      const isInEye = inAnyEyeBbox(x, y, width, height, eyeBboxes);

      // 1. Preferred — re-map via cell's originalColor hex.
      if (HEX_RE.test(cell.originalColor)) {
        const rgb = hexToRgb(cell.originalColor);
        const target = rgbToLab(rgb);
        let bestId = lab[0].ref.id;
        let bestD = ciede2000(target, lab[0].lab);
        for (let i = 1; i < lab.length; i++) {
          const d = ciede2000(target, lab[i].lab);
          if (d < bestD) { bestId = lab[i].ref.id; bestD = d; }
        }
        grid[y][x] = { colorId: bestId, originalColor: cell.originalColor };
        filled++;
        continue;
      }

      // 2. Inside eye bbox → force whitest palette entry.
      if (isInEye && whiteEntry) {
        grid[y][x] = { colorId: whiteEntry.id, originalColor: cell.originalColor };
        filled++;
        continue;
      }

      // 3. Fallback — neighbour majority, preferring non-dark.
      const nonDark = new Map<string, number>();
      const allVotes = new Map<string, number>();
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nid = grid[ny][nx].colorId;
        if (nid === null) continue;
        allVotes.set(nid, (allVotes.get(nid) ?? 0) + 1);
        if (!darkIds.has(nid)) {
          nonDark.set(nid, (nonDark.get(nid) ?? 0) + 1);
        }
      }
      const votes = nonDark.size > 0 ? nonDark : allVotes;
      if (votes.size === 0) continue;

      let winner = '';
      let best = -1;
      for (const [id, count] of votes) {
        if (count > best) { winner = id; best = count; }
      }
      grid[y][x] = { colorId: winner, originalColor: cell.originalColor };
      filled++;
    }
  }

  return filled;
}

function inAnyEyeBbox(
  x: number,
  y: number,
  w: number,
  h: number,
  boxes: readonly [number, number, number, number][],
): boolean {
  if (boxes.length === 0) return false;
  const nx = (x + 0.5) / w;
  const ny = (y + 0.5) / h;
  for (const [bx, by, bw, bh] of boxes) {
    if (nx >= bx && nx <= bx + bw && ny >= by && ny <= by + bh) return true;
  }
  return false;
}

/**
 * Absorb tiny light-coloured specks into their chromatic neighbours.
 *
 * Target case: Gemini paints hair-shine / face-highlight / anti-alias
 * blooms as 1–2 block white or off-white. After palette mapping these
 * cells map to H1 (pure white) or H2 (off-white) because those entries
 * are distance-0 matches for RGB near (255,255,255). Result: visible
 * "white specks" on face / hair.
 *
 * Algorithm (single-pass, 4-connected):
 *   For each cell whose colorId is a "light" palette entry (L > 85 AND
 *   chroma < 20), count its 4-neighbours by category:
 *     - light:   same family (H1/H2/H3/similar)
 *     - chromatic: NOT light AND NOT dark (G1 cream, G7 brown, skin, etc)
 *     - dark:    H5/H7 ink
 *   If the cell has ≥ 2 chromatic neighbours AND 0 eye-bbox neighbours,
 *   replace it with the chromatic majority. The eye-bbox check protects
 *   catchlights (H1 cells sitting next to dark pupils inside the bbox).
 *
 * This is intentionally conservative — larger light regions (≥ 3 cells
 * across, e.g. legitimate eye sclera) are untouched because each interior
 * cell has < 2 chromatic neighbours.
 */
export function absorbLightSpecks(
  grid: MappedGrid,
  palette: Color[],
  analysis: AnalysisV2,
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return 0;

  const eyeBboxes = analysis.eyeBboxes ?? [];
  const lightIds = new Set<string>();
  const darkIds = new Set(
    palette.filter((c) => c.isDark || c.isInk).map((c) => c.id),
  );
  for (const c of palette) {
    const m = c.hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) continue;
    const rgb: [number, number, number] = [
      parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16),
    ];
    const lab = rgbToLab(rgb);
    if (lab[0] > 85 && labChroma(lab) < 20) lightIds.add(c.id);
  }

  const absorbed: [number, number, string][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = grid[y][x].colorId;
      if (!id || !lightIds.has(id)) continue;

      let chromaticCount = 0;
      let eyeNeighbourCount = 0;
      const chromaticVotes = new Map<string, number>();
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (inAnyEyeBbox(nx, ny, width, height, eyeBboxes)) eyeNeighbourCount++;
        const nid = grid[ny][nx].colorId;
        if (!nid) continue;
        if (lightIds.has(nid) || darkIds.has(nid)) continue;
        chromaticCount++;
        chromaticVotes.set(nid, (chromaticVotes.get(nid) ?? 0) + 1);
      }

      // Also exempt the cell itself if it's inside eye bbox.
      if (inAnyEyeBbox(x, y, width, height, eyeBboxes)) continue;
      if (eyeNeighbourCount > 0) continue;
      if (chromaticCount < 2) continue;

      let winner = '';
      let best = -1;
      for (const [cid, count] of chromaticVotes) {
        if (count > best) { winner = cid; best = count; }
      }
      absorbed.push([x, y, winner]);
    }
  }

  for (const [x, y, winner] of absorbed) {
    grid[y][x] = { colorId: winner, originalColor: grid[y][x].originalColor };
  }
  return absorbed.length;
}

function pickWhitest(palette: Color[]): Color | null {
  let best: Color | null = null;
  let bestLum = -1;
  for (const c of palette) {
    const m = c.hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) continue;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > bestLum) { bestLum = lum; best = c; }
  }
  return best;
}
