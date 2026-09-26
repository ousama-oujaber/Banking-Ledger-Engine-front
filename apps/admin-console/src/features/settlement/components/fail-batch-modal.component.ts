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
import type { SettlementBatchResponse } from '@ble-frontend/api-client';

/**
 * FailBatchModalComponent
 *
 * Standalone Angular 19 modal dialog requiring an operator audit reason
 * before marking a clearing batch as FAILED in the settlement pipeline.
 */
@Component({
  selector: 'ble-fail-batch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="fail-batch-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fail-batch-title"
        data-testid="fail-batch-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">⚠</span>
            <div>
              <h3 id="fail-batch-title" class="title-text">Mark Batch As Failed</h3>
              <p class="subtitle-text">
                Record clearing rejection or settlement processing failure
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="fail-batch-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Alert Callout -->
        <div class="callout danger" data-testid="fail-batch-danger">
          <span class="callout-icon">⛔</span>
          <div class="callout-text">
            <strong>Operator Action Required:</strong> Marking this batch as FAILED halts settlement
            execution. An audit justification rationale is required for ledger compliance.
          </div>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="fail-batch-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Batch Info Card -->
        <div class="batch-summary-card" *ngIf="targetBatch()" data-testid="fail-batch-summary">
          <div class="summary-item">
            <span class="summary-label">Batch ID</span>
            <span class="summary-val mono">{{ targetBatch()?.id }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Rail / Currency</span>
            <span class="summary-val font-semibold">
              {{ targetBatch()?.rail }} ({{ targetBatch()?.currency }})
            </span>
          </div>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="handleSubmit()" class="modal-body" data-testid="fail-batch-form">
          <div class="form-group">
            <label for="fail-reason" class="form-label">
              Failure Audit Rationale <span class="required">*</span>
            </label>
            <textarea
              id="fail-reason"
              class="form-textarea"
              rows="4"
              placeholder="Provide a detailed reason (e.g. Clearing network gateway timeout, mismatch in bank participant routing)..."
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
              name="reason"
              data-testid="fail-batch-reason-input"
            ></textarea>
            <span class="form-hint"
              >Minimum 5 characters required. Logged to immutable audit trail.</span
            >
          </div>

          <!-- Actions -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn-secondary"
              (click)="handleCancel()"
              [disabled]="submitting()"
              data-testid="fail-batch-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-danger"
              [disabled]="!isValid() || submitting()"
              data-testid="fail-batch-submit-btn"
            >
              <span class="spinner" *ngIf="submitting()"></span>
              <span>{{ submitting() ? 'Failing Batch...' : 'Confirm Batch Failure' }}</span>
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
        max-width: 500px;
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
        color: #ef4444;
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

      .callout.danger {
        margin: 16px 24px 0;
        padding: 12px 14px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        display: flex;
        gap: 10px;
        align-items: flex-start;
        color: #fca5a5;
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
        display: flex;
        justify-content: space-between;
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

      .form-textarea {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 8px 12px;
        color: var(--ble-color-text-primary, #f8fafc);
        font-size: 13px;
        outline: none;
        resize: vertical;
        font-family: inherit;
        transition: border-color 0.15s ease;
      }

      .form-textarea:focus {
        border-color: #ef4444;
      }

      .form-hint {
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 8px;
        padding-top: 16px;
        border-top: 1px solid var(--ble-color-border, #334155);
      }

      .btn-danger,
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

      .btn-danger {
        background: #ef4444;
        border: 1px solid transparent;
        color: #fff;
      }

      .btn-danger:hover:not(:disabled) {
        background: #dc2626;
      }

      .btn-danger:disabled,
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
export class FailBatchModalComponent {
  private settlementService: SettlementAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetBatch = signal<SettlementBatchResponse | null>(null);
  readonly reason = signal<string>('');
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
      this.reason.set('');
      this.error.set(null);
      this.submitting.set(false);
    }
  }

  @Input()
  set batch(value: SettlementBatchResponse | null) {
    this.targetBatch.set(value);
  }

  @Output() onClose = new EventEmitter<void>();
  @Output() onFailed = new EventEmitter<SettlementBatchResponse>();

  readonly isValid = computed<boolean>(() => {
    return this.targetBatch() !== null && this.reason().trim().length >= 5 && !this.submitting();
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

  async handleSubmit(): Promise<void> {
    const b = this.targetBatch();
    if (!b || !b.id || !this.isValid() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    try {
      const failed = await this.settlementService.failBatch(b.id, this.reason().trim());
      this.isOpen.set(false);
      this.onFailed.emit(failed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to mark batch ${b.id} as failed`;
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
