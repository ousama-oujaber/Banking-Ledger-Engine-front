import { expect, type Page } from '@playwright/test';
import { MOCK_TOKENS } from '../fixtures/jwt-tokens';

export class CustomerPortalPage {
  constructor(public readonly page: Page) {}

  /**
   * Injects an authenticated JWT token into sessionStorage.
   */
  async injectAuthSession(token = MOCK_TOKENS.customer) {
    await this.page.addInitScript((jwtToken: string) => {
      window.sessionStorage.setItem('ble_auth_token', jwtToken);
    }, token);
  }

  async gotoLogin() {
    await this.page.goto('/login');
  }

  async gotoDashboard() {
    await this.page.goto('/');
  }

  async gotoTransfers() {
    await this.page.goto('/transfers');
    await expect(this.page.locator('[data-testid="transfers-page"]')).toBeVisible();
  }

  async fillTransferForm(options: {
    fromAccount?: string;
    toAccount: string;
    amount: string;
    reference?: string;
    description?: string;
  }) {
    if (options.fromAccount) {
      await this.page
        .locator('[data-testid="from-account-select"]')
        .selectOption(options.fromAccount);
    }
    await this.page.locator('[data-testid="to-account-input"]').fill(options.toAccount);
    await this.page.locator('[data-testid="transfer-amount-input"]').fill(options.amount);

    if (options.reference) {
      await this.page.locator('[data-testid="transfer-reference-input"]').fill(options.reference);
    }
    if (options.description) {
      await this.page
        .locator('[data-testid="transfer-description-input"]')
        .fill(options.description);
    }
  }

  async submitTransfer() {
    await this.page.locator('[data-testid="transfer-submit-btn"]').click();
  }

  async expectTransferSuccess() {
    // Check either success alert or confirmation modal
    const alert = this.page.locator('[data-testid="transfers-success-message"]');
    const modal = this.page.locator('[data-testid="transfer-confirmation-modal"]');
    await expect(alert.or(modal).first()).toBeVisible();
  }

  async expectErrorBanner() {
    await expect(this.page.locator('[data-testid="transfer-error-banner"]')).toBeVisible();
  }

  async clickRetryTransfer() {
    await this.page.locator('[data-testid="transfer-retry-btn"]').click();
  }

  async openDepositModal() {
    await this.page.locator('[data-testid="open-deposit-btn"]').click();
    await expect(this.page.locator('[data-testid="deposit-withdraw-modal"]')).toBeVisible();
  }

  async submitDeposit(amount: string) {
    await this.page.locator('[data-testid="dw-amount-input"]').fill(amount);
    await this.page.locator('[data-testid="dw-submit-btn"]').click();
  }
}
