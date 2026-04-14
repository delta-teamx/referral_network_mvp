import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/**
 * Process-wide Prisma client. Don't construct PrismaClient anywhere else —
 * creating multiple instances opens multiple connection pools.
 *
 * Log level is noisy in dev (query + info + warn + error) but quiet in
 * prod (warn + error). Wire up a structured logger in a later branch.
 */
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
});

/** Graceful shutdown — closes pool on SIGINT/SIGTERM. */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
