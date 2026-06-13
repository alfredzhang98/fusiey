/**
 * Product routes — public read, admin write.
 *
 *   GET    /api/products           list active products (public)
 *   GET    /api/products/:id       product detail (public)
 *   POST   /api/products           create (admin)
 *   PATCH  /api/products/:id       update (admin)
 *   DELETE /api/products/:id       soft-delete — sets isActive=false (admin)
 */

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { patternFolderDir, ensureDir, safeFilename, publicUrl } from '../lib/storage.js';

export const productRoutes = Router();

// The 5 canonical product categories.
const CATEGORY_KEYS = ['kit-pattern', 'pattern', 'beads', 'refill', 'tool'] as const;

// ── Validation ──────────────────────────────────────────────────────────

// An image reference is either an uploaded path (/uploads/...) or an http(s) URL.
const imageRef = z.string().min(1).max(500).refine(
  (s) => s.startsWith('/uploads/') || /^https?:\/\//.test(s),
  'Image must be an uploaded path or an http(s) URL',
);

// Certified pattern JSON — mirrors the SavedPattern grid shape.
const gridCell = z.object({ colorId: z.string().nullable(), originalColor: z.string().optional() });
const patternDataSchema = z.object({
  name: z.string().max(120).optional(),
  width: z.number().int().min(1).max(200),
  height: z.number().int().min(1).max(200),
  grid: z.array(z.array(gridCell)),
  paletteId: z.string().min(1).max(60),
  beadSize: z.number().positive().optional(),
  thumbnail: z.string().max(200_000).optional(),
});

const baseProductSchema = z.object({
  sku: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  // GBP required (base + settlement). USD optional — null = not sold in US.
  priceGBP: z.number().positive(),
  priceUSD: z.number().positive().nullable().optional(),
  images: z.array(imageRef).min(1).max(9),
  category: z.enum(CATEGORY_KEYS),
  // NOTE: no .default() here — defaults are applied in the create handler.
  // A `.default()` survives `.partial()`, so it would re-inject (clobber) these
  // fields on every PATCH, e.g. reset stock→0 / isCustomisable→false.
  stock: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(1).optional(),
  isCustomisable: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string().max(50)).optional(),
  // Pattern deliverables.
  isCertifiedPattern: z.boolean().optional(),
  patternData: patternDataSchema.nullable().optional(),
  patternFileUrl: z.string().max(500).nullable().optional(),
  patternFileType: z.enum(['pdf', 'png']).nullable().optional(),
});

const createSchema = baseProductSchema;
const updateSchema = baseProductSchema.partial();

/** Apply create-time defaults (only on create — never on partial updates). */
function withCreateDefaults(data: any) {
  data.stock ??= 0;
  data.lowStockThreshold ??= 5;
  data.isCustomisable ??= false;
  data.isDigital ??= false;
  data.isCertifiedPattern ??= false;
  data.tags ??= [];
  return data;
}

/**
 * Decimal → number for the wire. NEVER exposes the certified pattern JSON
 * (`patternData`); the download URL is only included for admins.
 */
function formatProduct(p: any, admin = false) {
  const out: any = {
    ...p,
    priceGBP: Number(p.priceGBP),
    priceUSD: p.priceUSD != null ? Number(p.priceUSD) : null,
    hasPatternData: p.patternData != null,
  };
  delete out.patternData;
  if (!admin) out.patternFileUrl = null; // non-buyers can't grab the deliverable
  return out;
}

/** Enforce pattern-product invariants on a parsed create/update payload. */
function normalisePatternFields(data: any, existing?: any) {
  if (data.category === 'pattern') data.isDigital = true;
  const certified = data.isCertifiedPattern ?? existing?.isCertifiedPattern;
  const hasJson = data.patternData !== undefined ? data.patternData != null : existing?.patternData != null;
  if (certified && !hasJson) {
    return 'Certified patterns require an uploaded pattern JSON.';
  }
  return null;
}

