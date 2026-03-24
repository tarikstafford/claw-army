import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Honor the @claw/source custom export condition used by workspace packages.
    conditions: ['@claw/source', 'module', 'import', 'default'],
    alias: {
      '@claw/db': path.resolve(__dirname, '../../../packages/db/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
});
