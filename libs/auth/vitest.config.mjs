import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: 'libs/auth',
  resolve: {
    alias: {
      '@ble-frontend/domain-types': path.resolve(__dirname, '../domain-types/src/index.ts'),
      '@ble-frontend/auth': path.resolve(__dirname, './src/index.ts'),
      '@ble-frontend/tokens': path.resolve(__dirname, '../tokens/src/index.ts'),
      '@ble-frontend/api-client': path.resolve(__dirname, '../api-client/src/index.ts'),
    },
  },
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
