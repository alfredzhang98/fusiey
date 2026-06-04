import { useState, useEffect } from 'react';
import { Undo2, Redo2, Trash2, SlidersHorizontal, Upload, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ControlPanel } from '../components/ControlPanel';
import { PatternGrid } from '../components/PatternGrid';
import { PaletteSidebar } from '../components/PaletteSidebar';
import { MobileToolRail } from '../components/MobileToolRail';
import { usePatternStore } from '../store/usePatternStore';
import { cn } from '../lib/utils';

/**
 * Empty state shown before a pattern exists. Gives a clear next step:
 *   - Mobile: big button that opens the Setup drawer.
 *   - Desktop: arrow text nudging toward the always-visible Setup panel.
 */
function EmptyCanvas({ onOpenSetup }: { onOpenSetup: () => void }) {
  const beads = ['bg-cotton', 'bg-butter', 'bg-mint', 'bg-sky-candy', 'bg-lilac'];
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-paper-warm">
      <div className="max-w-md w-full text-center">
        {/* Bead row — subtle stagger float */}
        <div className="flex justify-center gap-2 mb-6" aria-hidden="true">
          {beads.map((bg, i) => (
            <motion.div
              key={bg}
              className={cn('fsy-bead w-10 h-10 border-[2px] border-ink', bg)}
              style={{ boxShadow: 'inset 1.5px 1.5px 0 rgba(255,255,255,0.55)' }}
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: i * 0.12,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        <h2 className="font-cute font-bold text-ink text-2xl sm:text-3xl mb-3">
          Start your pattern
        </h2>
        <p className="font-body text-ink-soft text-sm sm:text-base leading-relaxed mb-5">
          Upload a photo, or describe what you'd like to make — we'll turn it
          into a bead design in seconds.
        </p>

        {/* Two ways in — descriptive line, not clickable buttons. */}
        <div className="flex items-center justify-center gap-3 mb-5 font-body text-ink-soft text-sm">
          <span className="inline-flex items-center gap-1.5"><Upload className="w-4 h-4" /> upload a photo</span>
          <span className="text-ink-hint">or</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> describe it</span>
        </div>

        {/* Example prompt chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {['Cute orange cat', 'Pink strawberry', 'Little dinosaur'].map((p) => (
            <span key={p} className="fsy-tag">{p}</span>
          ))}
        </div>

        {/* Mobile CTA (desktop has Setup panel visible to the left) */}
        <button
          type="button"
          onClick={onOpenSetup}
          className="lg:hidden inline-flex items-center gap-2 h-12 px-6 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold rounded-pill border-[2px] border-ink transition-colors"
          style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
        >
          <SlidersHorizontal className="w-5 h-5" />
          Open Setup
        </button>

        {/* Desktop nudge pointing at Setup panel */}
        <p className="hidden lg:block font-body text-ink-hint text-xs mt-2">
          ← Use the Setup panel to begin
        </p>
      </div>
    </div>
  );
}

export function DesignerPage() {
  const { pattern, undo, redo, historyIndex, history, clearGrid } = usePatternStore();

  /**
   * Mobile drawer state.
   * Desktop (lg+) renders both panels statically; these flags are ignored
   * there thanks to `lg:translate-y-0` overrides inside each panel.
   * Only one drawer open at a time.
   */
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const anyDrawer = ctrlOpen || palOpen;

  const openControl = () => { setCtrlOpen(true); setPalOpen(false); };
  const openPalette = () => { setPalOpen(true); setCtrlOpen(false); };
  const closeAll = () => { setCtrlOpen(false); setPalOpen(false); };

  // Body-scroll lock while a drawer is open — avoids iOS rubber-banding.
  useEffect(() => {
    if (!anyDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [anyDrawer]);

  return (
    <div className="flex h-[calc(100dvh-56px)] sm:h-[calc(100dvh-64px)] overflow-hidden relative">
      {/* Left panel (desktop) / bottom drawer (mobile) */}
      <ControlPanel isOpen={ctrlOpen} onClose={closeAll} />

      <main className="flex-1 flex flex-col relative min-h-0 min-w-0 bg-paper-warm">
        {pattern ? (
          <>
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
              {/* Desktop-only Clear — mobile users get the same on the
                  floating tool rail. Grouped with Undo/Redo here because
                  they're all "history / state" actions, not drawing tools. */}
              <div className="hidden lg:block ml-2 pl-2 border-l border-ink/20">
                <button
                  onClick={() => {
                    if (window.confirm('Clear the whole pattern? This cannot be undone.')) {
                      clearGrid();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 h-10 px-3 rounded-[8px] font-cute font-semibold text-xs text-ink-hint hover:text-ink hover:bg-butter/60 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear
                </button>
              </div>
            </div>
            <PatternGrid />
          </>
        ) : (
          <EmptyCanvas onOpenSetup={openControl} />
        )}
      </main>

      {/* Right panel (desktop) / bottom drawer (mobile) */}
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

      {/* Mobile tool rail — only visible when a pattern exists (no point
          before that; empty-canvas CTA handles onboarding). */}
      {pattern && !anyDrawer && <MobileToolRail onOpenPalette={openPalette} />}
    </div>
  );
}
