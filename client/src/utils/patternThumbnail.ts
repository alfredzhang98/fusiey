import type { Pattern, Palette } from '../types';

/**
 * Render a small flat-colour PNG preview of a pattern's grid, returned as a
 * data URL to store in Product/SavedPattern.thumbnail. Kept well under the
 * 200 KB column limit by capping the output size.
 */
export function renderThumbnail(pattern: Pattern, palette: Palette, maxSize = 220): string {
  const cmap = new Map(palette.colors.map((c) => [c.id, c]));
  const cell = Math.max(1, Math.floor(maxSize / Math.max(pattern.width, pattern.height)));
  const w = pattern.width * cell;
  const h = pattern.height * cell;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#F2F1ED'; // pegboard background for empty cells
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < pattern.height; y++) {
    const row = pattern.grid[y];
    for (let x = 0; x < pattern.width; x++) {
      const id = row[x].colorId;
      if (!id) continue;
      const col = cmap.get(id);
      if (col) {
        ctx.fillStyle = col.hex;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  return canvas.toDataURL('image/png');
}
