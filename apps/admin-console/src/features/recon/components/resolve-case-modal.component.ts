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
  ResolveReconciliationCaseRequest,
} from '@ble-frontend/api-client';

/**
 * ResolveCaseModalComponent
 *
 * Back-office modal confirmation dialog for resolving reconciliation discrepancy cases.
 * Enforces mandatory audit rationale, operator attribution, and selectable resolution action
 * (RESOLVE, FORCE_ADJUST, WRITE_OFF, MANUAL_CLEAR).
 */
@Component({
  selector: 'ble-resolve-case-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="resolve-case-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-modal-title"
        data-testid="resolve-case-dialog"
      >
        <!-- Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">⚖</span>
            <div>
              <h3 id="resolve-modal-title" class="title-text">Resolve Discrepancy Case</h3>
              <p class="subtitle-text">
                Apply administrative resolution and record regulatory audit rationale
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="resolve-case-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Case Summary Callout -->
        <div class="case-summary-card" *ngIf="targetCase()" data-testid="resolve-case-summary">
          <div class="summary-col">
            <span class="summary-label">Case ID</span>
            <span class="summary-val mono">{{ targetCase()?.id }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Discrepancy Type</span>
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
        <div class="alert-box error" *ngIf="error()" data-testid="resolve-case-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="handleSubmit()" class="modal-body" data-testid="resolve-case-form">
          <!-- Resolution Action Dropdown -->
          <div class="form-group">
            <label for="resolution-action" class="form-label required">Resolution Action</label>
            <select
              id="resolution-action"
              name="resolutionAction"
              class="form-select"
              [(ngModel)]="resolutionAction"
              [disabled]="submitting()"
              required
              data-testid="resolve-action-select"
            >
              <option value="RESOLVE">RESOLVE — Manual Verification & Confirmed Match</option>
              <option value="FORCE_ADJUST">
                FORCE_ADJUST — Post Compensating Ledger Adjustment
              </option>
              <option value="WRITE_OFF">WRITE_OFF — Immaterial Variance Tolerance Write-Off</option>
              <option value="MANUAL_CLEAR">MANUAL_CLEAR — Force Clear External Discrepancy</option>
            </select>
            <span class="field-hint">
              Selected action will be permanently recorded in the immutable audit trail.
            </span>
          </div>

          <!-- Compensating Tx ID (Optional / Recommended for FORCE_ADJUST) -->
          <div class="form-group">
            <label for="compensating-tx" class="form-label">
              Compensating Transaction ID
              <span class="optional-tag" *ngIf="resolutionAction() !== 'FORCE_ADJUST'"
                >(Optional)</span
              >
              <span class="recommended-tag" *ngIf="resolutionAction() === 'FORCE_ADJUST'"
                >(Recommended)</span
              >
            </label>
            <input
              type="text"
              id="compensating-tx"
              name="compensatingTx"
              class="form-input mono"
              [(ngModel)]="compensatingTransactionId"
              [disabled]="submitting()"
              placeholder="e.g. TX-ADJ-2026-0926-001"
              data-testid="resolve-compensating-input"
            />
          </div>

          <!-- Operator Attribution -->
          <div class="form-group">
            <label for="resolve-operator" class="form-label required">Operator Attribution</label>
            <input
              type="text"
              id="resolve-operator"
              name="operator"
              class="form-input"
              [(ngModel)]="operator"
              [disabled]="submitting()"
              required
              data-testid="resolve-operator-input"
            />
          </div>

          <!-- Mandatory Audit Rationale Notes -->
          <div class="form-group">
            <label for="resolve-notes" class="form-label required">
              Audit Rationale & Justification Notes
            </label>
            <textarea
              id="resolve-notes"
              name="notes"
              class="form-textarea"
              rows="3"
              [(ngModel)]="notes"
              [disabled]="submitting()"
              placeholder="Document the root cause investigation, clearing log confirmation, and justification (min 5 characters)..."
              required
              data-testid="resolve-notes-textarea"
            ></textarea>
            <span class="char-count" [class.invalid]="notes().trim().length < 5">
              {{ notes().trim().length }} / 5 characters min
            </span>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn-cancel"
              (click)="handleCancel()"
              [disabled]="submitting()"
              data-testid="resolve-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-submit"
              [disabled]="!isValid() || submitting()"
              data-testid="resolve-submit-btn"
            >
              <span class="spinner" *ngIf="submitting()"></span>
              <span>{{ submitting() ? 'Resolving...' : 'Confirm Resolution' }}</span>
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
        max-width: 580px;
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

      .case-summary-card {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin: 16px 24px 0;
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
      .form-select,
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
      .form-select:focus,
      .form-textarea:focus {
        border-color: var(--ble-color-primary, #38bdf8);
      }

      .form-textarea {
        resize: vertical;
        min-height: 80px;
      }

      .field-hint {
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .optional-tag {
        font-size: 11px;
        font-weight: 400;
        color: #64748b;
      }

      .recommended-tag {
        font-size: 11px;
        font-weight: 600;
        color: #fbbf24;
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

      .btn-submit {
        background: var(--ble-color-primary, #0284c7);
        border: 1px solid var(--ble-color-primary, #0284c7);
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

      .btn-submit:hover:not(:disabled) {
        background: #0369a1;
      }

      .btn-submit:disabled {
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
export class ResolveCaseModalComponent {
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

  @Output() resolved = new EventEmitter<ReconciliationCaseResponse>();
  @Output() cancelled = new EventEmitter<void>();

  // Form Model Signals
  readonly resolutionAction = signal<string>('RESOLVE');
  readonly compensatingTransactionId = signal<string>('');
  readonly operator = signal<string>('admin-operator');
  readonly notes = signal<string>('');

  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly isValid = computed<boolean>(() => {
    return (
      this.resolutionAction().length > 0 &&
      this.operator().trim().length > 0 &&
      this.notes().trim().length >= 5
    );
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

    const req: ResolveReconciliationCaseRequest = {
      resolutionAction: this.resolutionAction(),
      operator: this.operator().trim(),
      notes: this.notes().trim(),
      compensatingTransactionId: this.compensatingTransactionId().trim() || undefined,
    };

    try {
      const res = await this.reconService.resolveCase(c.id, req);
      this.submitting.set(false);
      this.isOpen.set(false);
      this.resolved.emit(res);
    } catch (err: unknown) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : 'Resolution failed';
      this.error.set(msg);
    }
  }

  private resetForm(): void {
    this.resolutionAction.set('RESOLVE');
    this.compensatingTransactionId.set('');
    this.operator.set('admin-operator');
    this.notes.set('');
    this.error.set(null);
    this.submitting.set(false);
  }
}
