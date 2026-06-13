/**
 * Pattern CRUD — user-owned SavedPattern records.
 *
 * All endpoints require auth. Ownership is enforced on every read/write.
 *
 *   POST   /api/patterns         create (body = PatternCreateInput)
 *   GET    /api/patterns         list my patterns (lightweight — no grid)
 *   GET    /api/patterns/:id     full detail (includes grid + aiImage)
 *   PATCH  /api/patterns/:id     partial update (name / grid / stats)
 *   DELETE /api/patterns/:id
 *
 * The auto-naming policy for `name`:
 *   - If the body omits `name`, we use "drew bead N" where N is the user's
 *     namingCounter (incremented atomically so two concurrent POSTs never
 *     collide on the same label).
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

export const patternRoutes = Router();
patternRoutes.use(requireAuth);

const gridSchema = z.array(
  z.array(
    z.object({
      colorId: z.string().nullable(),
      originalColor: z.string().optional(),
    }),
  ),
);

const createSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  width: z.number().int().min(1).max(200),
  height: z.number().int().min(1).max(200),
  grid: gridSchema,
  paletteId: z.string().min(1).max(60),
  beadSize: z.number().positive().optional(),
  thumbnail: z.string().max(200_000).optional(),
  source: z.enum(['AI', 'MANUAL']).optional(),
  aiImageData: z.string().max(5_000_000).optional(),
  stats: z.any().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  grid: gridSchema.optional(),
  thumbnail: z.string().max(200_000).optional(),
  stats: z.any().optional(),
  version: z.number().int().optional(), // optimistic lock
});

// ── POST /patterns ────────────────────────────────────────────────────
patternRoutes.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const user = req.user!;
  const body = parsed.data;

  const pattern = await prisma.$transaction(async (tx: any) => {
    let name = body.name?.trim();
    if (!name) {
      // Auto-name: pop next counter atomically.
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { namingCounter: { increment: 1 } },
        select: { namingCounter: true },
      });
      name = `drew bead ${updated.namingCounter}`;
    }
    return tx.savedPattern.create({
      data: {
        userId: user.id,
        name,
        width: body.width,
        height: body.height,
        grid: body.grid as any,
        paletteId: body.paletteId,
        beadSize: body.beadSize ?? 5,
        thumbnail: body.thumbnail,
        source: body.source ?? 'MANUAL',
        aiImageData: body.aiImageData,
        stats: body.stats ?? undefined,
      },
    });
  });

  return res.status(201).json({ pattern: lightweight(pattern) });
});

// ── GET /patterns (paginated, no thumbnail payload) ────────────────────
patternRoutes.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
  const where: any = { userId: req.user!.id };
  // ?purchased=true → bought (certified/official) copies; false → own designs.
  if (req.query.purchased === 'true') where.isPurchased = true;
  else if (req.query.purchased === 'false') where.isPurchased = false;

  // Note: `thumbnail` is intentionally excluded — it's fetched lazily and
  // cached via the dedicated /thumbnail image endpoint, keeping this JSON small.
  const [patterns, total] = await Promise.all([
    prisma.savedPattern.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, width: true, height: true, paletteId: true,
        source: true, isPurchased: true, isPublished: true, publishedAt: true,
        downloadCount: true, likeCount: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.savedPattern.count({ where }),
  ]);

  return res.json({ patterns, total, page, totalPages: Math.ceil(total / limit) });
});

// ── GET /patterns/purchases — non-certified (download) pattern purchases ──
// Defined before /:id so "purchases" isn't captured as an id.
patternRoutes.get('/purchases', async (req, res) => {
  const purchases = await prisma.patternPurchase.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ purchases });
});

// ── GET /patterns/:id/thumbnail — cached PNG, no base64 in list JSON ────
patternRoutes.get('/:id/thumbnail', async (req, res) => {
  const pattern = await prisma.savedPattern.findUnique({
    where: { id: req.params.id },
    select: { userId: true, thumbnail: true, updatedAt: true },
  });
  // Owner can always view; admins can view any (needed to fulfil custom orders).
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPERADMIN';
  if (!pattern || (!isAdmin && pattern.userId !== req.user!.id) || !pattern.thumbnail) {
    return res.status(404).end();
  }
  const m = pattern.thumbnail.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return res.status(404).end();

  // Strong-ish caching: ETag from updatedAt → browser revalidates with 304.
  const etag = `"thumb-${pattern.updatedAt.getTime()}"`;
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.set('ETag', etag);
  res.set('Cache-Control', 'private, max-age=86400');
  res.type('png').send(Buffer.from(m[1], 'base64'));
});

// ── GET /patterns/:id ─────────────────────────────────────────────────
patternRoutes.get('/:id', async (req, res) => {
  const pattern = await prisma.savedPattern.findUnique({ where: { id: req.params.id } });
  if (!pattern) return res.status(404).json({ error: 'Not found' });
  if (pattern.userId !== req.user!.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({ pattern });
});

// ── PATCH /patterns/:id ───────────────────────────────────────────────
patternRoutes.patch('/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { version, ...updates } = parsed.data;

  const existing = await prisma.savedPattern.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });

  if (version !== undefined && version !== existing.version) {
    return res
      .status(409)
      .json({ error: 'Stale version — this pattern was updated elsewhere', latest: existing.version });
  }

  const updated = await prisma.savedPattern.update({
    where: { id: req.params.id },
    data: {
      ...updates,
      grid: updates.grid as any,
      version: { increment: 1 },
    },
  });
  return res.json({ pattern: lightweight(updated) });
});

// ── DELETE /patterns/:id ──────────────────────────────────────────────
patternRoutes.delete('/:id', async (req, res) => {
  const existing = await prisma.savedPattern.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.userId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
  await prisma.savedPattern.delete({ where: { id: req.params.id } });
  return res.status(204).end();
});

/** Strip heavy fields for list-view / create-response payloads. */
function lightweight(p: any) {
  const { grid: _g, aiImageData: _ai, ...rest } = p;
  return rest;
}
