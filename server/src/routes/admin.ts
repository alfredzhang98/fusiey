/**
 * Admin routes — dashboard, inventory, site config.
 *
 * All endpoints require ADMIN or SUPERADMIN role.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireRole('ADMIN', 'SUPERADMIN'));

// ── GET /admin/dashboard ────────────────────────────────────────────────

adminRoutes.get('/dashboard', async (_req, res) => {
  const [totalOrders, revenueByCurrencyRaw, totalUsers, totalProducts, ordersByStatus] =
    await Promise.all([
      prisma.order.count(),
      // Revenue grouped BY currency — GBP and USD must never be summed together.
      prisma.order.groupBy({
        by: ['currency'],
        _sum: { totalAmount: true },
        where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      }),
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

  const revenueByCurrency = revenueByCurrencyRaw
    .map((r) => ({ currency: r.currency, total: Number(r._sum.totalAmount || 0) }))
    .sort((a, b) => (a.currency === 'GBP' ? -1 : 1));

  // Recent orders
  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  const statusMap: Record<string, number> = {};
  for (const s of ordersByStatus) statusMap[s.status] = s._count;

  return res.json({
    stats: {
      totalOrders,
      revenueByCurrency,
      totalUsers,
      totalProducts,
      ordersByStatus: statusMap,
    },
    recentOrders: recentOrders.map((o) => ({
      ...o,
      totalAmount: Number(o.totalAmount),
    })),
  });
});

// ── Accounting ledger ─────────────────────────────────────────────────────
// Detailed per-order financial breakdown for bookkeeping + CSV export.

/** Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD&status= into a Prisma where clause. */
function ledgerWhere(query: any) {
  const where: any = {};
  if (query.status) where.status = query.status;
  const createdAt: any = {};
  if (query.from) {
    const d = new Date(query.from);
    if (!isNaN(d.getTime())) createdAt.gte = d;
  }
  if (query.to) {
    const d = new Date(query.to);
    if (!isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999); // inclusive end-of-day
      createdAt.lte = d;
    }
  }
  if (Object.keys(createdAt).length) where.createdAt = createdAt;
  return where;
}

