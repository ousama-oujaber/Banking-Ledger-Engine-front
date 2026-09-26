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
  ReconciliationJobResponse,
  RunReconciliationJobRequest,
} from '@ble-frontend/api-client';

/**
 * RunReconJobModalComponent
 *
 * Back-office modal dialog for triggering on-demand external clearing file reconciliation jobs.
 */
@Component({
  selector: 'ble-run-recon-job-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="run-job-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-job-title"
        data-testid="run-job-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">⚙</span>
            <div>
              <h3 id="run-job-title" class="title-text">Run Reconciliation Job</h3>
              <p class="subtitle-text">
                Trigger on-demand comparison of external clearing files against internal ledgers
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="run-job-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Info Callout -->
        <div class="callout info" data-testid="run-job-callout">
          <span class="callout-icon">ℹ</span>
          <div class="callout-text">
            The reconciliation worker will fetch clearing records, match them against posted ledger
            transactions, and generate discrepancy cases for any mismatches.
          </div>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="run-job-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Form Body -->
        <form (ngSubmit)="handleSubmit()" class="modal-body" data-testid="run-job-form">
          <!-- Rail / Clearing Source -->
          <div class="form-group">
            <label for="job-source" class="form-label required">Clearing Source Network</label>
            <select
              id="job-source"
              name="source"
              class="form-select"
              [(ngModel)]="source"
              [disabled]="submitting()"
              required
              data-testid="run-job-source-select"
            >
              <option value="SEPA">SEPA (Single Euro Payments Area)</option>
              <option value="ACH">ACH (Automated Clearing House)</option>
              <option value="FEDWIRE">FEDWIRE (Federal Reserve Wire Network)</option>
              <option value="SWIFT">SWIFT (Society for Worldwide Interbank)</option>
              <option value="FAWRY">FAWRY (National Bill Presentment & Payment)</option>
            </select>
          </div>

          <!-- Statement Reference -->
          <div class="form-group">
            <label for="job-statement-ref" class="form-label required"
              >Statement / Batch Reference</label
            >
            <input
              type="text"
              id="job-statement-ref"
              name="statementReference"
              class="form-input mono"
              [(ngModel)]="statementReference"
              [disabled]="submitting()"
              placeholder="e.g. STMT-2026-0926-001"
              required
              data-testid="run-job-ref-input"
            />
          </div>

          <div class="form-row">
            <!-- Business Date -->
            <div class="form-group flex-1">
              <label for="job-business-date" class="form-label required">Business Date</label>
              <input
                type="date"
                id="job-business-date"
                name="businessDate"
                class="form-input mono"
                [(ngModel)]="businessDate"
                [disabled]="submitting()"
                required
                data-testid="run-job-date-input"
              />
            </div>

            <!-- Currency -->
            <div class="form-group flex-1">
              <label for="job-currency" class="form-label required">Currency</label>
              <select
                id="job-currency"
                name="currency"
                class="form-select"
                [(ngModel)]="currency"
                [disabled]="submitting()"
                required
                data-testid="run-job-currency-select"
              >
                <option value="EUR">EUR — Euro</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EGP">EGP — Egyptian Pound</option>
              </select>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="modal-footer">
            <button
              type="button"
              class="btn-cancel"
              (click)="handleCancel()"
              [disabled]="submitting()"
              data-testid="run-job-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-submit"
              [disabled]="!isValid() || submitting()"
              data-testid="run-job-submit-btn"
            >
              <span class="spinner" *ngIf="submitting()"></span>
              <span>{{ submitting() ? 'Starting Job...' : 'Execute Reconciliation' }}</span>
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
        max-width: 540px;
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
        color: #38bdf8;
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

      .callout.info {
        margin: 16px 24px 0;
        padding: 10px 14px;
        background: rgba(14, 165, 233, 0.1);
        border: 1px solid rgba(14, 165, 233, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 12px;
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

      .form-row {
        display: flex;
        gap: 16px;
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
        font-size: 12px;
        font-weight: 600;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .form-label.required::after {
        content: ' *';
        color: #f87171;
      }

      .form-input,
      .form-select {
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
      .form-select:focus {
        border-color: var(--ble-color-primary, #38bdf8);
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
export class RunReconJobModalComponent {
  readonly reconService: ReconAdminService;

  readonly isOpen = signal<boolean>(false);

  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (value) {
      this.resetForm();
    }
  }

  @Output() jobStarted = new EventEmitter<ReconciliationJobResponse>();
  @Output() cancelled = new EventEmitter<void>();

  readonly source = signal<string>('SEPA');
  readonly statementReference = signal<string>('');
  readonly businessDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly currency = signal<string>('EUR');

  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly isValid = computed<boolean>(() => {
    return (
      this.source().length > 0 &&
      this.statementReference().trim().length > 0 &&
      this.businessDate().trim().length > 0 &&
      this.currency().length > 0
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
    if (!this.isValid() || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    const req: RunReconciliationJobRequest = {
      source: this.source(),
      statementReference: this.statementReference().trim(),
      businessDate: this.businessDate().trim(),
      currency: this.currency(),
    };

    try {
      const job = await this.reconService.runReconJob(req);
      this.submitting.set(false);
      this.isOpen.set(false);
      this.jobStarted.emit(job);
    } catch (err: unknown) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : 'Job execution failed';
      this.error.set(msg);
    }
  }

  private resetForm(): void {
    this.source.set('SEPA');
    this.statementReference.set(`STMT-${new Date().toISOString().split('T')[0]}-001`);
    this.businessDate.set(new Date().toISOString().split('T')[0]);
    this.currency.set('EUR');
    this.error.set(null);
    this.submitting.set(false);
  }
}
