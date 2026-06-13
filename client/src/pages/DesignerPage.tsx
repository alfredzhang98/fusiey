import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Undo2, Redo2, Trash2, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ControlPanel } from '../components/ControlPanel';
import { PaletteSidebar } from '../components/PaletteSidebar';
import { PatternGrid } from '../components/PatternGrid';
import { MobileToolRail } from '../components/MobileToolRail';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { usePatternStore } from '../store/usePatternStore';
import { loadSavedPattern } from '../utils/loadPattern';
import { cn } from '../lib/utils';

const DEFAULT_BOARD = { w: 50, h: 50 };

export function DesignerPage() {
  const { pattern, newCanvas, undo, redo, historyIndex, history, clearGrid } = usePatternStore();
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Mobile drawer state. Desktop (lg+) renders both panels statically; these
   * flags are ignored there thanks to `lg:translate-y-0` overrides. Only one
   * drawer open at a time.
   */
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const anyDrawer = ctrlOpen || palOpen;

  const openControl = () => { setCtrlOpen(true); setPalOpen(false); };
  const openPalette = () => { setPalOpen(true); setCtrlOpen(false); };
  const closeAll = () => { setCtrlOpen(false); setPalOpen(false); };

  /**
   * On entry: load a deep-linked pattern if requested, otherwise start the
   * user on a default blank canvas straight away — no empty-state screen.
   * Runs once on mount; subsequent loads come from My Works / board changes.
   */
  useEffect(() => {
    // Explicit "new blank canvas" request — always start fresh, even if a
    // pattern is already loaded in the store.
    if (searchParams.get('new')) {
      newCanvas(DEFAULT_BOARD.w, DEFAULT_BOARD.h);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
      return;
    }
    const loadId = searchParams.get('load');
    if (loadId) {
      loadSavedPattern(loadId)
        .catch((err) => {
          console.warn('[designer] failed to load pattern from URL:', err.message);
          if (!usePatternStore.getState().pattern) newCanvas(DEFAULT_BOARD.w, DEFAULT_BOARD.h);
        })
        .finally(() => {
          searchParams.delete('load');
          setSearchParams(searchParams, { replace: true });
        });
      return;
    }
    // Fresh visit with nothing loaded → give them a canvas to draw on.
    if (!usePatternStore.getState().pattern) newCanvas(DEFAULT_BOARD.w, DEFAULT_BOARD.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Body-scroll lock while a drawer is open — avoids iOS rubber-banding.
  useEffect(() => {
    if (!anyDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [anyDrawer]);

  return (
    <div className="flex h-[calc(100dvh-56px)] sm:h-[calc(100dvh-64px)] overflow-hidden relative">
      {/* Left panel — canvas setup, My Works, new/save/export */}
      <ControlPanel isOpen={ctrlOpen} onClose={closeAll} />

      <main className="flex-1 flex flex-col relative min-h-0 min-w-0 bg-paper-warm">
        <div className="flex items-center gap-1 px-3 sm:px-4 py-2 border-b-[2px] border-ink/20 bg-paper">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="h-10 w-10 flex items-center justify-center rounded-[8px] text-ink-hint hover:text-ink hover:bg-butter/60 disabled:opacity-30 transition-colors"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="h-10 w-10 flex items-center justify-center rounded-[8px] text-ink-hint hover:text-ink hover:bg-butter/60 disabled:opacity-30 transition-colors"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          {/* Desktop-only Clear — mobile users get the same on the floating
              tool rail. Grouped with Undo/Redo here because they're all
              "history / state" actions, not drawing tools. */}
          <div className="hidden lg:block ml-2 pl-2 border-l border-ink/20">
            <button
              onClick={() => setClearConfirm(true)}
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-[8px] font-cute font-semibold text-xs text-ink-hint hover:text-ink hover:bg-butter/60 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
        {pattern && <PatternGrid />}
      </main>

      {/* Right panel — tools, colour chart (searchable), material usage */}
      <PaletteSidebar isOpen={palOpen} onClose={closeAll} />

      {/* ================ Mobile-only overlay + FABs ================ */}

      {/* Scrim */}
      <AnimatePresence>
        {anyDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm"
            onClick={closeAll}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Mobile Setup FAB (bottom-left). The Palette shortcut lives in the
          right-edge MobileToolRail instead — keeps all drawing affordances
          on the same side of the thumb. */}
      <div
        className={cn(
          'lg:hidden fixed bottom-5 left-5 z-30 transition-opacity duration-200',
          anyDrawer ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
      >
        <button
          onClick={openControl}
          className="h-14 w-14 rounded-full bg-cotton hover:bg-accent-hover text-ink border-[2px] border-ink flex items-center justify-center transition-colors"
          style={{ boxShadow: '3px 3px 0 0 var(--color-ink)' }}
          aria-label="Open setup panel"
        >
          <SlidersHorizontal className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile tool rail — drawing tools + palette shortcut. */}
      {pattern && !anyDrawer && (
        <MobileToolRail onOpenPalette={openPalette} onRequestClear={() => setClearConfirm(true)} />
      )}

      {/* Clear-canvas confirm — shared by the desktop toolbar and mobile rail */}
      <ConfirmDialog
        open={clearConfirm}
        title="Clear the whole pattern?"
        message="Every bead on the canvas will be removed. This cannot be undone."
        confirmLabel="Clear canvas"
        onConfirm={() => {
          clearGrid();
          setClearConfirm(false);
        }}
        onCancel={() => setClearConfirm(false)}
      />
    </div>
  );
}
