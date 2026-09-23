import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'apps/customer-portal',
  plugins: [react()],
  resolve: {
    alias: {
      '@ble-frontend/domain-types': path.resolve(
        import.meta.dirname,
        '../../libs/domain-types/src/index.ts',
      ),
      '@ble-frontend/api-client': path.resolve(
        import.meta.dirname,
        '../../libs/api-client/src/index.ts',
      ),
      '@ble-frontend/auth': path.resolve(import.meta.dirname, '../../libs/auth/src/index.ts'),
      '@ble-frontend/tokens': path.resolve(import.meta.dirname, '../../libs/tokens/src/index.ts'),
    },
  },
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
