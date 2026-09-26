import { test, expect } from '@playwright/test';
import { AdminAccountsPage } from './pages/admin-accounts.page';
import { setupMockApiRoutes } from './fixtures/api-router';
import { MOCK_TOKENS } from './fixtures/jwt-tokens';

test.describe('Admin Console: Account Directory & Lifecycle State Transitions', () => {
  let accountsPage: AdminAccountsPage;

  test.beforeEach(async ({ page }) => {
    accountsPage = new AdminAccountsPage(page);
  });

  test('should enforce RBAC: redirect unauthenticated to /login and customer to /access-denied', async ({
    page,
  }) => {
    await setupMockApiRoutes(page);

    // Unauthenticated attempt
    await page.goto('/accounts');
    await expect(page).toHaveURL(/.*login/);

    // Authenticated with CUSTOMER role (unauthorized for admin console)
    await accountsPage.injectAuthSession(MOCK_TOKENS.customer);
    await page.goto('/accounts');
    await expect(page).toHaveURL(/.*access-denied/);
  });

  test('should load accounts directory and filter by search query', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await accountsPage.injectAuthSession(MOCK_TOKENS.operator);

    await accountsPage.goto();

    // Verify all initial accounts are visible
    await accountsPage.expectAccountRow('acc-eur-001');
    await accountsPage.expectAccountRow('acc-usd-002');

    // Filter by search query matching label
    await accountsPage.search('Operating');
    await accountsPage.expectAccountRow('acc-eur-001');
    await expect(page.locator('[data-testid="account-row-acc-usd-002"]')).toBeHidden();
  });

  test('should execute account freeze lifecycle modal and update status badge', async ({
    page,
  }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await accountsPage.injectAuthSession(MOCK_TOKENS.operator);

    await accountsPage.goto();
    await accountsPage.expectStatusBadge('acc-eur-001', 'ACTIVE');

    // Trigger Freeze
    await accountsPage.triggerFreeze(
      'acc-eur-001',
      'Suspicious velocity detected by transaction risk engine',
    );

    // Verify status badge changed to FROZEN
    await accountsPage.expectStatusBadge('acc-eur-001', 'FROZEN');
  });

  test('should execute account unfreeze lifecycle modal and restore active status', async ({
    page,
  }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await accountsPage.injectAuthSession(MOCK_TOKENS.operator);

    await accountsPage.goto();

    // First freeze
    await accountsPage.triggerFreeze('acc-eur-001', 'Temporary compliance hold');
    await accountsPage.expectStatusBadge('acc-eur-001', 'FROZEN');

    // Then unfreeze
    await accountsPage.triggerUnfreeze(
      'acc-eur-001',
      'Customer identity documentation re-verified',
    );
    await accountsPage.expectStatusBadge('acc-eur-001', 'ACTIVE');
  });
});
