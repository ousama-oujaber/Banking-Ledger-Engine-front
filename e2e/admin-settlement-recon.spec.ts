import { test, expect } from '@playwright/test';
import { AdminSettlementReconPage } from './pages/admin-settlement-recon.page';
import { setupMockApiRoutes } from './fixtures/api-router';
import { MOCK_TOKENS } from './fixtures/jwt-tokens';

test.describe('Admin Console: Settlement Batches & Reconciliation Hub', () => {
  let reconPage: AdminSettlementReconPage;

  test.beforeEach(async ({ page }) => {
    reconPage = new AdminSettlementReconPage(page);
  });

  test('should display settlement batches dashboard with KPI summary and batches table', async ({
    page,
  }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await reconPage.injectAuthSession(MOCK_TOKENS.operator);

    await reconPage.goto();
    await reconPage.selectSettlementBatchesTab();

    // Verify KPIs
    await expect(page.locator('[data-testid="kpi-total-batches"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-open-batches"]')).toBeVisible();

    // Verify batch row
    await expect(page.locator('[data-testid="batch-row-batch-sepa-001"]')).toBeVisible();
  });

  test('should open create batch modal and append newly created batch', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await reconPage.injectAuthSession(MOCK_TOKENS.operator);

    await reconPage.goto();
    await reconPage.selectSettlementBatchesTab();

    await reconPage.openCreateBatchModal();
    await reconPage.submitCreateBatch();

    // Verify success banner or notification
    await expect(page.locator('[data-testid="settlement-toast"]')).toBeVisible();
  });

  test('should trigger settlement execution and update batch status', async ({ page }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await reconPage.injectAuthSession(MOCK_TOKENS.operator);

    await reconPage.goto();
    await reconPage.selectSettlementBatchesTab();

    // Settle open batch
    await reconPage.triggerSettleBatch('batch-sepa-001');
    await expect(page.locator('[data-testid="settlement-toast"]')).toBeVisible();
  });

  test('should switch to reconciliation cases tab and resolve discrepancy case', async ({
    page,
  }) => {
    await setupMockApiRoutes(page, { authRole: 'OPERATOR' });
    await reconPage.injectAuthSession(MOCK_TOKENS.operator);

    await reconPage.goto();
    await reconPage.selectReconCasesTab();

    // Verify recon cases workspace
    await expect(page.locator('[data-testid="recon-cases-workspace"]')).toBeVisible();
    await expect(page.locator('[data-testid="recon-case-row"]').first()).toBeVisible();

    // Resolve case
    await reconPage.openResolveModal();
    await reconPage.submitResolveCase('Validated timing difference against bank statement CAMT053');

    // Verify resolve toast notification
    await expect(page.locator('[data-testid="recon-toast"]')).toBeVisible();
  });
});