async function fetchLedger(query: any) {
  const where = ledgerWhere(query);
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000, // hard cap so an export can't run away
    include: {
      user: { select: { name: true, email: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  const rows = orders.map((o) => ({
    id: o.id,
    createdAt: o.createdAt,
    customerName: o.user?.name || '',
    customerEmail: o.user?.email || '',
    status: o.status,
    paid: !!o.paymentId,
    paymentMethod: o.paymentMethod || '',
    paymentId: o.paymentId || '',
    items: o.items.map((i) => `${i.product?.name || i.productId}×${i.quantity}`).join('; '),
    subtotal: Number(o.subtotalAmount),
    discountCode: o.discountCode || '',
    discount: Number(o.discountAmount),
    shipping: Number(o.shippingAmount),
    vat: Number(o.vatAmount),
    total: Number(o.totalAmount),
    currency: o.currency,
    carrier: o.carrier || '',
    trackingNumber: o.trackingNumber || '',
    cancelReason: o.cancelReason || '',
  }));

  // Totals exclude cancelled/refunded so the "money in" figures are honest.
  // Grouped BY currency — GBP and USD orders must never be summed together.
  const counted = rows.filter((r) => r.status !== 'CANCELLED' && r.status !== 'REFUNDED');
  const byCurrency: Record<string, any> = {};
  for (const r of counted) {
    const t = (byCurrency[r.currency] ??= {
      currency: r.currency, count: 0, subtotal: 0, discount: 0, shipping: 0, vat: 0, total: 0,
    });
    t.count += 1;
    t.subtotal += r.subtotal;
    t.discount += r.discount;
    t.shipping += r.shipping;
    t.vat += r.vat;
    t.total += r.total;
  }
  const totals = Object.values(byCurrency).map((t: any) => ({
    ...t,
    subtotal: Math.round(t.subtotal * 100) / 100,
    discount: Math.round(t.discount * 100) / 100,
    shipping: Math.round(t.shipping * 100) / 100,
    vat: Math.round(t.vat * 100) / 100,
    total: Math.round(t.total * 100) / 100,
  }));

  return { rows, totals, count: rows.length, countedCount: counted.length };
}

// ── GET /admin/orders/ledger ────────────────────────────────────────────
adminRoutes.get('/orders/ledger', async (req, res) => {
  const ledger = await fetchLedger(req.query);
  return res.json(ledger);
});

// ── GET /admin/orders/export.csv ────────────────────────────────────────
adminRoutes.get('/orders/export.csv', async (req, res) => {
  const { rows } = await fetchLedger(req.query);

  // RFC-4180 cell escaping.
  const cell = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'Order ID', 'Date', 'Customer', 'Email', 'Status', 'Paid',
    'Payment Method', 'Payment ID', 'Items',
    'Subtotal', 'Discount Code', 'Discount', 'Shipping', 'VAT', 'Total', 'Currency',
    'Carrier', 'Tracking', 'Cancel Reason',
  ];
  const lines = [header.map(cell).join(',')];
  for (const r of rows) {
    lines.push([
      r.id,
      r.createdAt.toISOString(),
      r.customerName,
      r.customerEmail,
      r.status,
      r.paid ? 'Paid' : 'Unpaid',
      r.paymentMethod,
      r.paymentId,
      r.items,
      r.subtotal.toFixed(2),
      r.discountCode,
      r.discount.toFixed(2),
      r.shipping.toFixed(2),
      r.vat.toFixed(2),
      r.total.toFixed(2),
      r.currency,
      r.carrier,
      r.trackingNumber,
      r.cancelReason,
    ].map(cell).join(','));
  }
  // Prepend BOM so Excel opens UTF-8 (£ symbols) correctly.
  const csv = '﻿' + lines.join('\r\n');

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="fusiey-ledger-${stamp}.csv"`);
  return res.send(csv);
});

// ── GET /admin/inventory ────────────────────────────────────────────────

adminRoutes.get('/inventory', async (req, res) => {
  const lowStock = req.query.lowStock === 'true';

  const where: any = { isActive: true };
  if (lowStock) {
    where.stock = { lte: prisma.product.fields.lowStockThreshold
      ? undefined as any
      : 5 };
  }

  // Cannot reference field-in-field in Prisma where, so fetch all and filter
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { stock: 'asc' },
  });

  const filtered = lowStock
    ? products.filter((p) => p.stock <= p.lowStockThreshold)
    : products;

  return res.json({
    products: filtered.map((p) => ({
      ...p,
      priceGBP: Number(p.priceGBP),
      priceUSD: p.priceUSD != null ? Number(p.priceUSD) : null,
    })),
    totalStock: products.reduce((sum, p) => sum + p.stock, 0),
    lowStockCount: products.filter((p) => p.stock <= p.lowStockThreshold).length,
  });
});

// ── PATCH /admin/inventory/:id ──────────────────────────────────────────

const inventorySchema = z.object({
  stock: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(1).optional(),
});

adminRoutes.patch('/inventory/:id', async (req, res) => {
  const parsed = inventorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  return res.json({
    ...updated,
    priceGBP: Number(updated.priceGBP),
    priceUSD: updated.priceUSD != null ? Number(updated.priceUSD) : null,
  });
});

// ── GET /admin/config ───────────────────────────────────────────────────

adminRoutes.get('/config', async (_req, res) => {
  const configs = await prisma.siteConfig.findMany();
  const map: Record<string, any> = {};
  for (const c of configs) map[c.key] = c.value;
  return res.json(map);
});

// ── PATCH /admin/config ─────────────────────────────────────────────────

const configSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.any(),
});

adminRoutes.patch('/config', async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { key, value } = parsed.data;

  await prisma.siteConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  return res.json({ key, value });
});
