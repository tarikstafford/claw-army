import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Honor the @claw/source custom export condition used by workspace packages.
    // Without this, Vite resolves @claw/db to ./dist/index.js which doesn't exist
    // (no build step in local dev). The @claw/source condition points to ./src/index.ts.
    conditions: ['@claw/source', 'module', 'import', 'default'],
    alias: {
      // Direct source alias fallback for workspace packages
      '@claw/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@claw/shared-types': path.resolve(
        __dirname,
        '../../packages/shared-types/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
});
