/**
 * Payment routes — PayPal Standard Checkout.
 *
 *   POST /api/payments/paypal/create-order   create a PayPal order (auth)
 *   POST /api/payments/paypal/capture-order  capture + create the Fusiey order
 *
 * Prices are always recomputed server-side from the database, so a tampered
 * client total can never change what the customer is charged.
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { createPaypalOrder, capturePaypalOrder, isPaypalConfigured } from '../services/paypalService.js';
import { getShippingConfig, type Region } from '../lib/shippingConfig.js';

export const paymentRoutes = Router();
paymentRoutes.use(requireAuth);

const itemSchema = z.object({
  productId: z.string(),
  patternId: z.string().optional(),
  quantity: z.number().int().min(1),
  customisation: z.record(z.string(), z.string()).optional(),
});

const addressSchema = z.object({
  label: z.string().max(50).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  county: z.string().max(100).optional(),
  postcode: z.string().min(1).max(20),
  country: z.literal('GB'),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1).max(30),
  shippingAddress: addressSchema,
  notes: z.string().max(1000).optional(),
  discountCode: z.string().max(40).optional(),
  currency: z.enum(['GBP', 'USD']).default('GBP'),
});

type CheckoutInput = z.infer<typeof checkoutSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;
const VAT_RATE = 0.2; // UK VAT, prices are VAT-inclusive

/**
 * Look up + validate a discount code. Returns the code record if usable, or
 * throws with a customer-facing message. `null` when no code was supplied.
 */
async function resolveDiscount(code?: string) {
  if (!code || !code.trim()) return null;
  const normalised = code.toUpperCase().trim();
  const dc = await prisma.discountCode.findUnique({ where: { code: normalised } });
  if (!dc) throw new Error("That discount code isn't valid.");
  if (dc.used) throw new Error('That discount code has already been used.');
  if (dc.expiresAt && dc.expiresAt < new Date()) throw new Error('That discount code has expired.');
  return dc;
}

/** The product's price in the requested region currency (null = not sold there). */
function regionalPrice(product: any, currency: Region): number | null {
  const raw = currency === 'USD' ? product.priceUSD : product.priceGBP;
  return raw == null ? null : Number(raw);
}

/** Recompute prices + stock from the DB. Throws on any invalid line. */
async function priceCart(items: CheckoutInput['items'], currency: Region, discountCode?: string) {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let allDigital = true;
  const orderItems: any[] = [];
  // Pattern products to deliver to the buyer (unique by productId).
  const deliverables = new Map<string, any>();
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Product ${item.productId} not available`);
    // Digital products (e.g. patterns) have no physical stock limit.
    if (!product.isDigital && product.stock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }
    const unitPrice = regionalPrice(product, currency);
    if (unitPrice == null) {
      throw new Error(`${product.name} isn't available in your region.`);
    }
    if (!product.isDigital) allDigital = false;
    subtotal += unitPrice * item.quantity;
    orderItems.push({
      productId: item.productId,
      patternId: item.patternId || null,
      quantity: item.quantity,
      unitPrice,
      customisation: item.customisation || undefined,
    });
    // A pattern product carries a deliverable: certified JSON or a download file.
    if (product.category === 'pattern' && (product.patternData || product.patternFileUrl || product.patternFileUrls?.length)) {
      deliverables.set(product.id, product);
    }
  }
  subtotal = round2(subtotal);

  // Discount applies to goods only (not shipping).
  const discount = await resolveDiscount(discountCode);
  const discountAmount = discount ? round2(subtotal * (discount.percentOff / 100)) : 0;
  const discountedGoods = round2(subtotal - discountAmount);

  // Digital-only orders ship for free (nothing to post).
  const shippingCfg = await getShippingConfig();
  const ship = shippingCfg[currency];
  const shipping = (allDigital || discountedGoods >= ship.freeOver) ? 0 : ship.fee;
  const total = round2(discountedGoods + shipping);
  // VAT is inclusive in the displayed prices: net = total / 1.2, vat = total − net.
  const vatAmount = round2(total - total / (1 + VAT_RATE));

  return {
    subtotal,
    discountAmount,
    discountCode: discount?.code ?? null,
    discountId: discount?.id ?? null,
    shipping,
    vatAmount,
    total,
    orderItems,
    allDigital,
    deliverables: [...deliverables.values()],
  };
}

/**
 * After a paid order is created, deliver any purchased pattern products to the
 * buyer's account: certified patterns become an editable SavedPattern copy;
 * non-certified patterns become a downloadable PatternPurchase. Idempotent —
 * unique constraints + try/catch make re-purchase a no-op.
 */
