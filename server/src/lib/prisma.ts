/**
 * Prisma client singleton.
 *
 * Prisma's client is heavy (holds a DB connection pool). In development,
 * Vite's HMR / tsx watch restart the module graph and would otherwise
 * create a new PrismaClient on every file change → exhausted connections.
 * Stash the instance on globalThis so reloads reuse it.
 */

import { PrismaClient } from '../../../generated/prisma/client.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7's constructor signature wants accelerateUrl even for local DB;
// cast to any to avoid that when we're using DATABASE_URL from .env.
export const prisma =
  globalForPrisma.prisma ?? (new (PrismaClient as any)());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
