/**
 * Client-side image compression — shrink admin uploads to under ~1MB before
 * sending, so big source photos don't waste upload bandwidth/storage.
 *
 * Downscales to a max dimension, re-encodes as WebP (small + keeps alpha),
 * dropping quality (then resolution) until it fits the byte budget. Falls back
 * to the original file for non-images / unsupported cases.
 */

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(
  file: File,
  { maxBytes = 1_000_000, maxDim = 2000 }: { maxBytes?: number; maxDim?: number } = {},
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file; // can't decode — let the server handle it
  }

  let w = bmp.width;
  let h = bmp.height;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const drawAt = (cw: number, ch: number): HTMLCanvasElement | null => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, cw, ch);
    return c;
  };

  let canvas = drawAt(w, h);
  if (!canvas) return file;

  const type = 'image/webp';
  let quality = 0.9;
  let blob = await toBlob(canvas, type, quality);

  // 1) drop quality
  while (blob && blob.size > maxBytes && quality > 0.45) {
    quality -= 0.1;
    blob = await toBlob(canvas, type, quality);
  }
  // 2) still too big → downscale and retry
  let guard = 0;
  while (blob && blob.size > maxBytes && Math.max(w, h) > 600 && guard < 6) {
    w = Math.round(w * 0.8);
    h = Math.round(h * 0.8);
    canvas = drawAt(w, h);
    if (!canvas) break;
    quality = 0.85;
    blob = await toBlob(canvas, type, quality);
    guard++;
  }

  bmp.close?.();
  if (!blob || blob.size >= file.size) return file; // never make it bigger
  const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], name, { type });
}
