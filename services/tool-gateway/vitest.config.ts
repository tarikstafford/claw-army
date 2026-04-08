import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    conditions: ['@claw/source', 'module', 'import', 'default'],
    alias: {
      '@claw/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@claw/tool-contracts': path.resolve(__dirname, '../../packages/tool-contracts/src/index.ts'),
      '@claw/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  test: {
    globals: true,
    testTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
    },
  },
});