async function deliverPatterns(tx: any, userId: string, deliverables: any[]) {
  for (const product of deliverables) {
    try {
      if (product.isCertifiedPattern && product.patternData) {
        const exists = await tx.savedPattern.findFirst({
          where: { userId, sourceProductId: product.id }, select: { id: true },
        });
        if (exists) continue;
        const d = product.patternData as any;
        await tx.savedPattern.create({
          data: {
            userId,
            name: d.name || product.name,
            width: d.width,
            height: d.height,
            grid: d.grid,
            paletteId: d.paletteId,
            beadSize: d.beadSize ?? 5,
            thumbnail: d.thumbnail ?? null,
            source: 'OFFICIAL',
            isPurchased: true,
            sourceProductId: product.id,
          },
        });
      } else if (product.patternFileUrl || product.patternFileUrls?.length) {
        const fileUrls: string[] = product.patternFileUrls?.length
          ? product.patternFileUrls
          : [product.patternFileUrl];
        await tx.patternPurchase.create({
          data: {
            userId,
            productId: product.id,
            name: product.name,
            fileUrl: fileUrls[0],
            fileUrls,
            fileType: product.patternFileType || 'pdf',
          },
        });
      }
    } catch (err: any) {
      if (err?.code === 'P2002') continue; // already delivered (dedupe race)
      throw err;
    }
  }
}

// ── POST /payments/paypal/create-order ──────────────────────────────────

paymentRoutes.post('/paypal/create-order', async (req, res) => {
  if (!isPaypalConfigured()) {
    return res.status(503).json({ error: 'PayPal is not configured on the server.' });
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  try {
    const { currency } = parsed.data;
    const { total } = await priceCart(parsed.data.items, currency, parsed.data.discountCode);
    const order = await createPaypalOrder(total, currency);
    return res.json({ id: order.id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create PayPal order' });
  }
});

// ── POST /payments/validate-discount ────────────────────────────────────
// Pre-flight check so the checkout can show the applied discount before pay.
const discountCheckSchema = z.object({ code: z.string().min(1).max(40) });

paymentRoutes.post('/validate-discount', async (req, res) => {
  const parsed = discountCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a discount code.' });
  try {
    const dc = await resolveDiscount(parsed.data.code);
    return res.json({ valid: true, code: dc!.code, percentOff: dc!.percentOff });
  } catch (err: any) {
    return res.status(400).json({ valid: false, error: err.message || 'Invalid code' });
  }
});

// ── POST /payments/paypal/capture-order ─────────────────────────────────

const captureSchema = checkoutSchema.extend({ paypalOrderId: z.string().min(1) });

paymentRoutes.post('/paypal/capture-order', async (req, res) => {
  if (!isPaypalConfigured()) {
    return res.status(503).json({ error: 'PayPal is not configured on the server.' });
  }
  const parsed = captureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const user = req.user!;
  const { paypalOrderId, items, shippingAddress, notes, discountCode, currency } = parsed.data;

  try {
    // Capture the money first — bail if PayPal didn't complete it.
    const capture = await capturePaypalOrder(paypalOrderId);
    if (capture.status !== 'COMPLETED') {
      return res.status(402).json({ error: `Payment not completed (${capture.status}).` });
    }

    // Re-price from the DB and persist the order as paid. Digital-only orders
    // are delivered immediately (nothing to ship).
    const priced = await priceCart(items, currency, discountCode);
    const { subtotal, discountAmount, shipping, vatAmount, total, orderItems, allDigital, discountId } = priced;

    const order = await prisma.$transaction(async (tx: any) => {
      const addr = await tx.address.create({ data: { userId: user.id, ...shippingAddress } });
      const created = await tx.order.create({
        data: {
          userId: user.id,
          status: allDigital ? 'DELIVERED' : 'CONFIRMED',
          subtotalAmount: subtotal,
          discountAmount,
          discountCode: priced.discountCode,
          shippingAmount: shipping,
          vatAmount,
          totalAmount: total,
          currency,
          shippingAddressId: addr.id,
          paymentMethod: 'paypal',
          paymentId: capture.captureId,
          notes,
          items: { create: orderItems },
        },
        include: {
          items: { include: { product: { select: { name: true, images: true } } } },
          shippingAddress: true,
        },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      // Burn the discount code so it can't be reused (one redemption per code).
      if (discountId) {
        await tx.discountCode.update({
          where: { id: discountId },
          data: { used: true, usedAt: new Date(), orderId: created.id },
        });
      }
      // Deliver purchased patterns into the buyer's My Works.
      await deliverPatterns(tx, user.id, priced.deliverables);
      return created;
    });

    return res.status(201).json({ order: { ...order, totalAmount: Number(order.totalAmount) } });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to capture payment' });
  }
});
