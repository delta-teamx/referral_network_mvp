/**
 * Seed script stub.
 *
 * Branch 1 deliberately keeps this minimal — just proves the seed pipeline
 * executes. Real seed data (20+ categories, EventCategoryMap rows, 100+ test
 * listings, sample users/reviews/referrals) lands with Branch 3 (Directory)
 * and Branch 4 (Life Events Connector).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // TODO (Branch 3): seed CATEGORY_SEEDS from @refnet/shared into Category.
  // TODO (Branch 4): seed EventCategoryMap from the spec's event→category matrix.
  // TODO (Branch 3): seed 100+ test listings around St. Louis, MO.
  // eslint-disable-next-line no-console
  console.log('[seed] Branch 1 stub — no rows written. Real seed data lands in later branches.');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
