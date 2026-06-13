/**
 * Media library — admin-managed product images on local disk.
 *
 * Structured (non-flat) store: category → product folder (code + name) → image
 * assets. Files are written under UPLOAD_DIR and served at /uploads/...; rows in
 * MediaFolder/MediaAsset hold metadata + the public relative URL.
 *
 *   GET    /api/media/folders?category=        list folders (+ asset counts)
 *   POST   /api/media/folders                  { category, code, name }
 *   DELETE /api/media/folders/:id              delete folder (cascade assets)
 *   GET    /api/media/folders/:id/assets       list assets
 *   POST   /api/media/folders/:id/assets       multipart batch upload (<=9 imgs)
 *   DELETE /api/media/assets/:id               delete one asset (+ file)
 *
 * All endpoints require ADMIN / SUPERADMIN.
 */

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  productFolderDir, ensureDir, safeFilename, publicUrl, absFromPublicUrl,
} from '../lib/storage.js';
import { getWatermarkConfig } from '../lib/siteConfig.js';

export const mediaRoutes = Router();

// ── Watermark — admin-configurable (toggle / opacity / style) ───────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WATERMARK_SVG = path.resolve(__dirname, '../../../assets/logos/fusiey_main2.svg');
let logoPromise: Promise<Buffer | null> | null = null;

/** Rasterise the logo once at full opacity (cached for the process). */
function logoBase(): Promise<Buffer | null> {
  if (logoPromise) return logoPromise;
  logoPromise = (async () => {
    if (!fs.existsSync(WATERMARK_SVG)) return null;
    return sharp(WATERMARK_SVG, { density: 200 }).resize(700, 700, { fit: 'inside' }).ensureAlpha().png().toBuffer();
  })().catch(() => null);
  return logoPromise;
}

/** Fade the logo to a given opacity (0–1) via a tiled dest-in white. */
function fadeLogo(logo: Buffer, opacity: number): Promise<Buffer> {
  const a = Math.round(255 * opacity);
  return sharp(logo)
    .composite([{ input: Buffer.from([255, 255, 255, a]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/** Composite the brand watermark onto an image per the admin's settings. */
async function applyWatermark(imageBuf: Buffer): Promise<Buffer> {
  try {
    const cfg = await getWatermarkConfig();
    if (!cfg.enabled) return imageBuf;
    const logo = await logoBase();
    if (!logo) return imageBuf;
    const meta = await sharp(imageBuf).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    if (!w || !h) return imageBuf;
    const minSide = Math.min(w, h);
    const faded = await fadeLogo(logo, cfg.opacity);

    if (cfg.style === 'corner') {
      const wm = await sharp(faded).resize(Math.round(minSide * 0.28)).png().toBuffer();
      const wmMeta = await sharp(wm).metadata();
      const m = Math.round(minSide * 0.04);
      return await sharp(imageBuf).composite([{
        input: wm,
        left: Math.max(0, w - (wmMeta.width || 0) - m),
        top: Math.max(0, h - (wmMeta.height || 0) - m),
      }]).toBuffer();
    }

    if (cfg.style === 'tiled') {
      const tile = await sharp(faded).resize(Math.round(minSide * 0.22)).png().toBuffer();
      return await sharp(imageBuf).composite([{ input: tile, tile: true }]).toBuffer();
    }

    // diagonal (default): size by the shorter side so the rotated bbox fits.
    const wm = await sharp(faded)
      .resize(Math.round(minSide * 0.6))
      .rotate(-30, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return await sharp(imageBuf).composite([{ input: wm, gravity: 'center' }]).toBuffer();
  } catch {
    return imageBuf; // never fail an upload over a watermark
  }
}
mediaRoutes.use(requireAuth, requireRole('ADMIN', 'SUPERADMIN'));

// The 5 canonical product categories (mirror of client productCategories.ts).
export const CATEGORY_KEYS = ['kit-pattern', 'pattern', 'beads', 'refill', 'tool'] as const;

const MAX_FILES = 9;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: MAX_FILES },
});

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

// ── GET /folders ──────────────────────────────────────────────────────────
mediaRoutes.get('/folders', async (req, res) => {
  const category = req.query.category as string | undefined;
  const where: any = {};
  if (category && CATEGORY_KEYS.includes(category as any)) where.category = category;
  const folders = await prisma.mediaFolder.findMany({
    where,
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { assets: true } } },
  });
  return res.json({
    folders: folders.map((f) => ({
      id: f.id, category: f.category, code: f.code, name: f.name,
      assetCount: f._count.assets, createdAt: f.createdAt,
    })),
  });
});

// ── POST /folders ─────────────────────────────────────────────────────────
const folderSchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
});