// ── GET /products (public) ──────────────────────────────────────────────

productRoutes.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const category = req.query.category as string | undefined;
  const tag = req.query.tag as string | undefined;
  const sort = (req.query.sort as string) || 'newest';
  const search = req.query.search as string | undefined;

  const where: any = { isActive: true };
  if (category) where.category = category;
  if (tag) where.tags = { has: tag };
  if (req.query.customisable === 'true') where.isCustomisable = true;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: any =
    sort === 'price-asc'  ? { priceGBP: 'asc' } :
    sort === 'price-desc' ? { priceGBP: 'desc' } :
    sort === 'name'       ? { name: 'asc' } :
    { createdAt: 'desc' }; // newest

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, sku: true, name: true, description: true,
        priceGBP: true, priceUSD: true, images: true, category: true,
        stock: true, isCustomisable: true, isDigital: true, tags: true,
        isCertifiedPattern: true, patternFileType: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return res.json({
    products: products.map((p) => formatProduct(p)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ── GET /products/bestsellers (public) — top sellers by units sold ──────
// Defined before /:id so "bestsellers" isn't captured as an id.

productRoutes.get('/bestsellers', async (_req, res) => {
  const grouped = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 8,
  });
  const ids = grouped.map((g) => g.productId);
  if (ids.length === 0) return res.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const ordered = ids
    .map((id) => map.get(id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => formatProduct(p));

  return res.json({ products: ordered });
});

// ── GET /products/admin (admin — includes inactive) ─────────────────────
// Defined before /:id so "admin" isn't captured as an id. Inline guard since
// the router-level admin guard only applies after the public GET routes.

productRoutes.get('/admin', requireAuth, requireRole('ADMIN', 'SUPERADMIN'), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, sku: true, name: true, description: true,
        priceGBP: true, priceUSD: true, images: true, category: true,
        stock: true, lowStockThreshold: true, isCustomisable: true, isDigital: true,
        isActive: true, tags: true, isCertifiedPattern: true,
        patternFileUrl: true, patternFileType: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.product.count(),
  ]);
  return res.json({
    products: products.map((p) => formatProduct(p, true)),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ── GET /products/:id (public) ──────────────────────────────────────────

productRoutes.get('/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
  });
  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }
  return res.json(formatProduct(product));
});

// ── Admin-only guards ───────────────────────────────────────────────────

productRoutes.use(requireAuth, requireRole('ADMIN', 'SUPERADMIN'));

// ── POST /products (admin) ──────────────────────────────────────────────

productRoutes.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const data: any = withCreateDefaults({ ...parsed.data });
  const err = normalisePatternFields(data);
  if (err) return res.status(400).json({ error: err });
  const product = await prisma.product.create({ data });
  return res.status(201).json(formatProduct(product, true));
});

// ── POST /products/pattern-file (admin) — upload a non-certified PDF/PNG ──
const patternFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

productRoutes.post('/pattern-file', patternFileUpload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const buf = file.buffer;
  const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPdf && !isPng) {
    return res.status(400).json({ error: 'Pattern file must be a PDF or PNG.' });
  }
  const type = isPdf ? 'pdf' : 'png';
  const dir = ensureDir(patternFolderDir(crypto.randomBytes(8).toString('hex')));
  const filename = safeFilename(file.originalname, isPdf ? '.pdf' : '.png');
  const abs = path.join(dir, filename);
  fs.writeFileSync(abs, buf);
  return res.status(201).json({ url: publicUrl(abs), type });
});

// ── PATCH /products/:id (admin) ─────────────────────────────────────────

productRoutes.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const data: any = { ...parsed.data };
  const err = normalisePatternFields(data, existing);
  if (err) return res.status(400).json({ error: err });

  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data,
  });
  return res.json(formatProduct(updated, true));
});

// ── DELETE /products/:id (admin — soft delete) ──────────────────────────

productRoutes.delete('/:id', async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.product.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  return res.status(204).end();
});
