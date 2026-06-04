/**
 * Apply a rectangular crop to a base64 image and return a new base64 PNG.
 *
 * Critical guarantee — **no stretching**:
 *   srcW / srcH === dstW / dstH (both equal the crop area's aspect ratio)
 *   → drawImage scales uniformly, preserving pixel proportions.
 *
 * If the crop area extends past the source image bounds (allowed by
 * react-easy-crop's `restrictPosition={false}`), out-of-bounds regions
 * are filled with pure white (#FFFFFF) — never black, never stretched.
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_OUTPUT_EDGE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load source image for crop'));
    img.src = src;
  });
}

export async function getCroppedImage(
  imageSrc: string,
  crop: CropArea,
): Promise<string> {
  const image = await loadImage(imageSrc);

  // Scale so the longer side is MAX_OUTPUT_EDGE. Uniform, no stretch.
  const scale = MAX_OUTPUT_EDGE / Math.max(crop.width, crop.height);
  const outW = Math.round(crop.width * scale);
  const outH = Math.round(crop.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Pure white padding for any out-of-bounds region.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, outW, outH);

  // Clip the crop area to the source image bounds.
  const srcX0 = Math.max(0, crop.x);
  const srcY0 = Math.max(0, crop.y);
  const srcX1 = Math.min(image.naturalWidth, crop.x + crop.width);
  const srcY1 = Math.min(image.naturalHeight, crop.y + crop.height);
  const srcW = srcX1 - srcX0;
  const srcH = srcY1 - srcY0;

  if (srcW > 0 && srcH > 0) {
    // Where in the output canvas the clipped source lands, scaled by the
    // same `scale` factor used above → aspect preserved, no stretching.
    const dstX = (srcX0 - crop.x) * scale;
    const dstY = (srcY0 - crop.y) * scale;
    const dstW = srcW * scale;
    const dstH = srcH * scale;
    ctx.drawImage(image, srcX0, srcY0, srcW, srcH, dstX, dstY, dstW, dstH);
  }

  return canvas.toDataURL('image/png');
}
