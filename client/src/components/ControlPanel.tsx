import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatternStore } from '../store/usePatternStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  X, Plus, Save, Check, RefreshCw, ChevronDown, ArrowRight, BookMarked,
  FileJson, FileSpreadsheet, FileImage, FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';

import { patternsApi, ApiError, type PatternSummary } from '../services/api';
import { PALETTES } from '../constants/palettes';
import { cn } from '../lib/utils';
import { loadSavedPattern } from '../utils/loadPattern';
import { renderExportCanvas } from '../utils/renderExport';
import { renderThumbnail } from '../utils/patternThumbnail';
import { ConfirmDialog } from './ConfirmDialog';

interface ControlPanelProps {
  /** Drawer-open state on mobile. Ignored on desktop (lg+) via CSS override. */
  isOpen?: boolean;
  onClose?: () => void;
}

const BOARD_OPTIONS = [
  { label: 'Standard 50×50', value: '50x50', w: 50, h: 50 },
  { label: 'Large 100×100', value: '100x100', w: 100, h: 100 },
];

/** Pending destructive action awaiting user confirmation. */
interface PendingConfirm {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => void;
}

/**
 * Left panel — canvas SETUP and lifecycle: board size, palette family,
 * recent My Works, and the new/save/export actions. Drawing tools and the
 * colour chart live in the right-hand PaletteSidebar.
 */
