import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Banking Ledger Engine Frontend Monorepo.
 * Orchestrates tests across Customer Portal (React 19) and Admin Console (Angular 19).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'customer-portal',
      testMatch: /customer-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
      },
    },
    {
      name: 'admin-console',
      testMatch: /admin-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4200',
      },
    },
  ],
  webServer: [
    {
      command: 'npx vite apps/customer-portal --port 3001',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'npx ng serve admin-console --port 4200',
      port: 4200,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
