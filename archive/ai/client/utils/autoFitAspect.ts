/**
 * Silent aspect-fit: pad an image with white to match a target aspect ratio.
 *
 * Why this exists: `pixelate.ts` samples `bw = origW/gridW, bh = origH/gridH`
 * independently per axis. When source aspect ≠ grid aspect, each bead ends
 * up representing a non-square source area, yet is rendered as a 1:1 square
 * bead — visually squashing the picture. Letterboxing (or pillarboxing)
 * with white padding keeps source aspect == output aspect == grid aspect,
 * so the downsampler hits uniform square blocks.
 *
 * Guarantees:
 *   - Never stretches: the source is drawn with equal x/y scale.
 *   - Never crops: the entire source image is preserved inside the padded
 *     canvas (padding grows outward, never inward).
 *   - White padding only (`#FFFFFF`), which downstream background detection
 *     correctly flags as empty × pegs.
 *   - Zero-cost pass-through: if source aspect already matches target
 *     (within 2%), returns the original base64 unchanged.
 */

const TARGET_EDGE = 1024;
const ASPECT_TOLERANCE = 0.02; // ±2% is close enough to skip the padding pass

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for aspect fit'));
    img.src = src;
  });
}

export async function autoFitAspect(
  imageSrc: string,
  targetAspect: number, // gridW / gridH
): Promise<string> {
  const img = await loadImage(imageSrc);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (sw === 0 || sh === 0) return imageSrc;

  const sourceAspect = sw / sh;
  if (Math.abs(sourceAspect / targetAspect - 1) <= ASPECT_TOLERANCE) {
    // Already matches — no need to re-encode.
    return imageSrc;
  }

  // Output dims: the longer output axis is TARGET_EDGE, the shorter follows
  // from the target aspect. The source then fits wholly inside, padded by
  // white on the two sides of the shorter source axis.
  let outW: number;
  let outH: number;
  if (targetAspect >= 1) {
    outW = TARGET_EDGE;
    outH = Math.round(TARGET_EDGE / targetAspect);
  } else {
    outH = TARGET_EDGE;
    outW = Math.round(TARGET_EDGE * targetAspect);
  }

  const scale = Math.min(outW / sw, outH / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, 0, 0, sw, sh, dx, dy, drawW, drawH);

  return canvas.toDataURL('image/png');
}
