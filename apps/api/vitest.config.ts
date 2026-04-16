import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Unit tests below are pure-function — no DB, no network. Keep them fast.
    // Integration tests that need Prisma + a Postgres testcontainer can live
    // under tests/integration/ and be gated by a separate script when added.
  },
  resolve: {
    alias: {
      '@refnet/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
