import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'libs/tokens',
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
