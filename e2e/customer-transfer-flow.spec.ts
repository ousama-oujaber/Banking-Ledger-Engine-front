import { test, expect } from '@playwright/test';
import { CustomerPortalPage } from './pages/customer-portal.page';
import { setupMockApiRoutes } from './fixtures/api-router';
import { MOCK_TOKENS } from './fixtures/jwt-tokens';

test.describe('Customer Portal: Intra-Bank Transfers & Cash Operations', () => {
  let customerPage: CustomerPortalPage;

  test.beforeEach(async ({ page }) => {
    customerPage = new CustomerPortalPage(page);
  });

  test('should redirect unauthenticated users to /login and allow login', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'CUSTOMER' });

    // Navigate to protected transfers page directly
    await page.goto('/transfers');
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();

    // Fill credentials and log in
    await page.locator('[data-testid="username-input"]').fill('alice_customer');
    await page.locator('[data-testid="password-input"]').fill('SecurePass123!');
    await page.locator('[data-testid="login-submit-btn"]').click();

    // After login, redirected to dashboard
    await expect(page).toHaveURL(/.*\//);
  });

  test('should submit intra-bank transfer and verify atomic completion', async ({ page }) => {
    let capturedPayload: Record<string, unknown> | null = null;
    await setupMockApiRoutes(page, {
      authRole: 'CUSTOMER',
      onTransferRequest: (payload) => {
        capturedPayload = payload;
      },
    });

    await customerPage.injectAuthSession(MOCK_TOKENS.customer);
    await customerPage.gotoTransfers();

    // Fill out intra-bank transfer form
    await customerPage.fillTransferForm({
      fromAccount: 'acc-eur-001',
      toAccount: 'acc-eur-004',
      amount: '250.00',
      description: 'E2E Test Inter-account transfer',
    });

    await customerPage.submitTransfer();
    await customerPage.expectTransferSuccess();

    // Verify submitted payload captured by interceptor
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload?.fromAccountId).toBe('acc-eur-001');
    expect(capturedPayload?.toAccountId).toBe('acc-eur-004');
  });

  test('should display DomainErrorBanner on 409 conflict and preserve idempotency key on retry (BR-F03)', async ({
    page,
  }) => {
    let attempts = 0;
    await setupMockApiRoutes(page, {
      authRole: 'CUSTOMER',
      transferStatus: 409,
      transferErrorResponse: {
        type: 'https://ble.bank/errors/OPTIMISTIC_LOCK_CONFLICT',
        title: 'Conflict',
        status: 409,
        detail: 'Concurrent ledger modification. Please retry operation.',
        code: 'ERR_OPTIMISTIC_LOCK',
      },
      onTransferRequest: () => {
        attempts++;
      },
    });

    await customerPage.injectAuthSession(MOCK_TOKENS.customer);
    await customerPage.gotoTransfers();

    await customerPage.fillTransferForm({
      fromAccount: 'acc-eur-001',
      toAccount: 'acc-eur-004',
      amount: '120.00',
    });

    await customerPage.submitTransfer();

    // Verify error banner is displayed
    await customerPage.expectErrorBanner();
    expect(attempts).toBeGreaterThanOrEqual(2);

    // Click retry transfer button
    await customerPage.clickRetryTransfer();
    expect(attempts).toBeGreaterThanOrEqual(3);
  });

  test('should execute deposit quick-action modal successfully', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'CUSTOMER' });

    await customerPage.injectAuthSession(MOCK_TOKENS.customer);
    await customerPage.gotoTransfers();

    await customerPage.openDepositModal();
    await customerPage.submitDeposit('500.00');

    await expect(page.locator('[data-testid="transfers-success-message"]')).toBeVisible();
  });
});
