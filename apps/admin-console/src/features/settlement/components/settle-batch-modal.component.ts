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
import type { SettlementBatchResponse, SettleSettlementBatchRequest } from '@ble-frontend/api-client';

/**
 * SettleBatchModalComponent
 *
 * Standalone Angular 19 modal confirmation dialog for executing atomic settlement
 * on a clearing batch. Enforces capturing external network reference and client idempotency.
 */
@Component({
  selector: 'ble-settle-batch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="settle-batch-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settle-batch-title"
        data-testid="settle-batch-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">⚖</span>
            <div>
              <h3 id="settle-batch-title" class="title-text">Execute Batch Settlement</h3>
              <p class="subtitle-text">
                Commit atomic ledger entries and finalize clearing settlement
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="settle-batch-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Warning Callout -->
        <div class="callout warning" data-testid="settle-batch-warning">
          <span class="callout-icon">⚡</span>
          <div class="callout-text">
            <strong>Irreversible Settlement Operation:</strong> Once settled, ledger debit/credit
            entries will be immutably recorded and marked as finalized in the engine.
          </div>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="settle-batch-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Batch Info Summary Card -->
        <div class="batch-summary-card" *ngIf="targetBatch()" data-testid="batch-summary-card">
          <div class="summary-item">
            <span class="summary-label">Batch ID</span>
            <span class="summary-val mono" data-testid="summary-batch-id">{{ targetBatch()?.id }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Rail</span>
            <span class="badge rail">{{ targetBatch()?.rail }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Records Count</span>
            <span class="summary-val font-semibold">{{ targetBatch()?.recordCount ?? 0 }} items</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Total Volume</span>
            <span class="summary-val highlight">
              {{ targetBatch()?.totalAmount?.amount ?? 0 | number: '1.2-2' }}
              {{ targetBatch()?.currency }}
            </span>
          </div>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="handleSubmit()" class="modal-body" data-testid="settle-batch-form">
          <!-- External Clearing Reference -->
          <div class="form-group">
            <label for="settle-ext-ref" class="form-label">
              External Clearing Reference <span class="required">*</span>
            </label>
            <input
              id="settle-ext-ref"
              type="text"
              class="form-input mono"
              placeholder="e.g. EXT-SEPA-2026-0926-001"
              [ngModel]="externalBatchReference()"
              (ngModelChange)="externalBatchReference.set($event)"
              name="externalBatchReference"
              data-testid="settle-ext-ref-input"
            />
            <span class="form-hint"
              >Clearing network reconciliation tracking reference issued by central clearing house</span
            >
          </div>

          <!-- Settled At Timestamp (Optional) -->
          <div class="form-group">
            <label for="settle-at-date" class="form-label">
              Effective Settlement Timestamp
            </label>
            <input
              id="settle-at-date"
              type="datetime-local"
              class="form-input"
              [ngModel]="settledAt()"
              (ngModelChange)="settledAt.set($event)"
              name="settledAt"
              data-testid="settle-at-date-input"
            />
            <span class="form-hint">Leave blank to use current server timestamp</span>
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
              >
                ↻ Refresh
              </button>
            </div>
            <code class="idempotency-key" data-testid="settle-idempotency-key">{{
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
              data-testid="settle-batch-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-settle"
              [disabled]="!isValid() || submitting()"
              data-testid="settle-batch-submit-btn"
            >
              <span class="spinner" *ngIf="submitting()"></span>
              <span>{{ submitting() ? 'Executing Settlement...' : 'Confirm & Settle Batch' }}</span>
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
        max-width: 540px;
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

      .callout.warning {
        margin: 16px 24px 0;
        padding: 12px 14px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 6px;
        display: flex;
        gap: 10px;
        align-items: flex-start;
        color: #fcd34d;
        font-size: 12px;
      }

      .callout-icon {
        font-size: 16px;
        line-height: 1.2;
      }

      .alert-box {
        margin: 12px 24px 0;
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

      .batch-summary-card {
        margin: 16px 24px 0;
        padding: 12px 16px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .summary-label {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: var(--ble-color-text-muted, #64748b);
      }

      .summary-val {
        font-size: 13px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .summary-val.mono {
        font-family: var(--ble-font-family-mono, monospace);
        font-size: 12px;
      }

      .summary-val.highlight {
        font-weight: 600;
        color: #38bdf8;
      }

      .badge.rail {
        display: inline-block;
        width: fit-content;
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
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

      .form-input {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 8px 12px;
        color: var(--ble-color-text-primary, #f8fafc);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s ease;
      }

      .form-input.mono {
        font-family: var(--ble-font-family-mono, monospace);
      }

      .form-input:focus {
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

      .btn-settle,
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

      .btn-settle {
        background: #10b981;
        border: 1px solid transparent;
        color: #fff;
      }

      .btn-settle:hover:not(:disabled) {
        background: #059669;
      }

      .btn-settle:disabled,
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
export class SettleBatchModalComponent {
  private settlementService: SettlementAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetBatch = signal<SettlementBatchResponse | null>(null);
  readonly externalBatchReference = signal<string>('');
  readonly settledAt = signal<string>('');
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

  @Input()
  set batch(value: SettlementBatchResponse | null) {
    this.targetBatch.set(value);
  }

  @Output() onClose = new EventEmitter<void>();
  @Output() onSettled = new EventEmitter<SettlementBatchResponse>();

  readonly isValid = computed<boolean>(() => {
    return (
      this.targetBatch() !== null &&
      this.externalBatchReference().trim().length >= 3 &&
      !this.submitting()
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
    this.externalBatchReference.set('');
    this.settledAt.set('');
    this.idempotencyKey.set(crypto.randomUUID());
    this.error.set(null);
    this.submitting.set(false);
  }

  async handleSubmit(): Promise<void> {
    const b = this.targetBatch();
    if (!b || !b.id || !this.isValid() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload: SettleSettlementBatchRequest = {
      externalBatchReference: this.externalBatchReference().trim(),
      settledAt: this.settledAt() ? new Date(this.settledAt()).toISOString() : undefined,
    };

    try {
      const settled = await this.settlementService.settleBatch(b.id, payload);
      this.isOpen.set(false);
      this.onSettled.emit(settled);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to settle batch ${b.id}`;
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
