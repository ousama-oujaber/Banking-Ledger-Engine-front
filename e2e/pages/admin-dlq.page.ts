import { expect, type Page } from '@playwright/test';
import { MOCK_TOKENS } from '../fixtures/jwt-tokens';

export class AdminDlqPage {
  constructor(public readonly page: Page) {}

  async injectAuthSession(token = MOCK_TOKENS.operator) {
    await this.page.addInitScript((jwtToken: string) => {
      window.sessionStorage.setItem('ble_auth_token', jwtToken);
    }, token);
  }

  async goto() {
    await this.page.goto('/dlq');
    await expect(this.page.locator('[data-testid="dlq-workspace"]')).toBeVisible();
  }

  async expectKpis() {
    await expect(this.page.locator('[data-testid="kpi-pending-dlq"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="kpi-replayed-dlq"]')).toBeVisible();
    await expect(this.page.locator('[data-testid="kpi-broker-health"]')).toBeVisible();
  }

  async openEventDrawer() {
    const inspectBtn = this.page.locator('[data-testid="row-inspect-btn"]').first();
    await inspectBtn.click();
    await expect(this.page.locator('[data-testid="dlq-event-drawer"]')).toBeVisible();
  }

  async triggerReplay() {
    const replayBtn = this.page.locator('[data-testid="row-replay-btn"]').first();
    await replayBtn.click();

    const dialog = this.page.locator('[data-testid="replay-confirm-dialog"]');
    await expect(dialog).toBeVisible();

    await this.page.locator('[data-testid="replay-confirm-btn"]').click();
    await expect(dialog).toBeHidden();
  }

  async triggerDiscard() {
    const discardBtn = this.page.locator('[data-testid="row-discard-btn"]').first();
    await discardBtn.click();

    const dialog = this.page.locator('[data-testid="discard-confirm-dialog"]');
    await expect(dialog).toBeVisible();

    await this.page.locator('[data-testid="discard-confirm-btn"]').click();
    await expect(dialog).toBeHidden();
  }
}
