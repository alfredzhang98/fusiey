import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { usePatternStore } from '../store/usePatternStore';
import { motion, AnimatePresence } from 'motion/react';
import { Pipette, ZoomIn, ZoomOut, Grid3X3, CaseSensitive, AlertTriangle, Flame } from 'lucide-react';
import { cn } from '../lib/utils';
import { codeTextColor } from '../utils/colorUtils';

/**
 * Tool cursors — the same lucide icons as the toolbar, drawn as a single plain
 * ink stroke (no white halo, so the edge stays clean against the canvas).
 * base64-encoded SVG; hotspot tuned to each tool's working tip.
 */
const CURSOR_SIZE = 26;
const CURSOR_INK = '#2D2D2D';
function toolCursor(innerSvg: string, hotVbX: number, hotVbY: number): string {
  const raw =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 24 24">` +
    `<g fill="none" stroke="${CURSOR_INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${innerSvg}</g>` +
    `</svg>`;
  const s = CURSOR_SIZE / 24;
  return `url("data:image/svg+xml;base64,${btoa(raw)}") ${Math.round(hotVbX * s)} ${Math.round(hotVbY * s)}, crosshair`;
}

const CURSOR_PAINT = toolCursor(
  '<path d="m14.622 17.897-10.68-2.913"/><path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"/><path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"/>',
  3, 20,
);
const CURSOR_FILL = toolCursor(
  '<g transform="translate(24,0) scale(-1,1)"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></g>',
  15, 18,
);
const CURSOR_ERASE = toolCursor(
  '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
  4, 20,
);
const CURSOR_PICK = toolCursor(
  '<path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/><path d="m2 22 .414-.414"/>',
  2, 22,
);

/** Buffer resolution per bead cell. Higher = crisper blocks when zoomed in,
 *  at the cost of offscreen-canvas memory (100×100 × 24² ≈ 23 MB). */
const CELL = 24;

// Pegboard look — empty cells read as a soft off-white board with a faint
// cross, so a blank canvas is uniformly light grey (like a bead pegboard).
const PEG_BG = '#F2F1ED';
const PEG_X = '#D7D6D0';

type RenderMode = 'round' | 'ironed';

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

/** Paint one grid cell into the buffer: grey pegboard base, then either a
 *  flat-colour bead or the empty-cell cross. No highlights — flat fill reads
 *  cleaner and doesn't look blurry when zoomed. */
