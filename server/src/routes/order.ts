/**
 * Order routes — user-owned reads + admin management.
 *
 *   GET    /api/orders           user sees own; admin sees all
 *   GET    /api/orders/:id       detail (owner or admin)
 *   POST   /api/orders           create from cart
 *   PATCH  /api/orders/:id       admin: update status / tracking
 *   DELETE /api/orders/:id       user: cancel if still PENDING
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const orderRoutes = Router();
orderRoutes.use(requireAuth);

// ── Validation ──────────────────────────────────────────────────────────

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  county: z.string().max(100).optional(),
  postcode: z.string().min(1).max(20),
  country: z.literal('GB'),
});

const orderItemSchema = z.object({
  productId: z.string(),
  patternId: z.string().optional(),
  quantity: z.number().int().min(1),
  customisation: z.record(z.string(), z.string()).optional(),
});

const createSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(30),
  shippingAddress: addressSchema,
  notes: z.string().max(1000).optional(),
  paymentMethod: z.enum(['paypal', 'stripe']),
});

const statusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  trackingUrl: z.string().max(500).optional(),
  cancelReason: z.string().max(500).optional(),
});

// ── POST /orders (create) ───────────────────────────────────────────────

orderRoutes.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const user = req.user!;
  const { items, shippingAddress, notes, paymentMethod } = parsed.data;

  // Resolve product prices + check stock
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const orderItems: any[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return res.status(400).json({ error: `Product ${item.productId} not available` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
    }
    // Legacy direct-create path settles in GBP (base currency).
    const unitPrice = Number(product.priceGBP);
    totalAmount += unitPrice * item.quantity;
    orderItems.push({
      productId: item.productId,
      patternId: item.patternId || null,
      quantity: item.quantity,
      unitPrice,
      customisation: item.customisation || undefined,
    });
  }

  // Create address + order + items in a transaction
  const order = await prisma.$transaction(async (tx: any) => {
    const addr = await tx.address.create({
      data: { userId: user.id, ...shippingAddress },
    });

    const created = await tx.order.create({
      data: {
        userId: user.id,
        status: 'PENDING',
        subtotalAmount: totalAmount,
        discountAmount: 0,
        shippingAmount: 0,
        // VAT is inclusive in displayed prices: vat = total − total/1.2.
        vatAmount: Math.round((totalAmount - totalAmount / 1.2) * 100) / 100,
        totalAmount,
        currency: 'GBP',
        shippingAddressId: addr.id,
        paymentMethod,
        notes,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: { include: { product: { select: { name: true, images: true } } } },
        shippingAddress: true,
      },
    });

    // Deduct stock
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return created;
  });

  return res.status(201).json(formatOrder(order));
});

// ── GET /orders (list) ──────────────────────────────────────────────────

orderRoutes.get('/', async (req, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const where: any = isAdmin ? {} : { userId: user.id };
  if (req.query.status) where.status = req.query.status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: { include: { product: { select: { name: true, images: true } } } },
        shippingAddress: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return res.json({
    orders: orders.map(formatOrder),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// ── GET /orders/:id ─────────────────────────────────────────────────────

orderRoutes.get('/:id', async (req, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERADMIN';

  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { product: { select: { name: true, images: true } } } },
      shippingAddress: true,
    },
  });

  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!isAdmin && order.userId !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return res.json(formatOrder(order));
});

// ── PATCH /orders/:id (admin — status update) ───────────────────────────

orderRoutes.patch('/:id', requireRole('ADMIN', 'SUPERADMIN'), async (req, res) => {
  const parsed = statusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { status, trackingNumber, carrier, trackingUrl, cancelReason } = parsed.data;

  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  // Terminal-state rules: a refunded order is final; a cancelled order may only
  // be edited (reason) or moved to REFUNDED after a manual PayPal refund.
  if (existing.status === 'REFUNDED') {
    return res.status(400).json({ error: 'This order is refunded — its status is final.' });
  }
  if (existing.status === 'CANCELLED' && status !== 'CANCELLED' && status !== 'REFUNDED') {
    return res.status(400).json({ error: 'A cancelled order can only be marked refunded.' });
  }
  if (status === 'REFUNDED' && existing.status !== 'CANCELLED') {
    return res.status(400).json({ error: 'Cancel the order first, refund in PayPal, then mark it refunded.' });
  }

  const data: any = { status };
  if (trackingNumber !== undefined) data.trackingNumber = trackingNumber || null;
  if (carrier !== undefined) data.carrier = carrier || null;
  if (trackingUrl !== undefined) data.trackingUrl = trackingUrl || null;
  if (status === 'CANCELLED' && cancelReason !== undefined) data.cancelReason = cancelReason || null;

  // Refund stock if cancelling
  if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
    await prisma.$transaction(async (tx: any) => {
      const items = await tx.orderItem.findMany({ where: { orderId: req.params.id } });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({ where: { id: req.params.id }, data });
    });
    return res.json({ success: true });
  }

  const updated = await prisma.order.update({ where: { id: req.params.id }, data });
  return res.json({ success: true, status: updated.status });
});

// ── DELETE /orders/:id (user — cancel own PENDING order) ────────────────

orderRoutes.delete('/:id', async (req, res) => {
  const user = req.user!;
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (order.userId !== user.id) return res.status(403).json({ error: 'Forbidden' });
  if (order.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only pending orders can be cancelled' });
  }

  // Refund stock + cancel
  await prisma.$transaction(async (tx: any) => {
    const items = await tx.orderItem.findMany({ where: { orderId: req.params.id } });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });
  });

  return res.status(204).end();
});

// ── Helpers ─────────────────────────────────────────────────────────────

function formatOrder(o: any) {
  return {
    ...o,
    totalAmount: Number(o.totalAmount),
    subtotalAmount: o.subtotalAmount != null ? Number(o.subtotalAmount) : undefined,
    discountAmount: o.discountAmount != null ? Number(o.discountAmount) : undefined,
    shippingAmount: o.shippingAmount != null ? Number(o.shippingAmount) : undefined,
    vatAmount: o.vatAmount != null ? Number(o.vatAmount) : undefined,
    items: o.items?.map((i: any) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
    })),
  };
}
