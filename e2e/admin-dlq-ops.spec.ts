import { test, expect } from '@playwright/test';
import { AdminDlqPage } from './pages/admin-dlq.page';
import { setupMockApiRoutes } from './fixtures/api-router';
import { MOCK_TOKENS } from './fixtures/jwt-tokens';

test.describe('Admin Console: Dead-Letter Queue (DLQ) Ops & Broker Diagnostics', () => {
  let dlqPage: AdminDlqPage;

  test.beforeEach(async ({ page }) => {
    dlqPage = new AdminDlqPage(page);
  });

  test('should render DLQ ops workspace with observability KPIs and failed events', async ({
    page,
  }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await dlqPage.injectAuthSession(MOCK_TOKENS.operator);

    await dlqPage.goto();
    await dlqPage.expectKpis();

    // Verify events table contains the dead-lettered message
    await expect(page.locator('[data-testid="dlq-event-row"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="event-status-chip"]').first()).toContainText(
      'PENDING',
    );
  });

  test('should open slide-over drawer to inspect stack trace and event payload', async ({
    page,
  }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await dlqPage.injectAuthSession(MOCK_TOKENS.operator);

    await dlqPage.goto();
    await dlqPage.openEventDrawer();

    // Verify stack trace & payload inspection sections
    await expect(page.locator('[data-testid="drawer-stacktrace"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-payload"]')).toBeVisible();
  });

  test('should trigger event replay modal and confirm re-queueing', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await dlqPage.injectAuthSession(MOCK_TOKENS.operator);

    await dlqPage.goto();
    await dlqPage.triggerReplay();

    // Verify toast confirmation
    await expect(page.locator('[data-testid="dlq-toast"]')).toBeVisible();
  });

  test('should trigger discard safeguard modal and confirm message purging', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await dlqPage.injectAuthSession(MOCK_TOKENS.operator);

    await dlqPage.goto();
    await dlqPage.triggerDiscard();

    // Verify toast confirmation
    await expect(page.locator('[data-testid="dlq-toast"]')).toBeVisible();
  });
});
