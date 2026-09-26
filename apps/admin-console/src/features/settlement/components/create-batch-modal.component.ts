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
import { SettlementAdminService } from '../services/settlement-admin.service';
import type {
  SettlementBatchResponse,
  CreateSettlementBatchRequest,
} from '@ble-frontend/api-client';

/**
 * Supported payment clearing rails.
 */
export const SETTLEMENT_RAILS = ['SEPA', 'ACH', 'FEDWIRE', 'SWIFT', 'FAWRY'] as const;
export type SettlementRail = (typeof SETTLEMENT_RAILS)[number];

/**
 * CreateBatchModalComponent
 *
 * Standalone Angular 19 modal dialog enabling back-office operators to configure and initiate
 * a new clearing settlement batch across payment rails with client idempotency.
 */
@Component({
  selector: 'ble-create-batch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="create-batch-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-batch-title"
        data-testid="create-batch-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">📦</span>
            <div>
              <h3 id="create-batch-title" class="title-text">Create Settlement Batch</h3>
              <p class="subtitle-text">
                Initialize a clearing batch for netting and ledger settlement execution
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="create-batch-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="create-batch-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="handleSubmit()" class="modal-body" data-testid="create-batch-form">
          <!-- Rail Selection -->
          <div class="form-group">
            <label for="batch-rail" class="form-label">
              Clearing Rail <span class="required">*</span>
            </label>
            <select
              id="batch-rail"
              class="form-select"
              [ngModel]="rail()"
              (ngModelChange)="rail.set($event)"
              name="rail"
              data-testid="batch-rail-select"
            >
              <option *ngFor="let r of rails" [value]="r">{{ r }}</option>
            </select>
            <span class="form-hint"
              >Payment rail network responsible for clearing instructions</span
            >
          </div>

          <!-- Currency Selection -->
          <div class="form-group">
            <label for="batch-currency" class="form-label">
              Settlement Currency <span class="required">*</span>
            </label>
            <select
              id="batch-currency"
              class="form-select"
              [ngModel]="currency()"
              (ngModelChange)="currency.set($event)"
              name="currency"
              data-testid="batch-currency-select"
            >
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="EGP">EGP — Egyptian Pound</option>
            </select>
          </div>

          <!-- Business Date -->
          <div class="form-group">
            <label for="batch-business-date" class="form-label">
              Business Date <span class="required">*</span>
            </label>
            <input
              id="batch-business-date"
              type="date"
              class="form-input"
              [ngModel]="businessDate()"
              (ngModelChange)="businessDate.set($event)"
              name="businessDate"
              data-testid="batch-business-date-input"
            />
            <span class="form-hint"
              >Accounting value date for transaction net delta calculation</span
            >
          </div>

          <!-- Client Idempotency Preview -->
          <div class="idempotency-box">
            <div class="idempotency-header">
              <span class="idempotency-label">Client Idempotency Key (BR-F03)</span>
              <button
                type="button"
                class="btn-regen"
                (click)="regenerateIdempotencyKey()"
                title="Regenerate UUID v4"
                data-testid="regen-idempotency-key-btn"
              >
                ↻ Refresh
              </button>
            </div>
            <code class="idempotency-key" data-testid="idempotency-key-val">{{
              idempotencyKey()
            }}</code>
          </div>

          <!-- Actions -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn-secondary"
              (click)="handleCancel()"
              [disabled]="submitting()"
              data-testid="create-batch-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-primary"
              [disabled]="!isValid() || submitting()"
              data-testid="create-batch-submit-btn"
            >
              <span class="spinner" *ngIf="submitting()"></span>
              <span>{{ submitting() ? 'Creating Batch...' : 'Create Batch' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(11, 17, 32, 0.75);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 16px;
      }

      .modal-dialog {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        width: 100%;
        max-width: 520px;
        box-shadow:
          0 20px 25px -5px rgba(0, 0, 0, 0.5),
          0 8px 10px -6px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 18px 24px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.4);
      }

      .header-titles {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .header-icon {
        font-size: 24px;
        line-height: 1;
      }

      .title-text {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .subtitle-text {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .close-btn {
        background: transparent;
        border: none;
        color: var(--ble-color-text-secondary, #94a3b8);
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        line-height: 1;
      }

      .close-btn:hover {
        color: var(--ble-color-text-primary, #f8fafc);
        background: rgba(255, 255, 255, 0.05);
      }

      .alert-box {
        margin: 16px 24px 0;
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .alert-box.error {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }

      .modal-body {
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .required {
        color: var(--ble-color-danger, #ef4444);
      }

      .form-input,
      .form-select {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 8px 12px;
        color: var(--ble-color-text-primary, #f8fafc);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s ease;
      }

      .form-input:focus,
      .form-select:focus {
        border-color: var(--ble-color-primary, #3b82f6);
      }

      .form-hint {
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .idempotency-box {
        background: rgba(15, 23, 42, 0.4);
        border: 1px dashed var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 10px 14px;
      }

      .idempotency-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .idempotency-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--ble-color-text-muted, #64748b);
      }

      .btn-regen {
        background: transparent;
        border: none;
        color: var(--ble-color-primary, #3b82f6);
        font-size: 11px;
        cursor: pointer;
        padding: 0;
      }

      .btn-regen:hover {
        text-decoration: underline;
      }

      .idempotency-key {
        font-family: var(--ble-font-family-mono, monospace);
        font-size: 11px;
        color: #38bdf8;
        word-break: break-all;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 8px;
        padding-top: 16px;
        border-top: 1px solid var(--ble-color-border, #334155);
      }

      .btn-primary,
      .btn-secondary {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.15s ease;
      }

      .btn-secondary {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .btn-primary {
        background: var(--ble-color-primary, #3b82f6);
        border: 1px solid transparent;
        color: #fff;
      }

      .btn-primary:hover:not(:disabled) {
        background: #2563eb;
      }

      .btn-primary:disabled,
      .btn-secondary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
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
export class CreateBatchModalComponent {
  private settlementService: SettlementAdminService;

  readonly rails = SETTLEMENT_RAILS;

  // Inputs / State
  readonly isOpen = signal<boolean>(false);
  readonly rail = signal<string>('SEPA');
  readonly currency = signal<string>('EUR');
  readonly businessDate = signal<string>(new Date().toISOString().substring(0, 10));
  readonly idempotencyKey = signal<string>(crypto.randomUUID());
  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor(service?: SettlementAdminService) {
    if (service) {
      this.settlementService = service;
    } else {
      this.settlementService = inject(SettlementAdminService);
    }
  }

  @Input()
  set open(value: boolean) {
    this.isOpen.set(value);
    if (value) {
      this.resetForm();
    }
  }

  @Output() onClose = new EventEmitter<void>();
  @Output() onCreated = new EventEmitter<SettlementBatchResponse>();

  /**
   * Validation computed state checking required fields.
   */
  readonly isValid = computed<boolean>(() => {
    return (
      this.rail().trim().length > 0 &&
      this.currency().trim().length === 3 &&
      this.businessDate().trim().length >= 10
    );
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen() && !this.submitting()) {
      this.handleCancel();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      if (!this.submitting()) {
        this.handleCancel();
      }
    }
  }

  handleCancel(): void {
    this.isOpen.set(false);
    this.onClose.emit();
  }

  regenerateIdempotencyKey(): void {
    this.idempotencyKey.set(crypto.randomUUID());
  }

  resetForm(): void {
    this.rail.set('SEPA');
    this.currency.set('EUR');
    this.businessDate.set(new Date().toISOString().substring(0, 10));
    this.idempotencyKey.set(crypto.randomUUID());
    this.error.set(null);
    this.submitting.set(false);
  }

  async handleSubmit(): Promise<void> {
    if (!this.isValid() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload: CreateSettlementBatchRequest = {
      rail: this.rail(),
      currency: this.currency(),
      businessDate: this.businessDate(),
    };

    try {
      const created = await this.settlementService.createBatch(payload);
      this.isOpen.set(false);
      this.onCreated.emit(created);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create settlement batch';
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
