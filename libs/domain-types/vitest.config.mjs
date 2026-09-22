import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'libs/domain-types',
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
