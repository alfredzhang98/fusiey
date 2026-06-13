import type { Pattern, Palette } from '../types';
import { codeTextColor } from './colorUtils';

/**
 * Render the print-ready pattern sheet directly to a canvas.
 *
 * We draw everything with the Canvas 2D API instead of screenshotting a DOM
 * tree with html2canvas — html2canvas mis-places text baselines (codes drift
 * off-centre, list rows get clipped), whereas `fillText` with an explicit
 * `textBaseline` lands exactly where we ask. The canvas height grows with the
 * board so large grids are never cropped.
 *
 * Layout (logical px, rendered at 2× for crisp print):
 *   header (brand · title) → body (grid | bead list + kit sticker) → assembly
 */

const ASSEMBLY = [
  { num: 1, title: 'Place', text: 'Follow the pattern, place beads on a pegboard.' },
  { num: 2, title: 'Iron', text: 'Cover with parchment paper, iron on medium 15-20s.' },
  { num: 3, title: 'Cool', text: 'Let the piece cool flat for at least 2 minutes.' },
  { num: 4, title: 'Peel', text: 'Gently lift from the pegboard. Iron reverse if needed.' },
];

const INK = '#2D2D2D';
const MUTE = '#6B6B6B';
const SANS = 'Arial, "Helvetica Neue", sans-serif';
const MONO = '"Courier New", monospace';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export async function renderExportCanvas(pattern: Pattern, palette: Palette): Promise<HTMLCanvasElement> {
  const W = 1400;
  const PAD = 40;
  const S = 3; // render at 3× for high-DPI crisp print/PNG
  const logo = await loadImage('/logo-icon.svg');

  // ── Data: colour lookup + bill of materials ─────────────────────────
  const cmap = new Map(palette.colors.map((c) => [c.id, c]));
  const counts = new Map<string, number>();
  pattern.grid.forEach((row) =>
    row.forEach((cell) => {
      if (cell.colorId) counts.set(cell.colorId, (counts.get(cell.colorId) || 0) + 1);
    }),
  );
  const bom = ([...counts.entries()]
    .map(([id, count]) => {
      const c = cmap.get(id);
      return c ? { c, count } : null;
    })
    .filter(Boolean) as { c: NonNullable<ReturnType<typeof cmap.get>>; count: number }[])
    .sort((a, b) => b.count - a.count);
  const total = bom.reduce((s, e) => s + e.count, 0);

  // ── Geometry ────────────────────────────────────────────────────────
  const headerBottom = PAD + 56;
  const bodyTop = headerBottom + 20;
  const gridTop = bodyTop + 18;
  const GRID_MAX = 820;
  const CELL = Math.max(6, Math.floor(GRID_MAX / Math.max(pattern.width, pattern.height)));
  const gridW = pattern.width * CELL;
  const gridH = pattern.height * CELL;
  const gridLeft = PAD;

  const RIGHT_W = 360;
  const rightLeft = W - PAD - RIGHT_W;
  const listTop = bodyTop + 18;
  const rowH = 30;
  const listPad = 12;
  const listBoxH = listPad * 2 + bom.length * rowH + 42; // + total row
  const stickerTop = listTop + listBoxH + 14;
  const stickerH = 56;

  // Body height = taller of the two columns; footer follows, then bottom pad.
  const contentBottom = Math.max(gridTop + gridH, stickerTop + stickerH);
  const footTop = contentBottom + 28;
  const footerH = 18 + 70 + 26; // label + step cards + generated line
  const H = footTop + footerH + PAD;

  // ── Canvas ──────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * S);
  canvas.height = Math.round(H * S);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(S, S);

  ctx.fillStyle = '#FDFBF5';
  ctx.fillRect(0, 0, W, H);

  // ── Header (logo + brand) ───────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let brandX = PAD;
  if (logo) {
    const logoH = 50;
    const ratio = logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 1;
    const logoW = logoH * ratio;
    ctx.drawImage(logo, PAD, PAD - 8, logoW, logoH);
    brandX = PAD + logoW + 14;
  }
  ctx.fillStyle = INK;
  ctx.font = `900 34px ${SANS}`;
  ctx.fillText('FUSIEY', brandX, PAD + 28);
  ctx.fillStyle = MUTE;
  ctx.font = `11px ${SANS}`;
  ctx.fillText('PERLER-BEAD PATTERN', brandX, PAD + 46);

  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = `700 22px ${SANS}`;
  ctx.fillText(pattern.name || 'Untitled Pattern', W - PAD, PAD + 20);
  ctx.fillStyle = '#555';
  ctx.font = `12px ${SANS}`;
  ctx.fillText(
    `${pattern.width} × ${pattern.height} · ${total} beads · ${bom.length} colours · ${palette.name}`,
    W - PAD, PAD + 40,
  );

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PAD, headerBottom);
  ctx.lineTo(W - PAD, headerBottom);
  ctx.stroke();

  // ── Section labels ──────────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTE;
  ctx.font = `10px ${SANS}`;
  ctx.fillText('PATTERN', PAD, bodyTop + 8);
  ctx.fillText(`BEAD LIST · ${bom.length} COLOURS`, rightLeft, bodyTop + 8);

  // ── Grid cells ──────────────────────────────────────────────────────
  for (let y = 0; y < pattern.height; y++) {
    const row = pattern.grid[y];
    for (let x = 0; x < pattern.width; x++) {
      const id = row[x].colorId;
      const col = id ? cmap.get(id) : null;
      const px = gridLeft + x * CELL;
      const py = gridTop + y * CELL;
      ctx.fillStyle = col ? col.hex : '#F2F1ED';
      ctx.fillRect(px, py, CELL, CELL);
    }
  }

  // Codes / empty crosses — perfectly centred via textBaseline middle.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let y = 0; y < pattern.height; y++) {
    const row = pattern.grid[y];
    for (let x = 0; x < pattern.width; x++) {
      const id = row[x].colorId;
      const col = id ? cmap.get(id) : null;
      const cx = gridLeft + x * CELL + CELL / 2;
      const cy = gridTop + y * CELL + CELL / 2;
      if (col && col.code && CELL >= 11) {
        ctx.fillStyle = codeTextColor(col.hex);
        ctx.font = `600 ${Math.max(5, CELL * 0.42)}px ${MONO}`;
        ctx.fillText(col.code, cx, cy + 0.5);
      } else if (!col) {
        ctx.fillStyle = '#C2C1BB';
        ctx.font = `${Math.max(5, CELL * 0.5)}px ${MONO}`;
        ctx.fillText('×', cx, cy + 0.5);
      }
    }
  }
  ctx.textBaseline = 'alphabetic';

  // ── Grid lines: fine · 10-block · border ────────────────────────────
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < pattern.width; c++) {
    if (c % 10 === 0) continue;
    ctx.moveTo(gridLeft + c * CELL, gridTop);
    ctx.lineTo(gridLeft + c * CELL, gridTop + gridH);
  }
  for (let r = 1; r < pattern.height; r++) {
    if (r % 10 === 0) continue;
    ctx.moveTo(gridLeft, gridTop + r * CELL);
    ctx.lineTo(gridLeft + gridW, gridTop + r * CELL);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(45,45,45,0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let c = 10; c < pattern.width; c += 10) {
    ctx.moveTo(gridLeft + c * CELL, gridTop);
    ctx.lineTo(gridLeft + c * CELL, gridTop + gridH);
  }
  for (let r = 10; r < pattern.height; r += 10) {
    ctx.moveTo(gridLeft, gridTop + r * CELL);
    ctx.lineTo(gridLeft + gridW, gridTop + r * CELL);
  }
  ctx.stroke();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(gridLeft, gridTop, gridW, gridH);

  // ── Bead list box ───────────────────────────────────────────────────
  ctx.fillStyle = '#FFF';
  roundRectPath(ctx, rightLeft, listTop, RIGHT_W, listBoxH, 10);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  roundRectPath(ctx, rightLeft, listTop, RIGHT_W, listBoxH, 10);
  ctx.stroke();

  let ry = listTop + listPad;
  ctx.textBaseline = 'middle';
  bom.forEach(({ c, count }, i) => {
    const cy = ry + rowH / 2;
    // swatch
    ctx.fillStyle = c.hex;
    ctx.beginPath();
    ctx.arc(rightLeft + listPad + 9, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    // code
    ctx.fillStyle = INK;
    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText(c.code ?? c.id, rightLeft + listPad + 26, cy);
    // name
    ctx.font = `11px ${SANS}`;
    ctx.fillText(c.name, rightLeft + listPad + 62, cy);
    // count
    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`×${count}`, rightLeft + RIGHT_W - listPad, cy);
    // row separator
    if (i < bom.length - 1) {
      ctx.strokeStyle = '#E8E8E8';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(rightLeft + listPad, ry + rowH);
      ctx.lineTo(rightLeft + RIGHT_W - listPad, ry + rowH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ry += rowH;
  });

  // total
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rightLeft + listPad, ry + 8);
  ctx.lineTo(rightLeft + RIGHT_W - listPad, ry + 8);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 13px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText('Total', rightLeft + listPad, ry + 25);
  ctx.textAlign = 'right';
  ctx.fillText(`${total} beads`, rightLeft + RIGHT_W - listPad, ry + 25);

  // ── Kit sticker ─────────────────────────────────────────────────────
  ctx.fillStyle = '#FFF4B8';
  roundRectPath(ctx, rightLeft, stickerTop, RIGHT_W, stickerH, 10);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  roundRectPath(ctx, rightLeft, stickerTop, RIGHT_W, stickerH, 10);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(rightLeft + 14 + 15, stickerTop + stickerH / 2, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF4B8';
  ctx.font = `900 13px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('F', rightLeft + 14 + 15, stickerTop + stickerH / 2 + 0.5);

  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `800 12px ${SANS}`;
  ctx.fillText('Fusiey Pattern Kit', rightLeft + 52, stickerTop + 22);
  ctx.fillStyle = '#555';
  ctx.font = `10px ${SANS}`;
  ctx.fillText('2.6 mm mini beads', rightLeft + 52, stickerTop + 38);
  ctx.textAlign = 'right';
  ctx.font = `10px ${MONO}`;
  ctx.fillText(`${pattern.width}×${pattern.height}`, rightLeft + RIGHT_W - 14, stickerTop + stickerH / 2 + 0.5);

  // ── Footer: assembly steps ──────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, footTop);
  ctx.lineTo(W - PAD, footTop);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = MUTE;
  ctx.font = `10px ${SANS}`;
  ctx.fillText('ASSEMBLY', PAD, footTop + 16);

  const stepsTop = footTop + 26;
  const gap = 12;
  const stepW = (W - PAD * 2 - gap * 3) / 4;
  const stepH = 58;
  ASSEMBLY.forEach((s, i) => {
    const sx = PAD + i * (stepW + gap);
    ctx.fillStyle = '#FFF';
    roundRectPath(ctx, sx, stepsTop, stepW, stepH, 8);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, sx, stepsTop, stepW, stepH, 8);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `800 13px ${SANS}`;
    ctx.fillText(`${s.num}. ${s.title}`, sx + 12, stepsTop + 20);
    ctx.fillStyle = '#555';
    ctx.font = `10px ${SANS}`;
    wrapText(ctx, s.text, sx + 12, stepsTop + 36, stepW - 24, 13);
  });

  ctx.fillStyle = '#888';
  ctx.font = `10px ${SANS}`;
  const dateStr = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  ctx.textAlign = 'left';
  ctx.fillText(`Generated ${dateStr}`, PAD, stepsTop + stepH + 18);
  ctx.textAlign = 'right';
  ctx.fillText('fusiey.com', W - PAD, stepsTop + stepH + 18);

  return canvas;
}

/** Word-wrap helper for the assembly step descriptions. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxW: number, lineH: number,
) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, ly);
      line = w;
      ly += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, ly);
}

/** Load an image (e.g. the logo SVG) for drawing into the canvas. Resolves to
 *  null on failure so export still works without the logo. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
