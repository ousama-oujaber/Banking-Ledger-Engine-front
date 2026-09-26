import { expect, type Page } from '@playwright/test';
import { MOCK_TOKENS } from '../fixtures/jwt-tokens';

export class AdminAccountsPage {
  constructor(public readonly page: Page) {}

  /**
   * Injects an authenticated operator JWT token into sessionStorage.
   */
  async injectAuthSession(token = MOCK_TOKENS.operator) {
    await this.page.addInitScript((jwtToken: string) => {
      window.sessionStorage.setItem('ble_auth_token', jwtToken);
    }, token);
  }

  async goto() {
    await this.page.goto('/accounts');
    await expect(this.page.locator('[data-testid="account-workspace"]')).toBeVisible();
  }

  async search(query: string) {
    const input = this.page.locator('[data-testid="account-search-input"]');
    await input.fill(query);
  }

  async filterByStatus(status: string) {
    await this.page.locator('[data-testid="account-status-filter"]').selectOption(status);
  }

  async filterByType(type: string) {
    await this.page.locator('[data-testid="account-type-filter"]').selectOption(type);
  }

  async triggerFreeze(accountId: string, reason = 'Suspicious velocity detected by AML monitor') {
    const freezeBtn = this.page.locator(`[data-testid="action-freeze-${accountId}"]`);
    await freezeBtn.click();

    const dialog = this.page.locator('[data-testid="lifecycle-modal-dialog"]');
    await expect(dialog).toBeVisible();

    await this.page.locator('[data-testid="freeze-reason-input"]').fill(reason);
    await this.page.locator('[data-testid="modal-submit-btn"]').click();
    await expect(dialog).toBeHidden();
  }

  async triggerUnfreeze(accountId: string, reason = 'Compliance documents verified and cleared') {
    const unfreezeBtn = this.page.locator(`[data-testid="action-unfreeze-${accountId}"]`);
    await unfreezeBtn.click();

    const dialog = this.page.locator('[data-testid="lifecycle-modal-dialog"]');
    await expect(dialog).toBeVisible();

    await this.page.locator('[data-testid="unfreeze-reason-input"]').fill(reason);
    await this.page.locator('[data-testid="modal-submit-btn"]').click();
    await expect(dialog).toBeHidden();
  }

  async expectAccountRow(accountId: string) {
    await expect(this.page.locator(`[data-testid="account-row-${accountId}"]`)).toBeVisible();
  }

  async expectStatusBadge(accountId: string, expectedStatus: string) {
    const badge = this.page.locator(`[data-testid="status-badge-${accountId}"]`);
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(expectedStatus);
  }
}
