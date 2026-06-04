import React, { useState, useRef, useEffect } from 'react';
import { usePatternStore } from '../store/usePatternStore';
import { motion, AnimatePresence } from 'motion/react';
import { Pipette, ZoomIn, ZoomOut, Grid3X3, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Transparent eyedropper cursor for the Pick tool.
 * An SVG data-URL (28×28) with a plum 50%-alpha ring + crosshair so the user
 * can see the cell underneath while positioning. Hotspot at the centre so
 * the targeted bead aligns with the click point.
 */
const PICK_CURSOR = (() => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>` +
    `<g fill='none' stroke='%23572C5F' stroke-width='1.6' opacity='0.75'>` +
    `<circle cx='14' cy='14' r='9'/>` +
    `<line x1='14' y1='2' x2='14' y2='8'/>` +
    `<line x1='14' y1='20' x2='14' y2='26'/>` +
    `<line x1='2' y1='14' x2='8' y2='14'/>` +
    `<line x1='20' y1='14' x2='26' y2='14'/>` +
    `</g><circle cx='14' cy='14' r='1.3' fill='%23572C5F' opacity='0.9'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${svg}") 14 14, cell`;
})();

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
  // Pick-tool hover preview — viewport coords + pointed-at colour.
  const [pickHover, setPickHover] = useState<{
    cx: number;
    cy: number;
    colorId: string | null;
  } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(t);
  }, [flash]);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [renderMode, setRenderMode] = useState<'round' | 'ironed'>('round');
  const [showGrid, setShowGrid] = useState(true);
  // Right-click pick menu. Opens at cursor; single item commits the pick.
  const [pickMenu, setPickMenu] = useState<{ x: number; y: number; colorId: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan state — live values live in refs (no re-render per pointermove);
  // `pan` state only mirrors the ref for things like resetView that legitimately
  // need to read/reset the current translation. Writing straight to the DOM
  // via transform keeps dragging at 60 fps even on low-end mobile.
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const transformTargetRef = useRef<HTMLDivElement | null>(null);
  const lastPatternId = useRef<string | null>(null);

  // Push the current pan + zoom straight to the DOM (no React re-render).
  const flushTransform = (z: number) => {
    const el = transformTargetRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${z})`;
  };

  // Whenever zoom state changes (slider, wheel, etc.) re-apply the transform.
  useEffect(() => {
    flushTransform(zoom);
  }, [zoom]);

  const resetView = () => {
    if (!pattern) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    if (containerWidth === 0 || containerHeight === 0) {
      requestAnimationFrame(resetView);
      return;
    }

    // Calculate actual grid size including gaps and padding
    const gapSize = showGrid ? 1 : 0;
    // width * bead + (width-1) * gap + 2px padding
    const totalGridWidth = (pattern.width * BASE_BEAD_SIZE) + ((pattern.width - 1) * gapSize) + (gapSize * 2);
    const totalGridHeight = (pattern.height * BASE_BEAD_SIZE) + ((pattern.height - 1) * gapSize) + (gapSize * 2);

    // Calculate zoom to fit with generous padding
    const padding = 100; 
    const availableWidth = Math.max(100, containerWidth - padding);
    const availableHeight = Math.max(100, containerHeight - padding);
    
    const zoomX = availableWidth / totalGridWidth;
    const zoomY = availableHeight / totalGridHeight;
    
    // Fit to the more constrained dimension
    const fitZoom = Math.max(0.05, Math.min(2, Math.min(zoomX, zoomY)));
    
    if (!isNaN(fitZoom)) {
      setZoom(fitZoom);
      panRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
      flushTransform(fitZoom);
    }
  };

  // Auto-fit on pattern change
  useEffect(() => {
    if (pattern) {
      // Small delay to ensure layout is stable
      const timer = setTimeout(resetView, 150);
      return () => clearTimeout(timer);
    }
  }, [pattern?.id, pattern?.width, pattern?.height]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => resetView();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pattern]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          setTool('move');
          break;
        case 'b':
          setTool('paint');
          break;
        case 'g':
          setTool('fill');
          break;
        case 'i':
          setTool('pick');
          break;
        case 'e':
          setTool('erase');
          break;
        case 'r':
          resetView();
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            usePatternStore.getState().undo();
          }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            usePatternStore.getState().redo();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, pattern]);

  const BASE_BEAD_SIZE = 16;

  const handleCellAction = (x: number, y: number) => {
    if (activeTool === 'move') return;

    if (activeTool === 'paint') {
      updateCell(x, y, selectedColor?.id || null);
    } else if (activeTool === 'erase') {
      updateCell(x, y, null);
    } else if (activeTool === 'fill') {
      const result = fillArea(x, y);
      if (!result.ok) {
        if (result.reason === 'unenclosed') {
          setFlash('That region isn\'t enclosed — bucket would flood the whole background.');
        } else if (result.reason === 'same-color') {
          setFlash('Already this colour — nothing to fill.');
        }
      }
    }
    // Pick is handled via pointer-down/up (preview + commit) in handleMouseUp.
  };

  /**
   * Resolve which cell the pointer is over. Cell components dispatch (x, y)
   * directly via their own onPointerEnter — but on mobile, fingers drag past
   * the initial cell without firing per-cell handlers, so we fall back to
   * elementFromPoint to find the cell under the touch.
   */
  const resolveCellUnderPointer = (
    e: React.PointerEvent,
    x?: number,
    y?: number,
  ): { x: number; y: number } | null => {
    if (x !== undefined && y !== undefined) return { x, y };
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellEl = el?.closest('[data-cell-coords]');
    if (!cellEl) return null;
    const [cx, cy] = cellEl.getAttribute('data-cell-coords')!.split(',').map(Number);
    return { x: cx, y: cy };
  };

  const updatePickPreview = (e: React.PointerEvent, cell: { x: number; y: number } | null) => {
    if (!cell || !pattern) return;
    setPickHover({
      cx: e.clientX,
      cy: e.clientY,
      colorId: pattern.grid[cell.y][cell.x].colorId ?? null,
    });
  };

  const commitPick = () => {
    if (!pickHover) return;
    if (pickHover.colorId) {
      const color = currentPalette.colors.find((c) => c.id === pickHover.colorId);
      if (color) {
        setSelectedColor(color);
        setTool('paint');
        return;
      }
    }
    setSelectedColor(null);
    setTool('erase');
  };

  const handleMouseDown = (e: React.PointerEvent, x?: number, y?: number) => {
    if (activeTool === 'move' || e.button === 1 || e.pointerType === 'touch' && e.shiftKey) {
      setIsPanning(true);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      // Capture the pointer so we keep receiving move/up events even if the
      // pointer leaves the grid container (matters for fast drags near edges).
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    // Pick: enter "tracking" mode. Don't commit yet — let the user drag to
    // adjust which cell they're sampling, then commit on pointer-up.
    if (activeTool === 'pick') {
      setIsDrawing(true);
      updatePickPreview(e, resolveCellUnderPointer(e, x, y));
      return;
    }

    if (x !== undefined && y !== undefined) {
      setIsDrawing(true);
      handleCellAction(x, y);
    }
  };

  const handleMouseMove = (e: React.PointerEvent, x?: number, y?: number) => {
    if (isPanning) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      // Coalesce high-frequency pointermove events into one rAF paint —
      // avoids piling up React re-renders that tank mobile FPS.
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          flushTransform(usePatternStore.getState().zoom);
        });
      }
      return;
    }

    // Pick-tool hover preview — desktop tracks free hover, mobile tracks
    // while finger is pressed. Both paths land here.
    if (activeTool === 'pick') {
      updatePickPreview(e, resolveCellUnderPointer(e, x, y));
      return; // pick never paints during drag
    }

    if (isDrawing) {
      const cell = resolveCellUnderPointer(e, x, y);
      if (cell) handleCellAction(cell.x, cell.y);
    }
  };

  const handleMouseUp = () => {
    if (activeTool === 'pick') {
      // Commit the pick that was being previewed.
      commitPick();
      setPickHover(null);
      setIsDrawing(false);
      return;
    }
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
    if (isPanning) {
      setIsPanning(false);
      // Sync state once at the end — lets resetView/other consumers read the
      // final pan without having observed every intermediate frame.
      setPan({ ...panRef.current });
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
    setPickHover(null);
  };

  // Drop preview when tool changes (e.g. pick → paint after click).
  useEffect(() => {
    if (activeTool !== 'pick') setPickHover(null);
  }, [activeTool]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Always allow zooming with wheel for better UX
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const currentZoom = usePatternStore.getState().zoom;
      setZoom(Math.max(0.05, Math.min(5, currentZoom + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    // Mobile Pinch-to-Zoom support
    let initialDistance: number | null = null;
    let initialZoom = zoom;

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
        const currentDistance = getDistance(e.touches);
        const scale = currentDistance / initialDistance;
        const newZoom = Math.max(0.05, Math.min(5, initialZoom * scale));
        setZoom(newZoom);
      }
    };

    const handleTouchEnd = () => {
      initialDistance = null;
    };

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

  if (!pattern) return null;

  return (
    <div className="relative flex-1 flex flex-col bg-paper rounded-[20px] border border-ink/20 w-full h-full max-w-full max-h-full overflow-hidden select-none">
      {/* Transient warning toast (bucket-fill errors, etc.) */}
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

      {/* Zoom & Grid Controls Overlay — quiet chrome */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-wrap items-center gap-2 justify-end max-w-[calc(100%-1.5rem)]">
        <div className="flex items-center gap-1 px-2 py-1 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25">
          <button
            onClick={() => setZoom(Math.max(0.05, zoom - 0.1))}
            aria-label="Zoom out"
            className="h-9 w-9 flex items-center justify-center text-ink-hint hover:text-ink rounded-full"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min="0.05"
            max="5"
            step="0.05"
            value={isNaN(zoom) ? 1 : zoom}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) setZoom(val);
            }}
            className="w-16 sm:w-24 h-1 bg-ink/20 rounded-full appearance-none cursor-pointer accent-[color:var(--color-ink)]"
          />
          <button
            onClick={() => setZoom(Math.min(5, zoom + 0.1))}
            aria-label="Zoom in"
            className="h-9 w-9 flex items-center justify-center text-ink-hint hover:text-ink rounded-full"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="font-pixel-mono text-ink text-sm w-10 text-center">
            {isNaN(zoom) ? '100%' : `${Math.round(zoom * 100)}%`}
          </span>
        </div>

        <div className="flex gap-1 p-1 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25">
          <button
            onClick={() => setRenderMode('round')}
            className={cn(
              'px-3 py-1 rounded-pill font-cute font-semibold text-[10px] uppercase tracking-[0.08em] transition-all',
              renderMode === 'round' ? 'bg-butter text-ink border border-ink/30' : 'text-ink-hint hover:text-ink',
            )}
          >Round</button>
          <button
            onClick={() => setRenderMode('ironed')}
            className={cn(
              'px-3 py-1 rounded-pill font-cute font-semibold text-[10px] uppercase tracking-[0.08em] transition-all',
              renderMode === 'ironed' ? 'bg-butter text-ink border border-ink/30' : 'text-ink-hint hover:text-ink',
            )}
          >Ironed</button>
        </div>

        <label className="flex items-center gap-2 px-3 py-1.5 bg-paper/90 backdrop-blur-sm rounded-pill border border-ink/25 font-cute font-semibold text-[10px] uppercase tracking-[0.08em] text-ink cursor-pointer hover:bg-butter/60 transition-colors">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="w-3.5 h-3.5 accent-[color:var(--color-ink)]"
          />
          <Grid3X3 className="w-3 h-3" />
          Grid
        </label>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'flex-1 relative overflow-hidden bg-blush/40 flex items-center justify-center min-h-0 touch-none',
          activeTool === 'move' && 'cursor-grab active:cursor-grabbing',
          activeTool !== 'move' && activeTool !== 'pick' && 'cursor-crosshair',
        )}
        style={activeTool === 'pick' ? { cursor: PICK_CURSOR } : undefined}
        onPointerDown={(e) => handleMouseDown(e)}
        onPointerMove={(e) => handleMouseMove(e)}
        onPointerUp={handleMouseUp}
        onPointerLeave={handleMouseUp}
      >
        <div
          ref={(el) => {
            transformTargetRef.current = el;
            if (el) {
              // Initial paint — keeps SSR/first-render aligned with ref-based
              // updates afterwards. After this, we only mutate style.transform.
              el.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoom})`;
            }
          }}
          className="will-change-transform w-fit h-fit flex items-center justify-center"
          style={{ transformOrigin: 'center' }}
        >
          <div
            ref={gridRef}
            id="pattern-grid"
            className="grid bg-ink/10 rounded-[12px] overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${pattern.width}, ${BASE_BEAD_SIZE}px)`,
              width: 'fit-content',
              gap: showGrid && renderMode !== 'ironed' ? '1px' : '0',
              padding: showGrid && renderMode !== 'ironed' ? '1px' : '0',
              isolation: 'isolate',
              clipPath: 'inset(0 round 12px)',
            }}
          >
            {pattern.grid.map((row, y) => 
              row.map((cell, x) => {
                const color = currentPalette.colors.find((c) => c.id === cell.colorId);
                return (
                  <div
                    key={`${x}-${y}`}
                    data-cell-coords={`${x},${y}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.button === 2) return; // Ignore right click for drawing
                      handleMouseDown(e, x, y);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!cell.colorId) return;
                      setPickMenu({ x: e.clientX, y: e.clientY, colorId: cell.colorId });
                    }}
                    onPointerEnter={(e) => handleMouseMove(e, x, y)}
                    className={cn(
                      'relative transition-all duration-300',
                      renderMode === 'round' && 'rounded-full',
                      renderMode === 'ironed' && 'rounded-[2px] scale-[1.05] blur-[0.4px]',
                      !cell.colorId && 'bg-paper-warm flex items-center justify-center overflow-hidden',
                    )}
                    style={{
                      width: `${BASE_BEAD_SIZE}px`,
                      height: `${BASE_BEAD_SIZE}px`,
                      backgroundColor: cell.colorId ? color?.hex : 'transparent',
                      borderColor: renderMode === 'hollow' && cell.colorId ? color?.hex : 'transparent'
                    }}
                    title={color ? `${color.name} (${color.code})` : 'Empty'}
                  >
                    {!cell.colorId && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
                        <div className="w-full h-[1px] bg-ink rotate-45 absolute" />
                        <div className="w-full h-[1px] bg-ink -rotate-45 absolute" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pick-tool hover preview chip — anchored to cursor.
          Shows the colour about to be picked so the user can confirm
          before committing. Hidden once tool changes or pointer leaves. */}
      <AnimatePresence>
        {pickHover && (
          <motion.div
            key="pick-preview"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[120] pointer-events-none"
            style={{
              left: pickHover.cx + 14,
              top: pickHover.cy - 14,
              transform: 'translateY(-100%)',
            }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-paper border-[2px] border-ink rounded-pill"
              style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
            >
              {(() => {
                const color = pickHover.colorId
                  ? currentPalette.colors.find((c) => c.id === pickHover.colorId)
                  : null;
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
                      style={{
                        backgroundColor: color.hex,
                        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.55)',
                      }}
                      aria-hidden="true"
                    />
                    {color.code && (
                      <span className="font-pixel-mono text-ink text-xs leading-none px-1.5 py-0.5 bg-butter border border-ink/40 rounded">
                        {color.code}
                      </span>
                    )}
                    <span className="font-cute font-semibold text-ink text-xs whitespace-nowrap">
                      {color.name}
                    </span>
                    <span className="font-pixel-mono text-ink-hint text-xs leading-none">
                      {color.hex.toUpperCase()}
                    </span>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right-click pick menu — single eyedropper action. Matches the Pick
          tool's commitPick: switches to paint with the clicked cell's colour. */}
      <AnimatePresence>
        {pickMenu && (() => {
          const picked = currentPalette.colors.find((c) => c.id === pickMenu.colorId);
          if (!picked) return null;
          return (
            <>
              <div
                className="fixed inset-0 z-[100]"
                onClick={() => setPickMenu(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setPickMenu(null);
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  top: pickMenu.y,
                  left: pickMenu.x,
                  boxShadow: '3px 3px 0 0 var(--color-ink)',
                }}
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
                  吸取颜色 {picked.name} ({picked.code})
                </button>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