mediaRoutes.post('/folders', async (req, res) => {
  const parsed = folderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { category, code, name } = parsed.data;
  try {
    const folder = await prisma.mediaFolder.create({ data: { category, code, name } });
    ensureDir(productFolderDir(category, code));
    return res.status(201).json({ folder });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'A folder with this category + code already exists.' });
    }
    throw err;
  }
});

// ── DELETE /folders/:id ─────────────────────────────────────────────────────
mediaRoutes.delete('/folders/:id', async (req, res) => {
  const folder = await prisma.mediaFolder.findUnique({
    where: { id: req.params.id },
    include: { assets: true },
  });
  if (!folder) return res.status(404).json({ error: 'Not found' });
  // Remove files from disk, then cascade-delete rows.
  for (const a of folder.assets) {
    const abs = absFromPublicUrl(a.url);
    if (abs) { try { fs.unlinkSync(abs); } catch { /* ignore */ } }
  }
  try {
    const dir = productFolderDir(folder.category, folder.code);
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
  await prisma.mediaFolder.delete({ where: { id: folder.id } });
  return res.status(204).end();
});

// ── GET /folders/:id/assets ─────────────────────────────────────────────────
mediaRoutes.get('/folders/:id/assets', async (req, res) => {
  const folder = await prisma.mediaFolder.findUnique({ where: { id: req.params.id } });
  if (!folder) return res.status(404).json({ error: 'Not found' });
  const assets = await prisma.mediaAsset.findMany({
    where: { folderId: folder.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return res.json({ folder, assets });
});

// ── POST /folders/:id/assets (batch upload) ─────────────────────────────────
mediaRoutes.post('/folders/:id/assets', upload.array('files', MAX_FILES), async (req, res) => {
  const folder = await prisma.mediaFolder.findUnique({ where: { id: req.params.id } });
  if (!folder) return res.status(404).json({ error: 'Not found' });
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

  const dir = ensureDir(productFolderDir(folder.category, folder.code));
  const existing = await prisma.mediaAsset.count({ where: { folderId: folder.id } });

  const created: any[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let img: sharp.Sharp;
    let meta: sharp.Metadata;
    try {
      img = sharp(file.buffer, { failOn: 'error' }).rotate(); // bake EXIF orientation
      meta = await img.metadata();
    } catch {
      return res.status(400).json({ error: `"${file.originalname}" is not a valid image.` });
    }
    if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
      return res.status(400).json({ error: `"${file.originalname}" has an unsupported image format.` });
    }
    // Normalise: cap the largest dimension so stored files stay reasonable.
    const MAX_DIM = 2000;
    if ((meta.width || 0) > MAX_DIM || (meta.height || 0) > MAX_DIM) {
      img = img.resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true });
    }
    let outBuf = await img.toBuffer();
    outBuf = await applyWatermark(outBuf); // brand watermark on product images
    const outMeta = await sharp(outBuf).metadata();

    const filename = safeFilename(file.originalname, `.${meta.format === 'jpeg' ? 'jpg' : meta.format}`);
    const absPath = path.join(dir, filename);
    fs.writeFileSync(absPath, outBuf);

    const asset = await prisma.mediaAsset.create({
      data: {
        folderId: folder.id,
        url: publicUrl(absPath),
        filename,
        mime: file.mimetype,
        size: outBuf.length,
        width: outMeta.width ?? null,
        height: outMeta.height ?? null,
        sortOrder: existing + i,
      },
    });
    created.push(asset);
  }
  return res.status(201).json({ assets: created });
});

// ── DELETE /assets/:id ───────────────────────────────────────────────────────
mediaRoutes.delete('/assets/:id', async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return res.status(404).json({ error: 'Not found' });
  const abs = absFromPublicUrl(asset.url);
  if (abs) { try { fs.unlinkSync(abs); } catch { /* ignore */ } }
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  return res.status(204).end();
});