export const ControlPanel: React.FC<ControlPanelProps> = ({ isOpen = false, onClose }) => {
  const { pattern, newCanvas, currentPalette, setName } = usePatternStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const [boardSize, setBoardSize] = useState('50x50');
  const currentBoard = BOARD_OPTIONS.find(b => b.value === boardSize) || BOARD_OPTIONS[0];
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [exportProgress, setExportProgress] = useState<{ pct: number; label: string } | null>(null);

  // Keep the board selector in sync when a pattern arrives from elsewhere
  // (deep-link load, My Works click) with a different size.
  useEffect(() => {
    if (!pattern) return;
    const match = BOARD_OPTIONS.find(b => b.w === pattern.width && b.h === pattern.height);
    if (match) setBoardSize(match.value);
  }, [pattern?.id, pattern?.width, pattern?.height]);

  // ── Bead counts (drives "would we destroy work?" + CSV export) ────────

  const counts: Record<string, number> = {};
  if (pattern) {
    pattern.grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell.colorId) counts[cell.colorId] = (counts[cell.colorId] || 0) + 1;
      });
    });
  }
  const totalBeads = Object.values(counts).reduce((a, b) => a + b, 0);
  /** True when replacing the canvas would destroy visible work. */
  const hasDrawnContent = !!pattern && totalBeads > 0;

  // ── Canvas ─────────────────────────────────────────────────────────────

  /** Guard a canvas-replacing action behind a confirm when work would be lost. */
  const guarded = (cfg: Omit<PendingConfirm, 'action'>, action: () => void) => {
    if (hasDrawnContent) setConfirm({ ...cfg, action });
    else action();
  };

  const handleBoardChange = (value: string) => {
    setBoardSize(value);
    const next = BOARD_OPTIONS.find(b => b.value === value) || BOARD_OPTIONS[0];
    if (!pattern || (pattern.width === next.w && pattern.height === next.h)) return;
    guarded(
      {
        title: 'Switch board size?',
        message: `Switching to ${next.label} starts a fresh canvas — your current drawing will be lost.`,
        confirmLabel: 'Switch board',
      },
      () => newCanvas(next.w, next.h),
    );
  };

  const handleNewCanvas = () => {
    guarded(
      {
        title: 'Start a new canvas?',
        message: 'Your current drawing will be cleared. Save it to My Works first if you want to keep it.',
        confirmLabel: 'New canvas',
      },
      () => {
        setError(null);
        newCanvas(currentBoard.w, currentBoard.h);
        onClose?.();
      },
    );
  };

  // ── My Works ───────────────────────────────────────────────────────────

  const [works, setWorks] = useState<PatternSummary[] | null>(null);

  const refreshWorks = React.useCallback(async () => {
    if (!useAuthStore.getState().user) return;
    try {
      const { patterns } = await patternsApi.list();
      setWorks(patterns);
    } catch {
      setWorks(null); // quiet — section simply hides on failure
    }
  }, []);

  useEffect(() => {
    if (user) refreshWorks();
    else setWorks(null);
  }, [user?.id, refreshWorks]);

  const handleLoadWork = (work: PatternSummary) => {
    if (pattern?.id === work.id) return; // already open
    guarded(
      {
        title: `Load “${work.name}”?`,
        message: 'Your current drawing will be replaced by the saved pattern.',
        confirmLabel: 'Load pattern',
      },
      async () => {
        setError(null);
        try {
          await loadSavedPattern(work.id);
          onClose?.();
        } catch (err: any) {
          setError(err.message || 'Failed to load pattern');
        }
      },
    );
  };

  // ── Save ───────────────────────────────────────────────────────────────

  const savePattern = async () => {
    if (!pattern || saveState === 'saving') return;
    if (!useAuthStore.getState().user) {
      navigate(`/login?next=${encodeURIComponent('/designer')}`);
      return;
    }
    setSaveState('saving');
    setError(null);
    try {
      const thumbnail = renderThumbnail(pattern, currentPalette);
      if (pattern.id.startsWith('local-')) {
        const { pattern: saved } = await patternsApi.create({
          name: pattern.name || undefined, // empty → server auto-names "drew bead N"
          width: pattern.width,
          height: pattern.height,
          grid: pattern.grid,
          paletteId: pattern.paletteId,
          beadSize: pattern.beadSize,
          thumbnail,
          source: 'MANUAL',
        });
        // Swap in the server id without resetting history.
        usePatternStore.setState((s) =>
          s.pattern ? { pattern: { ...s.pattern, id: saved.id, name: saved.name } } : {},
        );
      } else {
        await patternsApi.patch(pattern.id, {
          grid: pattern.grid,
          name: pattern.name.trim() || undefined,
          thumbnail,
        });
      }
      setSaveState('saved');
      refreshWorks();
      setTimeout(() => setSaveState('idle'), 1600);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        navigate(`/login?next=${encodeURIComponent('/designer')}`);
      } else {
        setError(err.message || 'Failed to save pattern');
      }
      setSaveState('idle');
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────

  /** Yield a frame so the progress overlay paints before heavy work. */
  const nextFrame = () => new Promise((r) => setTimeout(r, 60));

  const runImageExport = async (kind: 'png' | 'pdf') => {
    if (!pattern || exportProgress) return;
    try {
      setExportProgress({ pct: 15, label: 'Rendering sheet…' });
      await nextFrame();
      const canvas = await renderExportCanvas(pattern, currentPalette);
      setExportProgress({ pct: 65, label: kind === 'pdf' ? 'Building PDF…' : 'Encoding PNG…' });
      await nextFrame();

      if (kind === 'png') {
        const link = document.createElement('a');
        link.download = `${pattern.name || 'pattern'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        // A4 landscape in mm: 297 × 210. Scale the rendered image to fit.
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgRatio = canvas.width / canvas.height;
        const pageRatio = pageW / pageH;
        let w = pageW;
        let h = pageH;
        if (imgRatio > pageRatio) h = pageW / imgRatio;
        else w = pageH * imgRatio;
        pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h);
        pdf.save(`${pattern.name || 'pattern'}.pdf`);
      }

      setExportProgress({ pct: 100, label: 'Done — check your downloads!' });
      setTimeout(() => setExportProgress(null), 1100);
    } catch (err: any) {
      setExportProgress(null);
      setError(err.message || 'Export failed');
    }
  };

  const exportCSV = () => {
    if (!pattern) return;
    let csv = 'Color Name,Code,Hex,Count\n';
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([id, count]) => {
        const color = currentPalette.colors.find(c => c.id === id);
        if (color) csv += `${color.name},${color.code},${color.hex},${count}\n`;
      });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bead-list.csv';
    a.click();
  };

  const exportJSON = () => {
    if (!pattern) return;
    const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pattern.json';
    a.click();
  };

  return (
    <>
      {/* Confirm dialog for destructive canvas actions */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => {
          confirm?.action();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />

      {/* Export progress overlay */}
      <AnimatePresence>
        {exportProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink/50 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
              className="w-full max-w-md bg-paper rounded-[20px] border-[3px] border-ink p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                {exportProgress.pct >= 100
                  ? <Check className="w-5 h-5 text-ink" />
                  : <RefreshCw className="w-5 h-5 text-ink animate-spin" />}
                <h3 className="font-cute font-semibold text-ink text-lg">Exporting pattern</h3>
              </div>
              <div className="flex justify-between items-baseline font-body text-[13px] text-ink">
                <span>{exportProgress.label}</span>
                <span className="font-pixel-mono text-ink-hint">{exportProgress.pct}%</span>
              </div>
              <div className="w-full h-3 bg-paper-warm rounded-full border-[2px] border-ink overflow-hidden">
                <div
                  className="h-full bg-mint transition-all duration-300 ease-out"
                  style={{ width: `${exportProgress.pct}%` }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'flex flex-col gap-5 bg-paper-warm overflow-y-auto',
          // Mobile: bottom drawer
          'fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] rounded-t-[24px] border-t-[3px] border-ink p-5 pt-3',
          'transition-transform duration-[220ms] ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
          // Desktop: static sidebar, ignores isOpen
          'lg:static lg:z-auto lg:w-[300px] lg:max-h-none lg:translate-y-0 lg:transition-none lg:shrink-0',
          'lg:rounded-none lg:border-t-0 lg:border-r-[2px] lg:border-ink/20 lg:p-5 lg:gap-5 lg:pt-5',
        )}
      >
        {/* Mobile drawer header — hidden on desktop */}
        <div className="lg:hidden flex items-center justify-between -mx-1">
          <h2 className="font-cute font-bold text-ink text-lg">Setup</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full text-ink-hint hover:text-ink hover:bg-butter/60"
            aria-label="Close setup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Header (desktop only — redundant with mobile drawer title) */}
        <div className="hidden lg:flex items-center gap-3">
          <img src="/logo-icon.svg" alt="Fusiey" className="h-9 w-9" />
          <div>
            <h1 className="font-cute font-bold text-ink text-base tracking-tight">Bead Designer</h1>
            <p className="font-body text-ink-hint text-[10px]">Draw, design & export</p>
          </div>
        </div>

        {/* ── Canvas settings ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <label className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Canvas</label>

          <div className="flex flex-col gap-1">
            <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em]">Name</span>
            <input
              type="text"
              value={pattern?.name ?? ''}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled pattern"
              maxLength={120}
              disabled={!pattern}
              aria-label="Pattern name"
              className="p-2.5 font-cute font-semibold text-sm border border-ink/30 rounded-[10px] bg-paper hover:border-ink focus:border-ink focus:bg-butter/40 outline-none text-ink placeholder:text-ink-hint placeholder:font-normal transition-colors disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em]">Board Size</span>
            <div className="relative">
              <button
                onClick={() => setIsBoardOpen(!isBoardOpen)}
                className="w-full p-2.5 font-cute font-semibold text-sm border border-ink/30 rounded-[10px] bg-paper outline-none transition-all flex items-center justify-between hover:border-ink hover:bg-butter/40"
              >
                <span className="text-ink">{currentBoard.label}</span>
                <ChevronDown className={cn('w-4 h-4 text-ink-hint transition-transform duration-200', isBoardOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {isBoardOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsBoardOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-full left-0 right-0 mt-2 bg-paper border-[2px] border-ink rounded-[12px] z-50 overflow-hidden"
                      style={{ boxShadow: '3px 3px 0 0 var(--color-ink)' }}
                    >
                      <div className="p-2 flex flex-col gap-1">
                        {BOARD_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              handleBoardChange(opt.value);
                              setIsBoardOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 p-3 rounded-[10px] transition-all text-left',
                              boardSize === opt.value
                                ? 'bg-butter text-ink border border-ink/30'
                                : 'border border-transparent hover:bg-butter/40 text-ink',
                            )}
                          >
                            <span className="font-cute font-bold text-sm">{opt.label}</span>
                            <span className="font-pixel-mono text-ink-hint text-[11px]">{opt.w}×{opt.h}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <p className="font-body text-ink-hint text-[10px]">
              Empty canvas switches instantly; drawn work asks first.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em]">Palette Family</span>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-2.5 font-cute font-semibold text-sm border border-ink/30 rounded-[10px] bg-paper outline-none transition-all flex items-center justify-between hover:border-ink hover:bg-butter/40"
              >
                <span className="text-ink">{currentPalette.name}</span>
                <ChevronDown className={cn('w-4 h-4 text-ink-hint transition-transform duration-200', isDropdownOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute top-full left-0 right-0 mt-2 bg-paper border-[2px] border-ink rounded-[12px] z-50 overflow-hidden"
                      style={{ boxShadow: '3px 3px 0 0 var(--color-ink)' }}
                    >
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                        {PALETTES.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              usePatternStore.getState().setPalette(p.id);
                              setIsDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full flex flex-col gap-1 p-3 rounded-[10px] transition-all text-left',
                              currentPalette.id === p.id
                                ? 'bg-butter text-ink border border-ink/30'
                                : 'border border-transparent hover:bg-butter/40 text-ink',
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-cute font-bold text-sm">{p.name}</span>
                              {currentPalette.id === p.id && <div className="w-1.5 h-1.5 rounded-full bg-ink" />}
                            </div>
                            <div className="flex gap-0.5">
                              {p.colors.slice(0, 8).map((c) => (
                                <div key={c.id} className="w-2 h-2 rounded-full border border-black/10" style={{ backgroundColor: c.hex }} />
                              ))}
                              {p.colors.length > 8 && <span className="text-[8px] opacity-60 ml-1">+{p.colors.length - 8}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── My Works (signed-in only) ─────────────────────────────────── */}
        {user && works && works.length > 0 && (
          <div className="flex flex-col gap-2 border-t-[2px] border-ink/20 pt-4">
            <div className="flex justify-between items-center">
              <label className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5" />
                My Works
              </label>
              <button
                onClick={() => navigate('/my-works')}
                className="inline-flex items-center gap-1 font-cute font-semibold text-[11px] text-ink-hint hover:text-ink transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {works.slice(0, 5).map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleLoadWork(w)}
                  className={cn(
                    'flex items-center justify-between p-2 bg-paper rounded-[10px] border text-left transition-colors',
                    pattern?.id === w.id
                      ? 'border-ink bg-butter/50'
                      : 'border-ink/15 hover:border-ink hover:bg-butter/30',
                  )}
                  title={pattern?.id === w.id ? 'Currently open' : `Load ${w.name}`}
                >
                  <span className="font-cute font-semibold text-ink text-xs truncate">{w.name}</span>
                  <span className="font-pixel-mono text-ink-hint text-[10px] shrink-0 ml-2">
                    {w.width}×{w.height}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-cotton/30 border border-ink/40 rounded-[10px] text-ink font-body text-xs font-semibold"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Actions: new / save / export, grouped at the bottom ───────── */}
        <div className="mt-auto flex flex-col gap-2.5 border-t-[2px] border-ink/20 pt-4">
          <label className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">Actions</label>

          <button
            onClick={handleNewCanvas}
            className="w-full h-11 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink flex items-center justify-center gap-2 transition-colors"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            <Plus className="w-4 h-4" />
            New Canvas ({currentBoard.w}×{currentBoard.h})
          </button>

          <button
            onClick={savePattern}
            disabled={!pattern || saveState === 'saving'}
            className="w-full h-11 bg-butter hover:bg-[#FEEB9A] text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            {saveState === 'saving' && <RefreshCw className="w-4 h-4 animate-spin" />}
            {saveState === 'saved' && <Check className="w-4 h-4" />}
            {saveState === 'idle' && <Save className="w-4 h-4" />}
            {saveState === 'saved' ? 'Saved!' : saveState === 'saving' ? 'Saving…' : 'Save to My Works'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: FileText, label: 'PDF', onClick: () => runImageExport('pdf') },
              { icon: FileImage, label: 'PNG', onClick: () => runImageExport('png') },
              { icon: FileJson, label: 'JSON', onClick: exportJSON },
              { icon: FileSpreadsheet, label: 'CSV', onClick: exportCSV },
            ].map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={!pattern}
                className="flex items-center justify-center gap-2 p-2.5 font-cute font-semibold text-xs text-ink bg-paper border border-ink/30 rounded-[10px] hover:border-ink hover:bg-butter/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
