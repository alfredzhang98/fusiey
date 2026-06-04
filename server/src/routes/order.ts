import { Router } from 'express';

export const orderRoutes = Router();

// TODO: Phase 3 - Order management
// GET    /api/orders          - List orders (admin) / user orders
// GET    /api/orders/:id      - Get order detail
// POST   /api/orders          - Create order
// PATCH  /api/orders/:id      - Update order status
// DELETE /api/orders/:id      - Cancel order

orderRoutes.get('/', (_req, res) => {
  res.json({ message: 'Order routes - coming soon' });
});
