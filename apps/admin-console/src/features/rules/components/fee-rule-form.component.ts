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
import { FeeTierBuilderComponent } from './fee-tier-builder.component';
import type { FeeRuleResponse, CreateFeeRuleRequest, FeeTierDto } from '@ble-frontend/api-client';

/**
 * FeeRuleFormComponent
 *
 * Standalone Angular 19 modal drawer component for creating and configuring back-office transaction fee rules.
 * Supports FIXED, PERCENTAGE, and progressive TIERED fee calculation models with dynamic threshold caps.
 */
@Component({
  selector: 'ble-fee-rule-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeeTierBuilderComponent],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="fee-rule-form-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fee-rule-form-title"
        data-testid="fee-rule-form-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-title-group">
            <span class="header-icon">⚙</span>
            <div class="header-texts">
              <h3 id="fee-rule-form-title" class="title-text">Create Fee Rule</h3>
              <p class="subtitle-text">
                Configure dynamic transaction fees, tax deduction, and revenue clearing accounts
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
        <div *ngIf="error()" class="error-banner" data-testid="fee-rule-error">
          <span class="error-icon">⚠</span>
          <span class="error-text">{{ error() }}</span>
        </div>

        <!-- Form Body -->
        <div class="modal-body">
          <!-- Identity Row: Code & Friendly Name -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="rule-code">
                Rule Code <span class="required">*</span>
              </label>
              <input
                id="rule-code"
                type="text"
                class="form-input font-mono"
                [ngModel]="code()"
                (ngModelChange)="code.set($event.toUpperCase())"
                placeholder="TRF_EUR_STANDARD"
                data-testid="rule-code-input"
                [disabled]="submitting()"
              />
              <span class="field-hint" [class.field-error]="code().length > 0 && !isCodeValid()">
                Uppercase alphanumeric with underscores (min 3 chars)
              </span>
            </div>

            <div class="form-group flex-2">
              <label class="form-label" for="rule-name">
                Rule Display Name <span class="required">*</span>
              </label>
              <input
                id="rule-name"
                type="text"
                class="form-input"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
                placeholder="Standard Euro Transfer Fee"
                data-testid="rule-name-input"
                [disabled]="submitting()"
              />
            </div>
          </div>

          <!-- Transaction Type & Currency -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="tx-type">Transaction Type</label>
              <select
                id="tx-type"
                class="form-select font-mono"
                [ngModel]="transactionType()"
                (ngModelChange)="transactionType.set($event)"
                data-testid="rule-txtype-select"
                [disabled]="submitting()"
              >
                <option value="TRANSFER">TRANSFER (Standard Domestic/SEPA)</option>
                <option value="WITHDRAWAL">WITHDRAWAL (ATM & Branch)</option>
                <option value="DEPOSIT">DEPOSIT (Cash & Cheque)</option>
                <option value="FX_TRANSFER">FX_TRANSFER (Cross-Currency)</option>
                <option value="HOLD_CAPTURE">HOLD_CAPTURE (Auth Settlement)</option>
              </select>
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="rule-currency">Currency</label>
              <select
                id="rule-currency"
                class="form-select font-mono"
                [ngModel]="currency()"
                (ngModelChange)="currency.set($event)"
                data-testid="rule-currency-select"
                [disabled]="submitting()"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="MAD">MAD (DH)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
              </select>
            </div>
          </div>

          <!-- Calculation Model Switcher -->
          <div class="form-group">
            <label class="form-label">Calculation Model <span class="required">*</span></label>
            <div class="model-switcher" data-testid="calc-model-switcher">
              <button
                type="button"
                class="model-tab"
                [class.active]="calculationType() === 'FIXED'"
                (click)="calculationType.set('FIXED')"
              >
                <span class="tab-title">Fixed Amount</span>
                <span class="tab-desc">Constant fee per transaction</span>
              </button>
              <button
                type="button"
                class="model-tab"
                [class.active]="calculationType() === 'PERCENTAGE'"
                (click)="calculationType.set('PERCENTAGE')"
              >
                <span class="tab-title">Percentage Rate</span>
                <span class="tab-desc">Direct proportional percentage</span>
              </button>
              <button
                type="button"
                class="model-tab"
                [class.active]="calculationType() === 'TIERED'"
                (click)="calculationType.set('TIERED')"
              >
                <span class="tab-title">Tiered Brackets</span>
                <span class="tab-desc">Progressive volume rate slabs</span>
              </button>
            </div>
          </div>

          <!-- Model Specific Configuration Fields -->
          <div *ngIf="calculationType() === 'FIXED'" class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="fixed-amount">
                Fixed Fee Amount ({{ currency() }}) <span class="required">*</span>
              </label>
              <input
                id="fixed-amount"
                type="number"
                min="0"
                step="0.01"
                class="form-input font-mono"
                [ngModel]="fixedAmount()"
                (ngModelChange)="fixedAmount.set($event)"
                placeholder="2.50"
                data-testid="fixed-amount-input"
              />
            </div>
          </div>

          <div *ngIf="calculationType() === 'PERCENTAGE'" class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="pct-rate">
                Percentage Rate (%) <span class="required">*</span>
              </label>
              <input
                id="pct-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                class="form-input font-mono"
                [ngModel]="percentageRate()"
                (ngModelChange)="percentageRate.set($event)"
                placeholder="0.25"
                data-testid="percentage-rate-input"
              />
              <span class="field-hint">e.g. 0.25 for 0.25% fee deduction</span>
            </div>
          </div>

          <div *ngIf="calculationType() === 'TIERED'">
            <ble-fee-tier-builder
              [tiers]="tiers()"
              (tiersChange)="onTiersChanged($event)"
            ></ble-fee-tier-builder>
          </div>

          <!-- Boundary Constraints: Min & Max Fee -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="min-fee">Minimum Fee Cap (Optional)</label>
              <input
                id="min-fee"
                type="number"
                min="0"
                step="0.01"
                class="form-input font-mono"
                [ngModel]="minFee()"
                (ngModelChange)="minFee.set($event)"
                placeholder="0.50"
                data-testid="min-fee-input"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label" for="max-fee">Maximum Fee Cap (Optional)</label>
              <input
                id="max-fee"
                type="number"
                min="0"
                step="0.01"
                class="form-input font-mono"
                [ngModel]="maxFee()"
                (ngModelChange)="maxFee.set($event)"
                placeholder="50.00"
                data-testid="max-fee-input"
              />
            </div>
          </div>

          <!-- Accounting Revenue Clearing & Tax Accounts -->
          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label" for="income-acc">
                Fee Income Clearing Account ID <span class="required">*</span>
              </label>
              <input
                id="income-acc"
                type="text"
                class="form-input font-mono"
                [ngModel]="feeIncomeAccountId()"
                (ngModelChange)="feeIncomeAccountId.set($event)"
                placeholder="acc-fee-income-01"
                data-testid="fee-income-account-input"
              />
              <span class="field-hint">Ledger account UUID destination for collected fees</span>
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="tax-rate">Applicable Tax Rate (%)</label>
              <input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="form-input font-mono"
                [ngModel]="taxRate()"
                (ngModelChange)="taxRate.set($event)"
                placeholder="20.0"
                data-testid="tax-rate-input"
              />
              <span class="field-hint">e.g. 20 for 20% VAT</span>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button
            type="button"
            class="btn-cancel"
            (click)="handleCancel()"
            [disabled]="submitting()"
            data-testid="fee-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-submit"
            (click)="submit()"
            [disabled]="!isSubmitEnabled() || submitting()"
            data-testid="fee-submit-btn"
          >
            <span *ngIf="submitting()" class="spinner"></span>
            <span>Create Fee Rule</span>
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
        box-shadow:
          0 20px 25px -5px rgba(0, 0, 0, 0.5),
          0 8px 10px -6px rgba(0, 0, 0, 0.4);
        width: 100%;
        max-width: 680px;
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
        border-bottom: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.6);
      }

      .header-title-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon {
        font-size: 20px;
        color: #60a5fa;
      }

      .header-texts {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .title-text {
        margin: 0;
        font-size: 16px;
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
        padding: 4px;
        border-radius: 4px;
      }

      .close-btn:hover:not(:disabled) {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.05);
      }

      .error-banner {
        background: rgba(239, 68, 68, 0.15);
        border-bottom: 1px solid rgba(239, 68, 68, 0.3);
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
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

      .flex-2 {
        flex: 2;
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
        letter-spacing: 0.03em;
      }

      .required {
        color: #ef4444;
      }

      .form-input,
      .form-select {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s ease;
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

      .model-switcher {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
      }

      .model-tab {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
      }

      .model-tab:hover {
        border-color: #475569;
      }

      .model-tab.active {
        background: rgba(59, 130, 246, 0.15);
        border-color: #3b82f6;
      }

      .tab-title {
        font-size: 12px;
        font-weight: 700;
        color: #f8fafc;
      }

      .model-tab.active .tab-title {
        color: #60a5fa;
      }

      .tab-desc {
        font-size: 10px;
        color: #94a3b8;
      }

      .modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 14px 20px;
        border-top: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.6);
      }

      .btn-cancel {
        background: transparent;
        border: 1px solid #475569;
        color: #94a3b8;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-cancel:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
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
        transition: background-color 0.15s ease;
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
export class FeeRuleFormComponent {
  private adminService: RuleAdminService;

  // Signal Inputs & Visibility
  readonly isOpen = signal<boolean>(false);
  @Input('isOpen') set isOpenInput(val: boolean) {
    this.isOpen.set(val);
  }

  @Output() readonly onClose = new EventEmitter<void>();
  @Output() readonly onSuccess = new EventEmitter<FeeRuleResponse>();

  // Form Field Signals
  readonly code = signal<string>('');
  readonly name = signal<string>('');
  readonly transactionType = signal<any>('TRANSFER');
  readonly currency = signal<any>('EUR');
  readonly calculationType = signal<'FIXED' | 'PERCENTAGE' | 'TIERED'>('FIXED');
  readonly fixedAmount = signal<number | undefined>(undefined);
  readonly percentageRate = signal<number | undefined>(undefined);
  readonly tiers = signal<FeeTierDto[]>([]);
  readonly minFee = signal<number | undefined>(undefined);
  readonly maxFee = signal<number | undefined>(undefined);
  readonly feeIncomeAccountId = signal<string>('');
  readonly taxRate = signal<number | undefined>(undefined);
  readonly taxPayableAccountId = signal<string>('');
  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Computeds & Validators
  readonly isCodeValid = computed<boolean>(() => {
    const c = this.code().trim();
    return /^[A-Z0-9_]{3,30}$/.test(c);
  });

  readonly areBoundariesValid = computed<boolean>(() => {
    const min = this.minFee();
    const max = this.maxFee();
    if (min !== undefined && max !== undefined && min !== null && max !== null) {
      return Number(min) <= Number(max);
    }
    return true;
  });

  readonly isCalculationValid = computed<boolean>(() => {
    switch (this.calculationType()) {
      case 'FIXED':
        return this.fixedAmount() !== undefined && Number(this.fixedAmount()) >= 0;
      case 'PERCENTAGE':
        return (
          this.percentageRate() !== undefined &&
          Number(this.percentageRate()) >= 0 &&
          Number(this.percentageRate()) <= 100
        );
      case 'TIERED':
        return this.tiers().length > 0;
      default:
        return false;
    }
  });

  readonly isSubmitEnabled = computed<boolean>(() => {
    return (
      this.isCodeValid() &&
      this.name().trim().length >= 3 &&
      this.feeIncomeAccountId().trim().length >= 3 &&
      this.areBoundariesValid() &&
      this.isCalculationValid() &&
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

  onTiersChanged(newTiers: FeeTierDto[]): void {
    this.tiers.set([...newTiers]);
  }

  handleCancel(): void {
    this.resetForm();
    this.isOpen.set(false);
    this.onClose.emit();
  }

  resetForm(): void {
    this.code.set('');
    this.name.set('');
    this.fixedAmount.set(undefined);
    this.percentageRate.set(undefined);
    this.tiers.set([]);
    this.minFee.set(undefined);
    this.maxFee.set(undefined);
    this.feeIncomeAccountId.set('');
    this.taxRate.set(undefined);
    this.taxPayableAccountId.set('');
    this.error.set(null);
    this.submitting.set(false);
  }

  async submit(): Promise<void> {
    if (!this.isSubmitEnabled()) return;

    this.submitting.set(true);
    this.error.set(null);

    const payload: CreateFeeRuleRequest = {
      code: this.code().trim(),
      name: this.name().trim(),
      transactionType: this.transactionType(),
      currency: this.currency(),
      calculationType: this.calculationType(),
      fixedAmount: this.calculationType() === 'FIXED' ? Number(this.fixedAmount()) : undefined,
      percentageRate:
        this.calculationType() === 'PERCENTAGE' ? Number(this.percentageRate()) : undefined,
      tiers: this.calculationType() === 'TIERED' ? this.tiers() : undefined,
      minFee:
        this.minFee() !== undefined && this.minFee() !== null ? Number(this.minFee()) : undefined,
      maxFee:
        this.maxFee() !== undefined && this.maxFee() !== null ? Number(this.maxFee()) : undefined,
      feeIncomeAccountId: this.feeIncomeAccountId().trim(),
      taxRate:
        this.taxRate() !== undefined && this.taxRate() !== null
          ? Number(this.taxRate())
          : undefined,
      taxPayableAccountId:
        this.taxPayableAccountId().trim().length > 0
          ? this.taxPayableAccountId().trim()
          : undefined,
    };

    try {
      const created = await this.adminService.createFeeRule(payload);
      this.onSuccess.emit(created);
      this.handleCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create fee rule';
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
