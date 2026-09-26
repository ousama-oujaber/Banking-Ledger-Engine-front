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
import { ReconAdminService } from '../services/recon-admin.service';
import type {
  ReconciliationCaseResponse,
  EscalateReconciliationCaseRequest,
} from '@ble-frontend/api-client';

/**
 * EscalateCaseModalComponent
 *
 * Back-office modal confirmation dialog for escalating discrepancy cases to senior operations
 * or compliance management.
 */
@Component({
  selector: 'ble-escalate-case-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="escalate-case-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalate-modal-title"
        data-testid="escalate-case-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">⚡</span>
            <div>
              <h3 id="escalate-modal-title" class="title-text">Escalate Discrepancy Case</h3>
              <p class="subtitle-text">
                Transfer case ownership to compliance or executive reconciliation queue
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="escalate-case-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Warning Banner -->
        <div class="callout warning" data-testid="escalate-case-callout">
          <span class="callout-icon">⚠</span>
          <div class="callout-text">
            <strong>Escalation Notice:</strong> This case will be highlighted as critical and
            flagged for supervisor intervention.
          </div>
        </div>

        <!-- Case Summary -->
        <div class="case-summary-card" *ngIf="targetCase()" data-testid="escalate-case-summary">
          <div class="summary-col">
            <span class="summary-label">Case ID</span>
            <span class="summary-val mono">{{ targetCase()?.id }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Discrepancy</span>
            <span class="summary-val highlight-warn">{{ targetCase()?.discrepancyType }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Variance Amount</span>
            <span class="summary-val mono amount-text">
              {{ targetCase()?.currency || 'EUR' }}
              {{ targetCase()?.discrepancyAmount || 0 | number: '1.2-2' }}
            </span>
          </div>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="escalate-case-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="handleSubmit()" class="modal-body" data-testid="escalate-case-form">
          <!-- Operator Attribution -->
          <div class="form-group">
            <label for="escalate-operator" class="form-label required">Operator Attribution</label>
            <input
              type="text"
              id="escalate-operator"
              name="operator"
              class="form-input"
              [(ngModel)]="operator"
              [disabled]="submitting()"
              required
              data-testid="escalate-operator-input"
            />
          </div>

          <!-- Mandatory Escalation Reason -->
          <div class="form-group">
            <label for="escalate-reason" class="form-label required">
              Escalation Reason & Regulatory Urgency
            </label>
            <textarea
              id="escalate-reason"
              name="reason"
              class="form-textarea"
              rows="3"
              [(ngModel)]="reason"
              [disabled]="submitting()"
              placeholder="State why this discrepancy cannot be settled through standard procedures (e.g. counterparty claim, potential clearing fraud, material balance threshold exceedance)..."
              required
              data-testid="escalate-reason-textarea"
            ></textarea>
            <span class="char-count" [class.invalid]="reason().trim().length < 5">
              {{ reason().trim().length }} / 5 characters min
            </span>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn-cancel"
              (click)="handleCancel()"
              [disabled]="submitting()"
              data-testid="escalate-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-submit-escalate"
              [disabled]="!isValid() || submitting()"
              data-testid="escalate-submit-btn"
            >
              <span class="spinner" *ngIf="submitting()"></span>
              <span>{{ submitting() ? 'Escalating...' : 'Confirm Escalation' }}</span>
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
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
        padding: 16px;
      }

      .modal-dialog {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 12px;
        width: 100%;
        max-width: 560px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        overflow: hidden;
        animation: modalScale 0.15s ease-out;
      }

      @keyframes modalScale {
        from {
          opacity: 0;
          transform: scale(0.96);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .header-titles {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon {
        font-size: 22px;
        color: #f87171;
      }

      .title-text {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
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
        padding: 4px 8px;
        border-radius: 4px;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .callout.warning {
        margin: 16px 24px 0;
        padding: 10px 14px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 12px;
        color: #fbbf24;
      }

      .case-summary-card {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin: 12px 24px 0;
        padding: 12px 16px;
        background: rgba(15, 23, 42, 0.5);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
      }

      .summary-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .summary-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .summary-val {
        font-size: 12px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .highlight-warn {
        color: #fbbf24;
        font-weight: 600;
      }

      .amount-text {
        font-size: 13px;
        font-weight: 700;
        color: #38bdf8;
      }

      .alert-box.error {
        margin: 16px 24px 0;
        padding: 10px 14px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #fca5a5;
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
        font-weight: 600;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .form-label.required::after {
        content: ' *';
        color: #f87171;
      }

      .form-input,
      .form-textarea {
        background: var(--ble-color-background, #0b1120);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 8px 12px;
        color: var(--ble-color-text-primary, #f8fafc);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s ease;
      }

      .form-input:focus,
      .form-textarea:focus {
        border-color: #f87171;
      }

      .form-textarea {
        resize: vertical;
        min-height: 80px;
      }

      .char-count {
        align-self: flex-end;
        font-size: 10px;
        color: #64748b;
      }

      .char-count.invalid {
        color: #f87171;
      }

      .modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 8px;
        border-top: 1px solid var(--ble-color-border, #334155);
      }

      .btn-cancel {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }

      .btn-cancel:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .btn-submit-escalate {
        background: rgba(239, 68, 68, 0.85);
        border: 1px solid #ef4444;
        color: #ffffff;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-submit-escalate:hover:not(:disabled) {
        background: #dc2626;
      }

      .btn-submit-escalate:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spinner {
        width: 12px;
        height: 12px;
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

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
    `,
  ],
})
export class EscalateCaseModalComponent {
  readonly reconService: ReconAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetCase = signal<ReconciliationCaseResponse | null>(null);

  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (value) {
      this.resetForm();
    }
  }

  @Input() set caseItem(value: ReconciliationCaseResponse | null) {
    this.targetCase.set(value);
  }

  @Output() escalated = new EventEmitter<ReconciliationCaseResponse>();
  @Output() cancelled = new EventEmitter<void>();

  readonly operator = signal<string>('admin-operator');
  readonly reason = signal<string>('');

  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly isValid = computed<boolean>(() => {
    return this.operator().trim().length > 0 && this.reason().trim().length >= 5;
  });

  constructor(service?: ReconAdminService) {
    this.reconService = service ?? inject(ReconAdminService);
  }

  @HostListener('document:keydown.escape')
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
    this.isOpen.set(false);
    this.cancelled.emit();
  }

  async handleSubmit(): Promise<void> {
    const c = this.targetCase();
    if (!c || !c.id || !this.isValid() || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    const req: EscalateReconciliationCaseRequest = {
      operator: this.operator().trim(),
      reason: this.reason().trim(),
    };

    try {
      const res = await this.reconService.escalateCase(c.id, req);
      this.submitting.set(false);
      this.isOpen.set(false);
      this.escalated.emit(res);
    } catch (err: unknown) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : 'Escalation failed';
      this.error.set(msg);
    }
  }

  private resetForm(): void {
    this.operator.set('admin-operator');
    this.reason.set('');
    this.error.set(null);
    this.submitting.set(false);
  }
}
