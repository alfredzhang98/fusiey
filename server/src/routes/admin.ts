import { Router } from 'express';

export const adminRoutes = Router();

// TODO: Phase 4 - Admin management
// GET    /api/admin/dashboard     - Dashboard stats
// GET    /api/admin/inventory     - Inventory management
// GET    /api/admin/logistics     - Logistics management
// GET    /api/admin/customers     - Customer service
// PATCH  /api/admin/config        - Site configuration

adminRoutes.get('/dashboard', (_req, res) => {
  res.json({ message: 'Admin routes - coming soon' });
});
