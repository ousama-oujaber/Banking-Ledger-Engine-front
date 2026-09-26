import { expect, type Page } from '@playwright/test';
import { MOCK_TOKENS } from '../fixtures/jwt-tokens';

export class AdminSettlementReconPage {
  constructor(public readonly page: Page) {}

  async injectAuthSession(token = MOCK_TOKENS.operator) {
    await this.page.addInitScript((jwtToken: string) => {
      window.sessionStorage.setItem('ble_auth_token', jwtToken);
    }, token);
  }

  async goto() {
    await this.page.goto('/recon');
    await expect(this.page.locator('[data-testid="recon-hub"]')).toBeVisible();
  }

  async selectSettlementBatchesTab() {
    await this.page.locator('[data-testid="tab-settlement-batches"]').click();
    await expect(this.page.locator('[data-testid="tab-content-batches"]')).toBeVisible();
  }

  async selectReconCasesTab() {
    await this.page.locator('[data-testid="tab-recon-cases"]').click();
    await expect(this.page.locator('[data-testid="tab-content-cases"]')).toBeVisible();
  }

  // Settlement Batches Actions
  async openCreateBatchModal() {
    await this.page.locator('[data-testid="settlement-create-btn"]').click();
    await expect(this.page.locator('[data-testid="create-batch-dialog"]')).toBeVisible();
  }

  async submitCreateBatch() {
    await this.page.locator('[data-testid="create-batch-submit-btn"]').click();
    await expect(this.page.locator('[data-testid="create-batch-dialog"]')).toBeHidden();
  }

  async triggerSettleBatch(batchId: string, extRef = 'EXT-SEPA-SETTLED-99') {
    const settleBtn = this.page.locator(`[data-testid="settle-batch-btn-${batchId}"]`);
    await settleBtn.click();

    const settleDialog = this.page.locator('[data-testid="settle-batch-dialog"]');
    await expect(settleDialog).toBeVisible();

    await this.page.locator('[data-testid="settle-ext-ref-input"]').fill(extRef);
    await this.page.locator('[data-testid="settle-batch-submit-btn"]').click();
    await expect(settleDialog).toBeHidden();
  }

  // Reconciliation Cases Actions
  async openCaseDrawer() {
    const inspectBtn = this.page.locator('[data-testid="row-inspect-btn"]').first();
    await inspectBtn.click();
    await expect(this.page.locator('[data-testid="case-drawer"]')).toBeVisible();
  }

  async openResolveModal() {
    const resolveBtn = this.page.locator('[data-testid="row-resolve-btn"]').first();
    await resolveBtn.click();
    await expect(this.page.locator('[data-testid="resolve-case-dialog"]')).toBeVisible();
  }

  async submitResolveCase(notes = 'Resolved via timing difference adjustment') {
    await this.page.locator('[data-testid="resolve-notes-textarea"]').fill(notes);
    await this.page.locator('[data-testid="resolve-submit-btn"]').click();
    await expect(this.page.locator('[data-testid="resolve-case-dialog"]')).toBeHidden();
  }
}
