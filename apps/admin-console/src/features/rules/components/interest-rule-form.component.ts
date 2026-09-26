import {
  Component,
  signal,
  computed,
  Input,
  Output,
  EventEmitter,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RuleAdminService } from '../services/rule-admin.service';
import type { InterestRuleResponse, CreateInterestRuleRequest } from '@ble-frontend/api-client';

/**
 * InterestRuleFormComponent
 *
 * Standalone Angular 19 modal drawer component for creating and configuring interest rate rules.
 * Supports CREDIT and DEBIT interest, day count conventions (ACT_365, ACT_360, THIRTY_360, ACT_ACT),
 * and balance bases (LEDGER_BALANCE, AVAILABLE_BALANCE).
 */
@Component({
  selector: 'ble-interest-rule-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="interest-rule-form-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interest-rule-form-title"
        data-testid="interest-rule-form-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">📈</span>
            <div>
              <h3 id="interest-rule-form-title" class="title-text">Create Interest Rate Rule</h3>
              <p class="subtitle-text">
                Configure yield schedules, day count conventions, and balance thresholds
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            [disabled]="submitting()"
          >
            ✕
          </button>
        </div>

        <!-- Server Error Banner -->
        <div *ngIf="error()" class="error-banner" data-testid="interest-rule-error">
          <span class="error-icon">⚠</span>
          <span class="error-text">{{ error() }}</span>
        </div>

        <!-- Form Body -->
        <div class="modal-body">
          <!-- Rule Code & Product Code -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="int-rule-code">
                Rule Code <span class="required">*</span>
              </label>
              <input
                id="int-rule-code"
                type="text"
                class="form-input font-mono"
                [ngModel]="code()"
                (ngModelChange)="code.set($event.toUpperCase())"
                placeholder="SAV_EUR_HIGH_YIELD"
                data-testid="int-rule-code-input"
                [disabled]="submitting()"
              />
              <span class="field-hint" [class.field-error]="code().length > 0 && !isCodeValid()">
                Uppercase alphanumeric with underscores (min 3 chars)
              </span>
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="int-product-code">
                Target Product <span class="required">*</span>
              </label>
              <select
                id="int-product-code"
                class="form-select font-mono"
                [ngModel]="productCode()"
                (ngModelChange)="productCode.set($event)"
                data-testid="int-product-select"
                [disabled]="submitting()"
              >
                <option value="SAVINGS_CLASSIC">SAVINGS_CLASSIC (Standard Retail)</option>
                <option value="CLASSIC_CHECKING">CLASSIC_CHECKING (Current/DDA)</option>
                <option value="ESCROW_VAULT">ESCROW_VAULT (Restricted Custody)</option>
                <option value="SETTLEMENT_CORE">SETTLEMENT_CORE (Institutional)</option>
              </select>
            </div>
          </div>

          <!-- Interest Type & Annual Rate -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">Interest Direction</label>
              <div class="direction-switch">
                <button
                  type="button"
                  class="direction-btn"
                  [class.active]="interestType() === 'CREDIT'"
                  (click)="interestType.set('CREDIT')"
                >
                  <span class="dir-title">CREDIT</span>
                  <span class="dir-desc">Deposit yield paid to customer</span>
                </button>
                <button
                  type="button"
                  class="direction-btn"
                  [class.active]="interestType() === 'DEBIT'"
                  (click)="interestType.set('DEBIT')"
                >
                  <span class="dir-title">DEBIT</span>
                  <span class="dir-desc">Overdraft penalty charged to customer</span>
                </button>
              </div>
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="int-annual-rate">
                Annual Rate (%) <span class="required">*</span>
              </label>
              <input
                id="int-annual-rate"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                class="form-input font-mono"
                [ngModel]="annualRate()"
                (ngModelChange)="annualRate.set($event)"
                placeholder="3.75"
                data-testid="annual-rate-input"
                [disabled]="submitting()"
              />
              <span class="field-hint">e.g. 3.75 for 3.75% per annum</span>
            </div>
          </div>

          <!-- Day Count Accrual Basis & Balance Basis -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="int-accrual-basis">Day Count Accrual Basis</label>
              <select
                id="int-accrual-basis"
                class="form-select font-mono"
                [ngModel]="accrualBasis()"
                (ngModelChange)="accrualBasis.set($event)"
                data-testid="accrual-basis-select"
                [disabled]="submitting()"
              >
                <option value="ACT_365">ACT_365 (Actual / 365 Days - Standard GBP/EUR)</option>
                <option value="ACT_360">ACT_360 (Actual / 360 Days - Money Market USD)</option>
                <option value="THIRTY_360">THIRTY_360 (30 / 360 Days - Eurobond Standard)</option>
                <option value="ACT_ACT">ACT_ACT (Actual / Actual - Treasury Standard)</option>
              </select>
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="int-balance-basis">Balance Basis</label>
              <select
                id="int-balance-basis"
                class="form-select font-mono"
                [ngModel]="balanceBasis()"
                (ngModelChange)="balanceBasis.set($event)"
                data-testid="balance-basis-select"
                [disabled]="submitting()"
              >
                <option value="LEDGER_BALANCE">LEDGER_BALANCE (Posted Ledger Balance)</option>
                <option value="AVAILABLE_BALANCE">AVAILABLE_BALANCE (Ledger - Active Holds)</option>
              </select>
            </div>
          </div>

          <!-- Min Eligible Balance & Clearing Account -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="int-min-balance"
                >Minimum Eligible Balance (Optional)</label
              >
              <input
                id="int-min-balance"
                type="number"
                min="0"
                step="0.01"
                class="form-input font-mono"
                [ngModel]="minEligibleBalance()"
                (ngModelChange)="minEligibleBalance.set($event)"
                placeholder="100.00"
                data-testid="min-balance-input"
                [disabled]="submitting()"
              />
              <span class="field-hint">Accounts below this balance earn 0.00%</span>
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="int-account-id">Expense / Revenue Account ID</label>
              <input
                id="int-account-id"
                type="text"
                class="form-input font-mono"
                [ngModel]="interestAccountId()"
                (ngModelChange)="interestAccountId.set($event)"
                placeholder="acc-interest-expense-01"
                data-testid="interest-account-input"
                [disabled]="submitting()"
              />
              <span class="field-hint">Bank GL contra account for paid/collected interest</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
            type="button"
            class="btn-cancel"
            (click)="handleCancel()"
            [disabled]="submitting()"
            data-testid="int-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-submit"
            (click)="submit()"
            [disabled]="!isSubmitEnabled() || submitting()"
            data-testid="int-submit-btn"
          >
            <span *ngIf="submitting()" class="spinner"></span>
            <span>Create Interest Rule</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(11, 17, 32, 0.78);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
      }

      .modal-dialog {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 10px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        width: 100%;
        max-width: 660px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: rgba(15, 23, 42, 0.6);
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .header-titles {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon {
        font-size: 20px;
      }

      .title-text {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .subtitle-text {
        margin: 0;
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 16px;
        cursor: pointer;
      }

      .error-banner {
        background: rgba(239, 68, 68, 0.15);
        border-bottom: 1px solid rgba(239, 68, 68, 0.3);
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f87171;
        font-size: 12px;
      }

      .modal-body {
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-row {
        display: flex;
        gap: 14px;
      }

      .flex-1 {
        flex: 1;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--ble-color-text-secondary, #94a3b8);
        text-transform: uppercase;
      }

      .required {
        color: #ef4444;
      }

      .direction-switch {
        display: flex;
        gap: 8px;
      }

      .direction-btn {
        flex: 1;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 8px 10px;
        text-align: left;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
        transition: all 0.15s ease;
      }

      .direction-btn.active {
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.15);
      }

      .dir-title {
        font-size: 12px;
        font-weight: 700;
        color: #f8fafc;
      }

      .direction-btn.active .dir-title {
        color: #60a5fa;
      }

      .dir-desc {
        font-size: 10px;
        color: #94a3b8;
      }

      .form-input,
      .form-select {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 12px;
        outline: none;
      }

      .form-input:focus,
      .form-select:focus {
        border-color: #3b82f6;
      }

      .field-hint {
        font-size: 10px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .field-error {
        color: #ef4444;
      }

      .modal-footer {
        padding: 14px 20px;
        border-top: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.6);
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .btn-cancel {
        background: transparent;
        border: 1px solid #475569;
        color: #94a3b8;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      }

      .btn-submit {
        background: #3b82f6;
        border: none;
        color: #ffffff;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-submit:hover:not(:disabled) {
        background: #2563eb;
      }

      .btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class InterestRuleFormComponent {
  private adminService: RuleAdminService;

  readonly isOpen = signal<boolean>(false);
  @Input('isOpen') set isOpenInput(val: boolean) {
    this.isOpen.set(val);
  }

  @Output() readonly onClose = new EventEmitter<void>();
  @Output() readonly onSuccess = new EventEmitter<InterestRuleResponse>();

  readonly code = signal<string>('');
  readonly productCode = signal<string>('SAVINGS_CLASSIC');
  readonly interestType = signal<'CREDIT' | 'DEBIT'>('CREDIT');
  readonly annualRate = signal<number | undefined>(undefined);
  readonly accrualBasis = signal<'ACT_365' | 'ACT_360' | 'THIRTY_360' | 'ACT_ACT'>('ACT_365');
  readonly balanceBasis = signal<'LEDGER_BALANCE' | 'AVAILABLE_BALANCE'>('LEDGER_BALANCE');
  readonly minEligibleBalance = signal<number | undefined>(undefined);
  readonly interestAccountId = signal<string>('');
  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly isCodeValid = computed<boolean>(() => {
    return /^[A-Z0-9_]{3,30}$/.test(this.code().trim());
  });

  readonly isRateValid = computed<boolean>(() => {
    const r = this.annualRate();
    return r !== undefined && r !== null && Number(r) > 0 && Number(r) <= 100;
  });

  readonly isSubmitEnabled = computed<boolean>(() => {
    return (
      this.isCodeValid() &&
      this.productCode().trim().length > 0 &&
      this.isRateValid() &&
      !this.submitting()
    );
  });

  constructor(service?: RuleAdminService) {
    if (service) {
      this.adminService = service;
    } else {
      this.adminService = inject(RuleAdminService);
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen() && !this.submitting()) {
      this.handleCancel();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop') && !this.submitting()) {
      this.handleCancel();
    }
  }

  handleCancel(): void {
    this.code.set('');
    this.annualRate.set(undefined);
    this.minEligibleBalance.set(undefined);
    this.interestAccountId.set('');
    this.error.set(null);
    this.submitting.set(false);
    this.isOpen.set(false);
    this.onClose.emit();
  }

  async submit(): Promise<void> {
    if (!this.isSubmitEnabled()) return;

    this.submitting.set(true);
    this.error.set(null);

    const payload: CreateInterestRuleRequest = {
      code: this.code().trim(),
      productCode: this.productCode().trim(),
      interestType: this.interestType(),
      annualRate: Number(this.annualRate()),
      accrualBasis: this.accrualBasis(),
      balanceBasis: this.balanceBasis(),
      minEligibleBalance:
        this.minEligibleBalance() !== undefined && this.minEligibleBalance() !== null
          ? { amount: Number(this.minEligibleBalance()), currency: 'EUR' }
          : undefined,
      interestAccountId:
        this.interestAccountId().trim().length > 0 ? this.interestAccountId().trim() : undefined,
    };

    try {
      const created = await this.adminService.createInterestRule(payload);
      this.onSuccess.emit(created);
      this.handleCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create interest rule';
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
