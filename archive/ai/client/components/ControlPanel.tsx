import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Point } from 'react-easy-crop';
import { usePatternStore } from '../store/usePatternStore';
import { useAuthStore } from '../store/useAuthStore';
import { Upload, Wand2, RefreshCw, Download, FileJson, FileSpreadsheet, FileImage, FileText, ChevronDown, X, Trash2, Crop } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { generateImage, stylizeImage, patternsApi, ApiError } from '../services/api';
import { PALETTES } from '../constants/palettes';
import { cn } from '../lib/utils';
import { runEngineT, defaultAnalysis } from '../services/beadEngineV2';
import type { AnalysisV2 } from '../types';
import { CropStep } from './CropStep';
import { getCroppedImage, type CropArea } from '../utils/cropImage';
import { autoFitAspect } from '../utils/autoFitAspect';
import { ExportTemplate } from './ExportTemplate';
import { ENABLE_AI } from '../config/features';

interface ControlPanelProps {
  /** Drawer-open state on mobile. Ignored on desktop (lg+) via CSS override. */
  isOpen?: boolean;
  onClose?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isOpen = false, onClose }) => {
  const { pattern, setPattern, currentPalette } = usePatternStore();
  const navigate = useNavigate();
  const { setCredits } = useAuthStore();
  // `rawImage` — untouched upload. `image` — after the user's crop applied,
  // which is what the pipeline actually consumes. We keep both so "Re-crop"
  // can reopen the cropper against the untouched source.
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const BOARD_OPTIONS = [
    { label: 'Standard 50×50', value: '50x50', w: 50, h: 50 },
    { label: 'Large 100×100', value: '100x100', w: 100, h: 100 },
  ];
  const [boardSize, setBoardSize] = useState('50x50');
  const currentBoard = BOARD_OPTIONS.find(b => b.value === boardSize) || BOARD_OPTIONS[0];
  const width = currentBoard.w;
  const height = currentBoard.h;
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  // Pipeline progress while Generate is running. Null when idle. `pct` is
  // 0-100, `label` is the user-facing stage name. Advances at discrete
  // pipeline milestones (AI call / engine / finishing) plus a soft animation
  // during the slow Gemini call so the bar never visibly freezes.
  const [progress, setProgress] = useState<{ pct: number; label: string } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Last AI-stylised image — shown next to the source so the user can see
  // what Gemini did before it went into Engine T.
  const [stylizedPreview, setStylizedPreview] = useState<string | null>(null);
  const [previewIsFallback, setPreviewIsFallback] = useState(false);
  // AI cache — skips Gemini re-calls on subsequent Generate clicks for the
  // same source image. Cleared on new upload or "Clear AI result" button.
  const [cachedStylizedImage, setCachedStylizedImage] = useState<string | null>(null);
  const [cachedAnalysis, setCachedAnalysis] = useState<AnalysisV2 | null>(null);
  const [cachedSourceRef, setCachedSourceRef] = useState<string | null>(null);
  // Crop step state. `showCrop` opens the modal; `cropUi` remembers where
  // the frame was so Re-crop restores it instead of resetting to centre.
  const [showCrop, setShowCrop] = useState(false);
  const [cropUi, setCropUi] = useState<{ crop: Point; zoom: number } | null>(null);

  /** Cheap "same image?" signature — first & last 64 chars + length. */
  const sourceSignature = (src: string) =>
    `${src.length}::${src.slice(0, 64)}::${src.slice(-64)}`;

  const clearAiCache = () => {
    setCachedStylizedImage(null);
    setCachedAnalysis(null);
    setCachedSourceRef(null);
    setStylizedPreview(null);
    setPreviewIsFallback(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const src = reader.result as string;
      setRawImage(src);
      setCropUi(null);            // fresh upload → reset any stored crop frame
      setError(null);
      clearAiCache();              // new source → drop Gemini cache
      // Silent aspect-fit — letterbox/pillarbox to match the board ratio
      // with pure white padding so the downsampler hits uniform square
      // blocks instead of squashing a 9:16 photo into a square board.
      // No modal, no clicks. User can still click "Crop" afterwards to
      // refine framing manually.
      try {
        const fitted = await autoFitAspect(src, width / height);
        setImage(fitted);
      } catch (err) {
        console.error('[autoFitAspect] failed, using source as-is:', err);
        setImage(src);
      }
    };
    reader.readAsDataURL(file);
    // Allow selecting the same file again.
    e.target.value = '';
  };

  const handleCropApply = async (area: CropArea, ui: { crop: Point; zoom: number }) => {
    if (!rawImage) return;
    try {
      const cropped = await getCroppedImage(rawImage, area);
      setImage(cropped);
      setCropUi(ui);
      clearAiCache();            // reframed subject → any old AI result is stale
      setShowCrop(false);
    } catch (err) {
      console.error('[crop] failed to apply crop:', err);
      setError('Failed to apply crop. Please try again.');
      setShowCrop(false);
    }
  };

  const handleCropCancel = () => {
    setShowCrop(false);
    // First-time upload cancelled → discard so they can start over cleanly.
    if (!image) {
      setRawImage(null);
      setCropUi(null);
    }
  };

  const generatePattern = async () => {
    if (!ENABLE_AI) return;
    if (!image && !prompt) return;

    // Auth gate — generate is a paid action. Unauthenticated users get
    // redirected to /login with a return-to marker so they come back here.
    const authUser = useAuthStore.getState().user;
    if (!authUser) {
      navigate(`/login?next=${encodeURIComponent('/designer')}`);
      return;
    }
    if (authUser.generateCredits <= 0) {
      setError(
        authUser.communityPoints >= 10
          ? 'Out of AI generations. You have ' +
              authUser.communityPoints +
              ' community points — trade 10 for 1 generation in your profile.'
          : 'Out of AI generations. Publish a pattern to the community to earn more.',
      );
      return;
    }

    setIsGenerating(true);
    setProgress({ pct: 5, label: 'Preparing…' });
    setError(null);

    try {
      let sourceImage = image;

      // If the user gave only a prompt (no upload), generate an image first.
      if (!sourceImage && prompt) {
        try {
          setProgress({ pct: 10, label: 'Generating reference image…' });
          const { image: generatedImage } = await generateImage(prompt, currentPalette.colors);
          sourceImage = generatedImage;
          setImage(generatedImage);
        } catch (genError) {
          console.error('[ai] generateImage failed:', genError);
          throw new Error('Failed to generate image from prompt. Please upload an image instead.');
        }
      }

      if (!sourceImage) {
        throw new Error('Please upload an image or provide a prompt.');
      }

      // Agent S — Gemini image-edit + structured analysis. Cache-first: if
      // we already stylised this exact source, reuse the result so we don't
      // burn another ~15s + API call on the same image.
      const paletteHexes = currentPalette.colors.map((c) => c.hex);
      const sig = sourceSignature(sourceImage);
      let stylizeResult: {
        stylizedImageBase64: string;
        analysis: AnalysisV2;
        fallback: boolean;
      };

      if (cachedStylizedImage && cachedAnalysis && cachedSourceRef === sig) {
        console.log('[ai] stylize cache hit — skipping Gemini call');
        setProgress({ pct: 70, label: 'Using cached AI result…' });
        stylizeResult = {
          stylizedImageBase64: cachedStylizedImage,
          analysis: cachedAnalysis,
          fallback: false,
        };
      } else {
        try {
          setProgress({ pct: 20, label: 'AI stylizing (Gemini)…' });
          // Soft tick while Gemini is running. Capped at 65 so the bar
          // doesn't pretend to finish before the call returns. Increment
          // rate tuned to typical ~15s stylize; slower if it takes longer.
          const stylizeTimer = setInterval(() => {
            setProgress((p) =>
              p && p.pct < 65 ? { pct: p.pct + 1, label: p.label } : p,
            );
          }, 250);
          let res;
          try {
            res = await stylizeImage({
              imageBase64: sourceImage,
              canvasSize: width,
              userIntent: prompt || undefined,
              paletteHexes,
            });
          } finally {
            clearInterval(stylizeTimer);
          }
          stylizeResult = {
            stylizedImageBase64: res.stylizedImageBase64,
            analysis: res.analysis,
            fallback: res.fallback,
          };
          if (res.fallback) console.warn('[ai] stylize fell back to original image');
          // Cache only successful (non-fallback) results — a fallback is
          // the original image and has no semantic analysis, so re-trying
          // next click is cheap and potentially useful.
          if (!res.fallback) {
            setCachedStylizedImage(res.stylizedImageBase64);
            setCachedAnalysis(res.analysis);
            setCachedSourceRef(sig);
          }
        } catch (stylizeError) {
          console.error('[ai] stylize endpoint failed:', stylizeError);
          stylizeResult = {
            stylizedImageBase64: sourceImage,
            analysis: defaultAnalysis(currentPalette.colors, prompt || 'pattern'),
            fallback: true,
          };
        }
      }

      // Surface the AI output for side-by-side viewing in the Source area.
      setStylizedPreview(stylizeResult.stylizedImageBase64);
      setPreviewIsFallback(stylizeResult.fallback);
      setProgress({ pct: 75, label: 'Mapping to beads…' });

      // Engine T — deterministic. Fed by either real or default analysis.
      const { grid, stats } = await runEngineT({
        imageSrc: stylizeResult.stylizedImageBase64,
        width,
        height,
        palette: currentPalette.colors,
        analysis: stylizeResult.analysis,
        isAiStylized: !stylizeResult.fallback,
      });
      console.log('[beadEngineV2]', {
        fallback: stylizeResult.fallback,
        isAiStylized: !stylizeResult.fallback,
        stats,
      });
      setProgress({ pct: 90, label: 'Saving to My Works…' });

      // Persist to the server BEFORE pushing the pattern into the store so
      // the store's id matches the DB id — makes auto-save on subsequent
      // edits use the correct record.
      let savedId: string;
      try {
        const { pattern: saved } = await patternsApi.create({
          name: prompt || undefined, // empty → server auto-names "drew bead N"
          width,
          height,
          grid,
          paletteId: currentPalette.id,
          beadSize: 5,
          thumbnail: undefined, // TODO Phase 2: canvas.toDataURL of the grid
          source: 'AI',
          aiImageData: stylizeResult.stylizedImageBase64,
          stats,
        });
        savedId = saved.id;
        // The server-side credit deduction already happened inside AI
        // endpoints; reflect the latest value from the API response if we
        // captured it earlier. Simpler: refetch me.
        useAuthStore.getState().fetchMe();
      } catch (saveErr: any) {
        // Non-fatal — the pattern rendered fine; we just didn't persist.
        console.warn('[patterns] save failed:', saveErr.message);
        savedId = Date.now().toString();
      }

      setPattern({
        id: savedId,
        name: prompt || 'New Pattern',
        width,
        height,
        grid,
        paletteId: currentPalette.id,
        beadSize: 5,
      });
      setProgress({ pct: 100, label: 'Done!' });
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onClose?.();
    } catch (error: any) {
      console.error('Error:', error);
      // 402 = out of credits server-side (race condition / stale client state).
      if (error instanceof ApiError && error.status === 402) {
        setError('Out of AI generations. Publish a pattern or trade 10 community points for another.');
        // Resync the user so the badge updates.
        useAuthStore.getState().fetchMe();
      } else if (error instanceof ApiError && error.status === 401) {
        setError('Please sign in again.');
        navigate('/login');
      } else {
        setError(error.message || 'An unexpected error occurred');
      }
    } finally {
      setIsGenerating(false);
      // Let the "Done!" state linger briefly so the user sees the bar hit
      // 100% before it disappears. On error the bar clears immediately.
      setTimeout(() => setProgress(null), 600);
    }
  };

  /** Snapshot the hidden ExportTemplate into a canvas. Shared by PDF/PNG. */
  const captureTemplate = async (): Promise<HTMLCanvasElement | null> => {
    const el = document.getElementById('export-template');
    if (!el) return null;
    return html2canvas(el, {
      backgroundColor: '#FDFBF5',
      // 2× scale for crisp print — 1400×990 logical → 2800×1980 PNG.
      scale: 2,
      useCORS: true,
      // Tell html2canvas the element's box dimensions up front so it doesn't
      // try to read layout from the off-screen copy.
      width: el.offsetWidth,
      height: el.offsetHeight,
      windowWidth: el.offsetWidth,
      windowHeight: el.offsetHeight,
    });
  };

  const exportPNG = async () => {
    if (!pattern) return;
    const canvas = await captureTemplate();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${pattern.name || 'pattern'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportPDF = async () => {
    if (!pattern) return;
    const canvas = await captureTemplate();
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    // A4 landscape in mm: 297 × 210. Scale the captured image to fit.
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgRatio = canvas.width / canvas.height;
    const pageRatio = pageW / pageH;
    let w = pageW;
    let h = pageH;
    if (imgRatio > pageRatio) h = pageW / imgRatio;
    else w = pageH * imgRatio;
    const offsetX = (pageW - w) / 2;
    const offsetY = (pageH - h) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, offsetY, w, h);
    pdf.save(`${pattern.name || 'pattern'}.pdf`);
  };

  const exportCSV = () => {
    if (!pattern) return;
    const counts: Record<string, number> = {};
    pattern.grid.forEach(row => {
      row.forEach(cell => {
        if (cell.colorId) counts[cell.colorId] = (counts[cell.colorId] || 0) + 1;
      });
    });

    let csv = 'Color Name,Code,Hex,Count\n';
    Object.entries(counts).forEach(([id, count]) => {
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
      {/* Full-screen blocking progress overlay — shown while a Generate run
          is in flight. Blocks all interaction until pipeline completes (or
          errors out, which clears progress immediately via the finally
          block). Advances at discrete milestones plus a soft tick during
          the slow Gemini call. */}
      <AnimatePresence>
        {progress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6"
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
                <RefreshCw className="w-5 h-5 text-ink animate-spin" />
                <h3 className="font-cute font-semibold text-ink text-lg">
                  Generating pattern
                </h3>
              </div>
              <div className="flex justify-between items-baseline font-body text-[13px] text-ink">
                <span>{progress.label}</span>
                <span className="font-pixel-mono text-ink-hint">{progress.pct}%</span>
              </div>
              <div className="w-full h-3 bg-paper-warm rounded-full border-[2px] border-ink overflow-hidden">
                <div
                  className="h-full bg-cotton transition-all duration-300 ease-out"
                  style={{ width: `${progress.pct}%` }}
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
        'lg:static lg:z-auto lg:w-[380px] lg:max-h-none lg:translate-y-0 lg:transition-none',
        'lg:rounded-none lg:border-t-0 lg:border-r-[2px] lg:border-ink/20 lg:p-6 lg:gap-6 lg:pt-6',
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
          <p className="font-body text-ink-hint text-[10px]">{ENABLE_AI ? 'AI-powered pattern generator' : 'Draw or import patterns'}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Source */}
        <div className="flex flex-col gap-3">
          {ENABLE_AI && (
              <>
                <label className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">1. Source</label>
                <div className="flex flex-col gap-3">
                  <div className="relative group">
                    <input
                      type="file"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept="image/*"
                    />
                    <div className="flex flex-col items-center justify-center gap-3 p-6 border-[2px] border-dashed border-ink/30 rounded-[16px] bg-paper group-hover:border-ink group-hover:bg-butter transition-all">
                      {image ? (
                        <img src={image} className="w-20 h-20 object-cover rounded-[10px] border-[2px] border-ink" />
                      ) : (
                        <Upload className="w-7 h-7 text-ink-hint group-hover:text-ink transition-colors" />
                      )}
                      <span className="font-cute font-semibold text-ink-hint group-hover:text-ink text-xs uppercase tracking-[0.08em] transition-colors">
                        {image ? 'Replace Photo' : 'Upload Photo'}
                      </span>
                    </div>
                  </div>

                  {rawImage && image && (
                    <button
                      type="button"
                      onClick={() => setShowCrop(true)}
                      className="self-start -mt-1 inline-flex items-center gap-1.5 px-3 h-7 bg-butter/60 hover:bg-butter text-ink font-body text-[11px] font-semibold rounded-pill border border-ink/30 hover:border-ink transition-colors"
                      title="Optional — adjust framing / zoom before generation"
                    >
                      <Crop className="w-3 h-3" />
                      Crop
                    </button>
                  )}

                  {stylizedPreview && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em]">Original</span>
                        <div className="w-full aspect-square bg-paper border border-ink/30 rounded-[10px] overflow-hidden flex items-center justify-center">
                          {image && <img src={image} alt="original" className="w-full h-full object-contain" />}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="font-cute font-semibold text-ink text-[10px] uppercase tracking-[0.08em] flex items-center gap-1">
                          AI Styled {previewIsFallback && <span className="font-pixel-mono text-[10px] text-ink-hint normal-case tracking-normal">(fallback)</span>}
                        </span>
                        <div className="w-full aspect-square bg-paper border-[2px] border-ink rounded-[10px] overflow-hidden flex items-center justify-center">
                          <img src={stylizedPreview} alt="AI styled" className="w-full h-full object-contain" />
                        </div>
                      </div>
                    </div>
                  )}

                  <textarea
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      setError(null);
                    }}
                    placeholder="Describe design (e.g., 'Cute orange cat')"
                    className="w-full min-h-[90px] p-3.5 font-body text-sm text-ink bg-paper border-[2px] border-ink rounded-[12px] placeholder:text-ink-hint resize-none outline-none focus:bg-butter transition-colors"
                    style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
                  />
                </div>
              </>
            )}
        </div>

        {/* Configuration */}
        <div className="flex flex-col gap-3">
          <label className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">2. Configuration</label>

          {ENABLE_AI && (
            <div className="flex flex-col gap-2">
              <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em]">Palette Family</span>
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-3 font-cute font-semibold text-sm border border-ink/30 rounded-[10px] bg-paper outline-none transition-all flex items-center justify-between hover:border-ink hover:bg-butter/40"
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

              <div className="flex flex-col gap-2 p-3 bg-butter/60 rounded-[12px] border border-ink/20 mt-1">
                <div className="flex items-center justify-between">
                  <span className="font-cute font-semibold text-ink text-[10px] uppercase tracking-[0.08em]">Palette Preview</span>
                  <span className="font-pixel-mono text-ink text-sm leading-none">{currentPalette.colors.length} colors</span>
                </div>
                <div className="flex gap-1 overflow-hidden">
                  {currentPalette.colors.slice(0, 10).map((c) => (
                    <div
                      key={c.id}
                      className="w-3.5 h-3.5 rounded-full border border-ink/40 flex-shrink-0"
                      style={{
                        backgroundColor: c.hex,
                        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.55)',
                      }}
                    />
                  ))}
                  {currentPalette.colors.length > 10 && (
                    <div className="font-pixel-mono text-ink text-xs flex items-center ml-1">+{currentPalette.colors.length - 10}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 mt-2">
            <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em]">Board Size</span>
            <select
              value={boardSize}
              onChange={(e) => setBoardSize(e.target.value)}
              className="p-2.5 font-cute font-semibold text-sm border border-ink/30 rounded-[10px] bg-paper hover:border-ink focus:border-ink focus:bg-butter/40 outline-none text-ink transition-colors"
            >
              {BOARD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Style / Colour Merge / Auto-remove-background all removed —
              v1 algorithm retired. Tuning knobs (or smarter auto-policy) will
              return with the v2 AI pipeline when it ships. */}
        </div>

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

        {/* Generate Button — primary CTA for the panel, only shown when AI is enabled. */}
        {ENABLE_AI && (
          <button
            onClick={generatePattern}
            disabled={isGenerating || (!image && !prompt)}
            className="w-full h-12 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold text-base rounded-pill border-[2px] border-ink flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cotton"
            style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
          >
            {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {isGenerating ? 'Processing…' : 'Generate Pattern'}
          </button>
        )}

        {/* Clear AI result — only visible when a cached Gemini result exists. */}
        {ENABLE_AI && cachedStylizedImage && !isGenerating && (
          <button
            onClick={clearAiCache}
            className="w-full h-9 bg-transparent hover:bg-butter/40 text-ink-soft hover:text-ink font-body text-xs rounded-pill border border-ink/30 hover:border-ink flex items-center justify-center gap-1.5 transition-colors -mt-2"
            title="Discard cached AI result. Next Generate will call Gemini again."
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear AI result
          </button>
        )}
      </div>

      {/* Crop step — modal overlay. Rendered regardless of drawer state so
          the cropper can appear over everything (including on desktop where
          the ControlPanel is a sidebar). */}
      {showCrop && rawImage && (
        <CropStep
          imageSrc={rawImage}
          aspect={width / height}
          initial={cropUi ?? undefined}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      )}

      {/* Off-screen export template — always mounted while a pattern exists
          so html2canvas can capture it synchronously when the user hits
          PDF/PNG. Positioned at left:-99999px, never seen on-screen. */}
      {pattern && (
        <ExportTemplate
          pattern={pattern}
          palette={currentPalette}
          stylizedImage={stylizedPreview}
        />
      )}

      {/* Export */}
      <div className="mt-auto flex flex-col gap-3 border-t-[2px] border-ink/20 pt-6">
        <label className="font-body font-extrabold text-ink text-[10px] uppercase tracking-[0.08em]">3. Export</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: FileText, label: 'PDF', onClick: exportPDF },
            { icon: FileImage, label: 'PNG', onClick: exportPNG },
            { icon: FileJson, label: 'JSON', onClick: exportJSON },
            { icon: FileSpreadsheet, label: 'CSV', onClick: exportCSV },
          ].map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex items-center justify-center gap-2 p-2.5 font-cute font-semibold text-xs text-ink bg-paper border border-ink/30 rounded-[10px] hover:border-ink hover:bg-butter/40 transition-all"
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