function drawCell(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number, hex: string | null, mode: RenderMode,
) {
  const px = gx * CELL;
  const py = gy * CELL;

  // Pegboard base for this cell.
  ctx.fillStyle = PEG_BG;
  ctx.fillRect(px, py, CELL, CELL);

  if (!hex) {
    // Empty peg — faint grey cross.
    const m = CELL * 0.3;
    ctx.strokeStyle = PEG_X;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px + m, py + m);
    ctx.lineTo(px + CELL - m, py + CELL - m);
    ctx.moveTo(px + CELL - m, py + m);
    ctx.lineTo(px + m, py + CELL - m);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = hex;
  if (mode === 'ironed') {
    // Fused look — rounded squares fill the cell (beads melt together).
    roundRectPath(ctx, px + 0.5, py + 0.5, CELL - 1, CELL - 1, CELL * 0.24);
    ctx.fill();
  } else {
    // Round bead with a small gap so the grey board shows between beads.
    ctx.beginPath();
    ctx.arc(px + CELL / 2, py + CELL / 2, (CELL / 2) * 0.92, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const PatternGrid: React.FC = () => {
  const {
    pattern,
    updateCell,
    selectedColor,
    saveToHistory,
    zoom,
    setZoom,
    activeTool,
    setTool,
    currentPalette,
    fillArea,
    setSelectedColor,
  } = usePatternStore();

  const [flash, setFlash] = useState<string | null>(null);
  const [pickHover, setPickHover] = useState<{ cx: number; cy: number; colorId: string | null } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [renderMode, setRenderMode] = useState<RenderMode>('round');
  const [showGrid, setShowGrid] = useState(true);
  const [showCodes, setShowCodes] = useState(true);
  const [ironing, setIroning] = useState<{ pct: number } | null>(null);
  const [pickMenu, setPickMenu] = useState<{ x: number; y: number; colorId: string } | null>(null);

  // O(1) colour lookup — keyed by id.
  const colorMap = useMemo(
    () => new Map(currentPalette.colors.map((c) => [c.id, c])),
    [currentPalette],
  );

  // ── Refs (read by the imperative render loop without stale closures) ──
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const patternRef = useRef(pattern);
  const colorMapRef = useRef(colorMap);
  const renderModeRef = useRef(renderMode);
  const showGridRef = useRef(showGrid);
  const showCodesRef = useRef(showCodes);
  const panRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const drawRaf = useRef<number | null>(null);
  const isDrawingRef = useRef(false);

  // Sync refs every render (safe for refs; avoids stale reads in rAF/pointer).
  patternRef.current = pattern;
  colorMapRef.current = colorMap;
  renderModeRef.current = renderMode;
  showGridRef.current = showGrid;
  showCodesRef.current = showCodes;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);

  // ── Offscreen buffer: paints the bead colour blocks ───────────────────

  const renderBuffer = useCallback(() => {
    const pat = patternRef.current;
    if (!pat) return;
    let buffer = bufferRef.current;
    if (!buffer) {
      buffer = document.createElement('canvas');
      bufferRef.current = buffer;
    }
    const w = pat.width * CELL;
    const h = pat.height * CELL;
    if (buffer.width !== w || buffer.height !== h) {
      buffer.width = w;
      buffer.height = h;
    }
    const ctx = buffer.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const cmap = colorMapRef.current;
    const mode = renderModeRef.current;
    for (let y = 0; y < pat.height; y++) {
      const row = pat.grid[y];
      for (let x = 0; x < pat.width; x++) {
        const id = row[x].colorId;
        const col = id ? cmap.get(id) : undefined;
        drawCell(ctx, x, y, col?.hex ?? null, mode);
      }
    }
  }, []);

  /** Repaint a single buffer cell — used during drag for incremental updates. */
  const paintBufferCell = (x: number, y: number, colorId: string | null) => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    const ctx = buffer.getContext('2d');
    if (!ctx) return;
    const col = colorId ? colorMapRef.current.get(colorId) : undefined;
    drawCell(ctx, x, y, col?.hex ?? null, renderModeRef.current);
  };

  // ── Main canvas: composites buffer + grid lines + crisp vector codes ──

  const draw = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const container = containerRef.current;
    const buffer = bufferRef.current;
    const pat = patternRef.current;
    if (!canvas || !container || !buffer || !pat) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const bw = Math.round(cw * dpr);
    const bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const z = usePatternStore.getState().zoom;
    const p = panRef.current;
    const gridPxW = pat.width * CELL;
    const gridPxH = pat.height * CELL;
    const viewX = cw / 2 + p.x;
    const viewY = ch / 2 + p.y;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(viewX, viewY);
    ctx.scale(z, z);
    ctx.translate(-gridPxW / 2, -gridPxH / 2);

    // Buffer already carries the grey pegboard base + beads + empty crosses.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, 0, 0);

    // Pegboard grid — three weights like a real bead chart: thin per-cell
    // lines, a heavier line every 10 cells (counting blocks), and the thickest
    // outer border. Widths are screen-constant (divided by zoom).
    const BLOCK = 10;
    if (showGridRef.current) {
      // Thin per-cell lines (skip block lines, drawn heavier below).
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = 'rgba(45,45,45,0.13)';
      ctx.beginPath();
      for (let c = 1; c < pat.width; c++) {
        if (c % BLOCK === 0) continue;
        ctx.moveTo(c * CELL, 0);
        ctx.lineTo(c * CELL, gridPxH);
      }
      for (let r = 1; r < pat.height; r++) {
        if (r % BLOCK === 0) continue;
        ctx.moveTo(0, r * CELL);
        ctx.lineTo(gridPxW, r * CELL);
      }
      ctx.stroke();

      // Heavier 10×10 block lines.
      ctx.lineWidth = 2 / z;
      ctx.strokeStyle = 'rgba(45,45,45,0.42)';
      ctx.beginPath();
      for (let c = BLOCK; c < pat.width; c += BLOCK) {
        ctx.moveTo(c * CELL, 0);
        ctx.lineTo(c * CELL, gridPxH);
      }
      for (let r = BLOCK; r < pat.height; r += BLOCK) {
        ctx.moveTo(0, r * CELL);
        ctx.lineTo(gridPxW, r * CELL);
      }
      ctx.stroke();
    }

    // Outer border — thickest, always drawn so the canvas bounds stay clear.
    ctx.lineWidth = 4 / z;
    ctx.strokeStyle = 'rgba(45,45,45,0.8)';
    ctx.strokeRect(0, 0, gridPxW, gridPxH);

    // Bead codes — vector text (crisp at any zoom). Only when cells are big
    // enough to read, and only over the visible viewport (culled).
    const screenCell = CELL * z;
    if (showCodesRef.current && screenCell >= 13) {
      const invX = (sx: number) => (sx - viewX) / z + gridPxW / 2;
      const invY = (sy: number) => (sy - viewY) / z + gridPxH / 2;
      const minC = Math.max(0, Math.floor(invX(0) / CELL));
      const maxC = Math.min(pat.width - 1, Math.floor(invX(cw) / CELL));
      const minR = Math.max(0, Math.floor(invY(0) / CELL));
      const maxR = Math.min(pat.height - 1, Math.floor(invY(ch) / CELL));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${CELL * 0.4}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const cmap = colorMapRef.current;
      for (let y = minR; y <= maxR; y++) {
        const row = pat.grid[y];
        for (let x = minC; x <= maxC; x++) {
          const id = row[x].colorId;
          if (!id) continue;
          const col = cmap.get(id);
          if (!col?.code) continue;
          ctx.fillStyle = codeTextColor(col.hex);
          ctx.fillText(col.code, x * CELL + CELL / 2, y * CELL + CELL / 2 + 0.5);
        }
      }
    }

    ctx.restore();
  }, []);

  const scheduleDraw = useCallback(() => {
    if (drawRaf.current != null) return;
    drawRaf.current = requestAnimationFrame(() => {
      drawRaf.current = null;
      draw();
    });
  }, [draw]);

  // ── Fit-to-view ───────────────────────────────────────────────────────

  const resetView = useCallback(() => {
    const pat = patternRef.current;
    const container = containerRef.current;
    if (!pat || !container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw === 0 || ch === 0) {
      requestAnimationFrame(resetView);
      return;
    }
    const gridPxW = pat.width * CELL;
    const gridPxH = pat.height * CELL;
    const padding = 64;
    const fitZoom = Math.max(0.02, Math.min(
      4,
      (cw - padding) / gridPxW,
      (ch - padding) / gridPxH,
    ));
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    if (!isNaN(fitZoom)) setZoom(fitZoom);
    scheduleDraw();
  }, [setZoom, scheduleDraw]);

  // Full buffer re-render on structural change (size / palette / mode / grid)
  // or any history step (undo/redo/clear/fill). Drag paint updates the buffer
  // incrementally and intentionally does NOT trip this.
  const historyIndex = usePatternStore((s) => s.historyIndex);
  useEffect(() => {
    renderBuffer();
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern?.id, pattern?.width, pattern?.height, currentPalette, renderMode, showGrid, historyIndex]);

  // Codes toggle / zoom only need a recomposite, not a buffer rebuild.
  useEffect(() => { scheduleDraw(); }, [showCodes, zoom, pan, scheduleDraw]);

  // Auto-fit when a different pattern loads.
  useEffect(() => {
    if (pattern) {
      const t = setTimeout(resetView, 60);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern?.id, pattern?.width, pattern?.height]);

  // Keep canvas sized to its container.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => scheduleDraw());
    ro.observe(container);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); setTool('move'); break;
        case 'b': setTool('paint'); break;
        case 'g': setTool('fill'); break;
        case 'i': setTool('pick'); break;
        case 'e': setTool('erase'); break;
        case 'r': resetView(); break;
        case 'z': if (e.ctrlKey || e.metaKey) { e.preventDefault(); usePatternStore.getState().undo(); } break;
        case 'y': if (e.ctrlKey || e.metaKey) { e.preventDefault(); usePatternStore.getState().redo(); } break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, resetView]);

  // ── Coordinate mapping ────────────────────────────────────────────────

  const cellFromEvent = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = mainCanvasRef.current;
    const container = containerRef.current;
    const pat = patternRef.current;
    if (!canvas || !container || !pat) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const z = usePatternStore.getState().zoom;
    const p = panRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const viewX = cw / 2 + p.x;
    const viewY = ch / 2 + p.y;
    const gridPxW = pat.width * CELL;
    const gridPxH = pat.height * CELL;
    const wx = (sx - viewX) / z + gridPxW / 2;
    const wy = (sy - viewY) / z + gridPxH / 2;
    const cx = Math.floor(wx / CELL);
    const cy = Math.floor(wy / CELL);
    if (cx < 0 || cy < 0 || cx >= pat.width || cy >= pat.height) return null;
    return { x: cx, y: cy };
  };

  // ── Drawing actions ───────────────────────────────────────────────────

  const handleCellAction = (x: number, y: number) => {
    if (activeTool === 'move') return;
    if (activeTool === 'paint') {
      const colorId = selectedColor?.id ?? null;
      updateCell(x, y, colorId);
      paintBufferCell(x, y, colorId);
      scheduleDraw();
    } else if (activeTool === 'erase') {
      updateCell(x, y, null);
      paintBufferCell(x, y, null);
      scheduleDraw();
    } else if (activeTool === 'fill') {
      const result = fillArea(x, y);
      if (result.ok) {
        renderBuffer();
        scheduleDraw();
      } else if (result.reason === 'unenclosed') {
        setFlash("That region isn't enclosed — bucket would flood the whole background.");
      } else if (result.reason === 'same-color') {
        setFlash('Already this colour — nothing to fill.');
      }
    }
  };

  const updatePickPreview = (clientX: number, clientY: number, cell: { x: number; y: number } | null) => {
    const pat = patternRef.current;
    if (!cell || !pat) return;
    setPickHover({ cx: clientX, cy: clientY, colorId: pat.grid[cell.y][cell.x].colorId ?? null });
  };

  const commitPick = () => {
    if (!pickHover) return;
    if (pickHover.colorId) {
      const color = colorMap.get(pickHover.colorId);
      if (color) { setSelectedColor(color); setTool('paint'); return; }
    }
    setSelectedColor(null);
    setTool('erase');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // right-click handled by context menu
    const isPanGesture = activeTool === 'move' || e.button === 1;
    if (isPanGesture) {
      setIsPanning(true);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    const cell = cellFromEvent(e.clientX, e.clientY);
    if (activeTool === 'pick') {
      isDrawingRef.current = true;
      updatePickPreview(e.clientX, e.clientY, cell);
      return;
    }
    if (cell) {
      isDrawingRef.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      handleCellAction(cell.x, cell.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      scheduleDraw();
      return;
    }
    if (activeTool === 'pick') {
      if (!isDrawingRef.current && e.pointerType === 'touch') return;
      updatePickPreview(e.clientX, e.clientY, cellFromEvent(e.clientX, e.clientY));
      return;
    }
    if (isDrawingRef.current) {
      const cell = cellFromEvent(e.clientX, e.clientY);
      if (cell) handleCellAction(cell.x, cell.y);
    }
  };

  const onPointerUp = () => {
    if (activeTool === 'pick' && isDrawingRef.current) {
      commitPick();
      setPickHover(null);
      isDrawingRef.current = false;
      return;
    }
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      saveToHistory();
    }
    if (isPanning) {
      setIsPanning(false);
      setPan({ ...panRef.current });
    }
    setPickHover(null);
  };

  // Desktop hover preview for the pick tool (no button held).
  const onPointerHover = (e: React.PointerEvent) => {
    if (activeTool !== 'pick' || isDrawingRef.current) return;
    updatePickPreview(e.clientX, e.clientY, cellFromEvent(e.clientX, e.clientY));
  };

  useEffect(() => {
    if (activeTool !== 'pick') setPickHover(null);
  }, [activeTool]);

  // ── Wheel zoom + pinch zoom ───────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.06 : 0.06;
      const current = usePatternStore.getState().zoom;
      setZoom(Math.max(0.05, Math.min(6, current * (1 + delta))));
    };
    container.addEventListener('wheel', handleWheel, { passive: false });

    let initialDistance: number | null = null;
    let initialZoom = 1;
    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        initialZoom = usePatternStore.getState().zoom;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const scale = getDistance(e.touches) / initialDistance;
        setZoom(Math.max(0.05, Math.min(6, initialZoom * scale)));
      }
    };
    const handleTouchEnd = () => { initialDistance = null; };
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [setZoom]);

  // ── Ironed transition ─────────────────────────────────────────────────

  const startIroning = () => {
    if (renderMode === 'ironed' || ironing) return;
    setIroning({ pct: 0 });
    let pct = 0;
    const id = setInterval(() => {
      pct += 7;
      if (pct >= 100) {
        clearInterval(id);
        setRenderMode('ironed');     // triggers buffer rebuild via effect
        setIroning({ pct: 100 });
        setTimeout(() => setIroning(null), 380);
      } else {
        setIroning({ pct });
      }
    }, 45);
  };

  // Cursor reflects the active tool the moment the pointer enters the canvas.
  const canvasCursor =
    activeTool === 'move' ? (isPanning ? 'grabbing' : 'grab')
    : activeTool === 'paint' ? CURSOR_PAINT
    : activeTool === 'fill' ? CURSOR_FILL
    : activeTool === 'erase' ? CURSOR_ERASE
    : activeTool === 'pick' ? CURSOR_PICK
    : 'crosshair';

  if (!pattern) return null;

  return (
    <div className="relative flex-1 flex flex-col bg-paper w-full h-full max-w-full max-h-full overflow-hidden select-none">
      {/* Transient warning toast */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 px-4 py-2 bg-butter border-[2px] border-ink rounded-pill font-cute font-semibold text-ink text-xs sm:text-sm max-w-[calc(100%-1.5rem)]"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{flash}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ironing progress overlay */}
      <AnimatePresence>
        {ironing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-ink/30 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
              className="w-full max-w-xs bg-paper rounded-[20px] border-[3px] border-ink p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [-8, 8, -8], y: [0, -1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Flame className="w-5 h-5 text-[#E5703A]" />
                </motion.div>
                <h3 className="font-cute font-semibold text-ink text-lg">Ironing beads…</h3>
              </div>
              <div className="w-full h-3 bg-paper-warm rounded-full border-[2px] border-ink overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FBD46B] to-[#E5703A] transition-all duration-100 ease-out"
                  style={{ width: `${ironing.pct}%` }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom & display controls — uniform-height pills. Wraps cleanly (never
          clips the zoom pill); left-aligned on mobile so wrapped rows stay clear
          of the right-edge tool rail. */}
      <div className="absolute top-3 left-3 right-3 sm:left-auto sm:top-4 sm:right-4 z-20 flex flex-wrap gap-2 justify-start sm:justify-end">
        {/* Zoom */}
        <div className="h-9 inline-flex items-center gap-0.5 px-1.5 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25">
          <button
            onClick={() => setZoom(Math.max(0.05, zoom - 0.1))}
            aria-label="Zoom out"
            className="h-7 w-7 flex items-center justify-center text-ink-hint hover:text-ink rounded-full"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min="0.05"
            max="6"
            step="0.05"
            value={isNaN(zoom) ? 1 : zoom}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setZoom(val);
            }}
            className="hidden sm:block w-24 h-1 bg-ink/20 rounded-full appearance-none cursor-pointer accent-[color:var(--color-ink)]"
          />
          <button
            onClick={() => setZoom(Math.min(6, zoom + 0.1))}
            aria-label="Zoom in"
            className="h-7 w-7 flex items-center justify-center text-ink-hint hover:text-ink rounded-full"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="font-pixel-mono text-ink text-sm w-10 text-center">
            {isNaN(zoom) ? '100%' : `${Math.round(zoom * 100)}%`}
          </span>
        </div>

        {/* Round / Ironed */}
        <div className="h-9 inline-flex items-center gap-1 p-1 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25">
          <button
            onClick={() => setRenderMode('round')}
            className={cn(
              'h-7 px-3 rounded-pill font-cute font-semibold text-[10px] uppercase tracking-[0.08em] transition-all',
              renderMode === 'round' ? 'bg-butter text-ink border border-ink/30' : 'text-ink-hint hover:text-ink',
            )}
          >Round</button>
          <button
            onClick={startIroning}
            className={cn(
              'h-7 px-3 rounded-pill font-cute font-semibold text-[10px] uppercase tracking-[0.08em] transition-all inline-flex items-center gap-1',
              renderMode === 'ironed' ? 'bg-butter text-ink border border-ink/30' : 'text-ink-hint hover:text-ink',
            )}
          >
            <Flame className="w-3 h-3" />
            Ironed
          </button>
        </div>

        {/* Grid toggle */}
        <label className="h-9 inline-flex items-center gap-1.5 px-3 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25 font-cute font-semibold text-[10px] uppercase tracking-[0.08em] text-ink cursor-pointer hover:bg-butter/60 transition-colors">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="w-3.5 h-3.5 accent-[color:var(--color-ink)]"
          />
          <Grid3X3 className="w-3 h-3" />
          Grid
        </label>

        {/* Codes toggle */}
        <label className="h-9 inline-flex items-center gap-1.5 px-3 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25 font-cute font-semibold text-[10px] uppercase tracking-[0.08em] text-ink cursor-pointer hover:bg-butter/60 transition-colors">
          <input
            type="checkbox"
            checked={showCodes}
            onChange={(e) => setShowCodes(e.target.checked)}
            className="w-3.5 h-3.5 accent-[color:var(--color-ink)]"
          />
          <CaseSensitive className="w-3 h-3" />
          Codes
        </label>
      </div>

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-blush/40 min-h-0 touch-none"
        style={{ cursor: canvasCursor }}
        onContextMenu={(e) => {
          e.preventDefault();
          const cell = cellFromEvent(e.clientX, e.clientY);
          if (!cell) return;
          const id = patternRef.current?.grid[cell.y][cell.x].colorId;
          if (id) setPickMenu({ x: e.clientX, y: e.clientY, colorId: id });
        }}
      >
        <canvas
          ref={mainCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: canvasCursor }}
          onPointerDown={onPointerDown}
          onPointerMove={(e) => { onPointerMove(e); onPointerHover(e); }}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      {/* Pick-tool hover preview chip */}
      <AnimatePresence>
        {pickHover && (
          <motion.div
            key="pick-preview"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[120] pointer-events-none"
            style={{ left: pickHover.cx + 14, top: pickHover.cy - 14, transform: 'translateY(-100%)' }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-paper border-[2px] border-ink rounded-pill"
              style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
            >
              {(() => {
                const color = pickHover.colorId ? colorMap.get(pickHover.colorId) : null;
                if (!color) {
                  return (
                    <>
                      <div className="w-4 h-4 rounded-full border border-ink/30 bg-paper-warm" aria-hidden="true" />
                      <span className="font-cute font-semibold text-ink-hint text-xs">empty</span>
                    </>
                  );
                }
                return (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border border-ink"
                      style={{ backgroundColor: color.hex, boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.55)' }}
                      aria-hidden="true"
                    />
                    {color.code && (
                      <span className="font-pixel-mono text-ink text-xs leading-none px-1.5 py-0.5 bg-butter border border-ink/40 rounded">
                        {color.code}
                      </span>
                    )}
                    <span className="font-cute font-semibold text-ink text-xs whitespace-nowrap">{color.name}</span>
                    <span className="font-pixel-mono text-ink-hint text-xs leading-none">{color.hex.toUpperCase()}</span>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right-click pick menu */}
      <AnimatePresence>
        {pickMenu && (() => {
          const picked = colorMap.get(pickMenu.colorId);
          if (!picked) return null;
          return (
            <>
              <div
                className="fixed inset-0 z-[100]"
                onClick={() => setPickMenu(null)}
                onContextMenu={(e) => { e.preventDefault(); setPickMenu(null); }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{ top: pickMenu.y, left: pickMenu.x, boxShadow: '3px 3px 0 0 var(--color-ink)' }}
                className="fixed z-[101] bg-paper border-[2px] border-ink rounded-[12px] p-1 min-w-[220px]"
              >
                <button
                  onClick={() => {
                    setSelectedColor(picked);
                    setTool('paint');
                    setPickMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-cute font-semibold text-sm text-ink hover:bg-butter rounded-md transition-colors"
                >
                  <Pipette className="w-3.5 h-3.5" />
                  <span
                    className="inline-block w-4 h-4 rounded-full border border-ink/40 flex-shrink-0"
                    style={{ backgroundColor: picked.hex }}
                  />
                  Pick {picked.name} ({picked.code})
                </button>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
