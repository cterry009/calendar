import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same source alias vite.config.ts uses, so tests exercise the shared package's current
    // source instead of whatever its dist/ last built.
    alias: {
      '@calendar/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
