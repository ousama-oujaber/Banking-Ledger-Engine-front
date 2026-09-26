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

/**
 * InterestOpsModalComponent
 *
 * Standalone Angular 19 modal confirmation dialog to execute administrative interest operations:
 * - ACCRUE: Triggers daily batch accrual calculation across active accounts.
 * - POST: Triggers the posting of accrued interest to an account ledger balance with client idempotency.
 */
@Component({
  selector: 'ble-interest-ops-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="interest-ops-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interest-ops-title"
        data-testid="interest-ops-dialog"
      >
        <!-- Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">{{ mode() === 'ACCRUE' ? '⚙' : '💰' }}</span>
            <div>
              <h3 id="interest-ops-title" class="title-text">
                {{ mode() === 'ACCRUE' ? 'Execute Daily Accrual Sweep' : 'Post Accrued Interest' }}
              </h3>
              <p class="subtitle-text">
                {{
                  mode() === 'ACCRUE'
                    ? 'Calculate daily interest accrual entries for eligible accounts'
                    : 'Commit and settle accrued interest entries directly into account ledger'
                }}
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

        <!-- Error Notification -->
        <div *ngIf="error()" class="error-banner" data-testid="interest-ops-error">
          <span class="error-icon">⚠</span>
          <span class="error-text">{{ error() }}</span>
        </div>

        <div class="modal-body">
          <div *ngIf="mode() === 'ACCRUE'" class="op-description">
            <div class="info-callout">
              <span class="callout-icon">ℹ</span>
              <p class="callout-text">
                This triggers the backend interest accrual engine for all active accounts matching
                interest rules. Daily accruals will be calculated and staged in the ledger without
                moving settled funds until posting.
              </p>
            </div>

            <div class="form-group">
              <label class="form-label" for="ops-business-date"
                >Business Date (Optional, default = today)</label
              >
              <input
                id="ops-business-date"
                type="date"
                class="form-input font-mono"
                [ngModel]="businessDate()"
                (ngModelChange)="businessDate.set($event)"
                data-testid="ops-date-input"
              />
            </div>
          </div>

          <div *ngIf="mode() === 'POST'" class="op-description">
            <div class="info-callout">
              <span class="callout-icon">ℹ</span>
              <p class="callout-text">
                This will finalize accrued interest entries and generate double-entry ledger
                transactions crediting customer balances and debiting the configured interest
                expense accounts.
              </p>
            </div>

            <div class="form-group">
              <label class="form-label" for="ops-account-id"
                >Target Account ID <span class="required">*</span></label
              >
              <input
                id="ops-account-id"
                type="text"
                class="form-input font-mono"
                [ngModel]="targetAccountId()"
                (ngModelChange)="targetAccountId.set($event)"
                placeholder="acc-001"
                data-testid="ops-target-account-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="ops-as-of-date">As Of Date (Optional)</label>
              <input
                id="ops-as-of-date"
                type="date"
                class="form-input font-mono"
                [ngModel]="asOfDate()"
                (ngModelChange)="asOfDate.set($event)"
                data-testid="ops-asof-input"
              />
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
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-submit"
            [class.accrue]="mode() === 'ACCRUE'"
            (click)="executeAction()"
            [disabled]="!isSubmitEnabled() || submitting()"
            data-testid="ops-submit-btn"
          >
            <span *ngIf="submitting()" class="spinner"></span>
            <span>{{
              mode() === 'ACCRUE' ? 'Trigger Accrual Sweep' : 'Confirm Interest Posting'
            }}</span>
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
        max-width: 540px;
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
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .info-callout {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 6px;
        padding: 10px 12px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 14px;
      }

      .callout-icon {
        color: #60a5fa;
        font-weight: 700;
      }

      .callout-text {
        margin: 0;
        font-size: 12px;
        color: #cbd5e1;
        line-height: 1.4;
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

      .form-input {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 12px;
        outline: none;
      }

      .form-input:focus {
        border-color: #3b82f6;
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
        background: #10b981;
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

      .btn-submit.accrue {
        background: #3b82f6;
      }

      .btn-submit:hover:not(:disabled) {
        opacity: 0.9;
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
export class InterestOpsModalComponent {
  private adminService: RuleAdminService;

  readonly isOpen = signal<boolean>(false);
  @Input('isOpen') set isOpenInput(val: boolean) {
    this.isOpen.set(val);
  }

  readonly mode = signal<'ACCRUE' | 'POST'>('ACCRUE');
  @Input('mode') set modeInput(val: 'ACCRUE' | 'POST') {
    this.mode.set(val);
  }

  @Output() readonly onClose = new EventEmitter<void>();
  @Output() readonly onSuccess = new EventEmitter<{ action: string; count?: number }>();

  readonly businessDate = signal<string>('');
  readonly targetAccountId = signal<string>('');
  readonly asOfDate = signal<string>('');
  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly isSubmitEnabled = computed<boolean>(() => {
    if (this.mode() === 'POST') {
      return this.targetAccountId().trim().length >= 3 && !this.submitting();
    }
    return !this.submitting();
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
    this.error.set(null);
    this.targetAccountId.set('');
    this.submitting.set(false);
    this.isOpen.set(false);
    this.onClose.emit();
  }

  async executeAction(): Promise<void> {
    if (!this.isSubmitEnabled()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      if (this.mode() === 'ACCRUE') {
        const res = await this.adminService.triggerDailyAccrual({
          businessDate:
            this.businessDate().trim().length > 0 ? this.businessDate().trim() : undefined,
        });
        this.onSuccess.emit({ action: 'ACCRUE', count: res?.accrualCount || 0 });
      } else if (this.mode() === 'POST') {
        const res = await this.adminService.triggerInterestPosting({
          accountId: this.targetAccountId().trim(),
          asOfDate: this.asOfDate().trim().length > 0 ? this.asOfDate().trim() : undefined,
        });
        this.onSuccess.emit({ action: 'POST', count: res?.accrualCount || 1 });
      }
      this.handleCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Interest operation failed';
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
