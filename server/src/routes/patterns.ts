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
        source: body.source ?? 'AI',
        aiImageData: body.aiImageData,
        stats: body.stats ?? undefined,
      },
    });
  });

  return res.status(201).json({ pattern: lightweight(pattern) });
});

// ── GET /patterns ─────────────────────────────────────────────────────
patternRoutes.get('/', async (req, res) => {
  const patterns = await prisma.savedPattern.findMany({
    where: { userId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      width: true,
      height: true,
      paletteId: true,
      thumbnail: true,
      source: true,
      isPublished: true,
      publishedAt: true,
      downloadCount: true,
      likeCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return res.json({ patterns });
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
