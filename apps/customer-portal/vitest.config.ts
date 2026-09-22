import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'apps/customer-portal',
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
    },
  },
});
