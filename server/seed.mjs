/**
 * Seed script — creates test admin user + sample products.
 * Run: node server/seed.mjs
 */
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';
import bcrypt from 'bcrypt';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fusiey?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fusiey.com' },
    update: {},
    create: {
      email: 'admin@fusiey.com',
      name: 'Admin',
      passwordHash: hash,
      role: 'ADMIN',
      emailVerified: true,
      generateCredits: 999,
    },
  });
  console.log('Admin:', admin.email, admin.role);

  // Also create a test customer
  const customerHash = await bcrypt.hash('test1234', 10);
  const customer = await prisma.user.upsert({
    where: { email: 'test@fusiey.com' },
    update: {},
    create: {
      email: 'test@fusiey.com',
      name: 'Test User',
      passwordHash: customerHash,
      role: 'CUSTOMER',
      emailVerified: true,
      generateCredits: 3,
    },
  });
  console.log('Customer:', customer.email, customer.role);

  // Sample products across the 5 categories.
  //   category: kit-pattern | pattern | beads | refill | tool
  //   tags: 'featured' → Hot carousel · 'hot' → Hot grid
  const ph = (bg, txt) => `https://placehold.co/600x600/${bg}/572C5F?text=${encodeURIComponent(txt)}`;
  const products = [
    // ── Kits + Patterns ──────────────────────────────────────────────
    { name: 'Animal Friends Pattern Kit', description: 'A complete kit: 2.6mm beads, pegboard, ironing paper and a printed pattern for 6 adorable animal designs.', price: 29.99, category: 'kit-pattern', stock: 40, images: [ph('FCDFE5', 'Animal Kit')], tags: ['featured', 'hot', 'beginner'], isCustomisable: false },
    { name: 'Pixel Hero Bundle', description: 'Retro game heroes in bead form. Includes 3000 beads, two boards and full pixel charts.', price: 34.99, category: 'kit-pattern', stock: 25, images: [ph('C9E8FF', 'Pixel Hero')], tags: ['hot'], isCustomisable: false },
    { name: 'Kawaii Food Pattern Set', description: 'Sushi, ice cream and boba! A cute-food kit with beads, board and step-by-step patterns.', price: 27.99, category: 'kit-pattern', stock: 30, images: [ph('FFF3B0', 'Kawaii Food')], tags: ['featured'], isCustomisable: false },

    // ── Patterns ─────────────────────────────────────────────────────
    { name: 'Cute Cat Pattern (PDF)', description: 'Printable chart + colour list for a 50×50 cat design. Compatible with the Fusiey canvas.', price: 4.99, category: 'pattern', stock: 999, images: [ph('FFE0B2', 'Cat Pattern')], tags: ['hot'], isCustomisable: false },
    { name: 'Retro Game Pattern Pack', description: 'Ten classic 8-bit patterns in one download. Mushrooms, hearts, coins and more.', price: 6.99, category: 'pattern', stock: 999, images: [ph('D7F0D0', 'Retro Pack')], tags: ['featured'], isCustomisable: false },
    { name: 'Floral Coaster Patterns', description: 'Six floral coaster charts sized for standard pegboards. Print and bead.', price: 5.99, category: 'pattern', stock: 999, images: [ph('F3D0E8', 'Floral Set')], tags: [], isCustomisable: false },

    // ── Bead Kits ────────────────────────────────────────────────────
    { name: 'Rainbow Bead Box (5000 pcs)', description: '5000 beads across 30 vibrant colours in a sorted compartment box.', price: 19.99, category: 'beads', stock: 40, images: [ph('FFD6E0', 'Bead Box')], tags: ['hot'], isCustomisable: false },
    { name: 'Pastel Bead Set (3000 pcs)', description: 'Soft pastel palette — 20 dreamy colours, perfect for kawaii designs.', price: 14.99, category: 'beads', stock: 50, images: [ph('E7DCFB', 'Pastel Set')], tags: [], isCustomisable: false },
    { name: 'Mega Bead Tub (11000 pcs)', description: 'The big one — 11000 beads in 48 colours. Stock up and never run out.', price: 39.99, category: 'beads', stock: 20, images: [ph('CDEFF0', 'Mega Tub')], tags: ['featured'], isCustomisable: false },

    // ── Refills ──────────────────────────────────────────────────────
    { name: 'Single Colour Refill (1000 pcs)', description: 'Top up your most-used shade. 1000 beads of one colour — choose at checkout.', price: 3.99, category: 'refill', stock: 300, images: [ph('FFE4D3', 'Colour Refill')], tags: [], isCustomisable: true },
    { name: 'Ironing Paper Pack (20 sheets)', description: 'Heat-resistant parchment sheets for fusing. Reusable, 20 per pack.', price: 4.99, category: 'refill', stock: 150, images: [ph('FBF4D0', 'Ironing Paper')], tags: ['hot'], isCustomisable: false },
    { name: 'Pegboard Refill Clips', description: 'Replacement connector clips for joining boards. Pack of 12.', price: 2.99, category: 'refill', stock: 200, images: [ph('E0E0DC', 'Board Clips')], tags: [], isCustomisable: false },

    // ── Tools ────────────────────────────────────────────────────────
    { name: 'Pro Pegboard XL', description: 'Large 29×29 pegboard, compatible with all standard beads. Sturdy non-slip base.', price: 8.99, category: 'tool', stock: 100, images: [ph('FFF9C4', 'Pegboard XL')], tags: ['hot'], isCustomisable: false },
    { name: 'Precision Tweezers Pro', description: 'Ergonomic tweezers (2-pack) with curved and straight tips for fine placement.', price: 5.99, category: 'tool', stock: 200, images: [ph('E8F5E9', 'Tweezers')], tags: [], isCustomisable: false },
    { name: 'Bead Sorting Tray', description: 'Twelve-compartment tray to sort colours before you start. Stackable.', price: 7.99, category: 'tool', stock: 80, images: [ph('D9F0FF', 'Sorting Tray')], tags: [], isCustomisable: false },
    { name: 'Mini Craft Iron', description: 'Compact iron with a steady low-heat setting tuned for fusing beads.', price: 15.99, category: 'tool', stock: 35, images: [ph('FFD9D0', 'Mini Iron')], tags: ['featured'], isCustomisable: false },
  ];

  // Demo products are OFF by default — real products are uploaded via the admin
  // panel. Set SEED_DEMO=1 to insert the sample catalogue for local testing.
  if (process.env.SEED_DEMO !== '1') {
    console.log('Skipped demo products (set SEED_DEMO=1 to seed the sample catalogue).');
    console.log('Done.');
    await prisma.$disconnect();
    return;
  }

  for (const p of products) {
    // Map the demo `price` → per-region prices. GBP is the listed price; USD is
    // a rough demo value so the US region has stock to show (set real prices in
    // the admin panel). patterns are digital.
    const { price, ...rest } = p;
    const data = {
      ...rest,
      priceGBP: price,
      priceUSD: Number((price * 1.27).toFixed(2)),
      isDigital: rest.category === 'pattern',
    };
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      console.log('Updated:', p.name, '→', p.category, data.isDigital ? '(digital)' : '');
    } else {
      const product = await prisma.product.create({ data });
      console.log('Created:', product.name, '£' + product.priceGBP);
    }
  }

  // Retire legacy demo products that don't fit the new taxonomy.
  const legacy = ['Fusiey Starter Kit', 'DIY Bead Canvas Set', 'Tweezers Pro Pack', 'Rainbow Bead Box (5000pcs)'];
  for (const name of legacy) {
    const old = await prisma.product.findFirst({ where: { name } });
    if (old) {
      await prisma.product.update({ where: { id: old.id }, data: { isActive: false } });
      console.log('Retired legacy:', name);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
