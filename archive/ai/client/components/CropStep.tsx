import React, { useCallback, useState, useEffect } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, Check } from 'lucide-react';

import type { CropArea } from '../utils/cropImage';

interface CropStepProps {
  /** Source image (unchanged raw upload) as base64 or URL. */
  imageSrc: string;
  /** Grid aspect = gridW / gridH. 50×50 → 1, future 2:3 boards → 0.667. */
  aspect: number;
  /** Optional initial crop position/zoom (restore on re-crop). */
  initial?: { crop: Point; zoom: number };
  onApply: (croppedAreaPixels: CropArea, ui: { crop: Point; zoom: number }) => void;
  onCancel: () => void;
}

/**
 * Modal crop step — user reframes their photo before it hits the pipeline.
 *
 * Why this exists: Gemini doesn't reliably fill the canvas with the subject,
 * so eyes end up ≤ 1 cell wide and disappear in the bead grid. Pre-cropping
 * guarantees the subject occupies most of the frame — eyes then become 2-4
 * cells and survive the downsample.
 *
 * Aspect is LOCKED to the target board ratio; the user cannot change it.
 * `restrictPosition={false}` lets the crop frame extend past image edges —
 * those areas become white padding (handled in cropImage.ts), NEVER stretch.
 */
export const CropStep: React.FC<CropStepProps> = ({
  imageSrc,
  aspect,
  initial,
  onApply,
  onCancel,
}) => {
  const [crop, setCrop] = useState<Point>(initial?.crop ?? { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setAreaPixels(pixels);
  }, []);

  // Close on ESC for desktop users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleApply = () => {
    if (areaPixels) onApply(areaPixels, { crop, zoom });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div
        className="relative w-full lg:max-w-[620px] bg-paper-warm border-t-[3px] lg:border-[3px] border-ink rounded-t-[20px] lg:rounded-[20px] overflow-hidden flex flex-col max-h-[92dvh]"
        style={{ boxShadow: '4px 4px 0 0 var(--color-ink)' }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b-[2px] border-ink/15">
          <div>
            <h3 className="font-cute font-bold text-ink text-base">Position your subject</h3>
            <p className="font-body text-ink-hint text-[11px] leading-tight mt-0.5">
              Frame is locked to your board ratio — empty space becomes white padding.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="h-8 w-8 flex items-center justify-center rounded-full text-ink-hint hover:text-ink hover:bg-butter/60 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="relative w-full bg-paper"
          style={{ height: 'min(60dvh, 420px)' }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            restrictPosition={false}
            showGrid
            zoomSpeed={0.5}
            style={{
              containerStyle: { background: '#FDFBF5' },
              cropAreaStyle: { color: 'rgba(45, 45, 45, 0.6)' },
            }}
          />
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-cute font-semibold text-ink-hint text-[10px] uppercase tracking-[0.08em] w-10">
              Zoom
            </span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-ink"
            />
            <span className="font-pixel-mono text-ink text-xs w-10 text-right">
              {zoom.toFixed(1)}×
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-10 bg-paper hover:bg-butter/40 text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!areaPixels}
              className="flex-1 h-10 bg-cotton hover:bg-accent-hover text-ink font-cute font-semibold text-sm rounded-pill border-[2px] border-ink flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: '2px 2px 0 0 var(--color-ink)' }}
            >
              <Check className="w-4 h-4" /> Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
