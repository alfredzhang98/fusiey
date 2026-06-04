import { Router } from 'express';

export const productRoutes = Router();

// TODO: Phase 3 - Product management
// GET    /api/products          - List products
// GET    /api/products/:id      - Get product detail
// POST   /api/products          - Create product (admin)
// PATCH  /api/products/:id      - Update product (admin)
// DELETE /api/products/:id      - Delete product (admin)

productRoutes.get('/', (_req, res) => {
  res.json({ message: 'Product routes - coming soon' });
});
