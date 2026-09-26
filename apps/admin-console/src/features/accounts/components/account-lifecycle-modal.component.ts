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
import { AccountAdminService } from '../services/account-admin.service';
import type { AccountResponse } from '@ble-frontend/api-client';

export type LifecycleMode = 'FREEZE' | 'UNFREEZE' | 'CLOSE';

/**
 * AccountLifecycleModalComponent
 *
 * Standalone Angular modal dialog for back-office administrative account lifecycle actions:
 * - FREEZE: Administrative freeze with mandatory justification reason (FR-OPS-ACC-01).
 * - UNFREEZE: Restore operations for frozen accounts with optional notes.
 * - CLOSE: Irreversible closure with BR-F05 zero-balance invariant enforcement and explicit confirmation (FR-OPS-ACC-02).
 */
@Component({
  selector: 'ble-account-lifecycle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      data-testid="lifecycle-modal-backdrop"
      (click)="onBackdropClick($event)"
    >
      <div
        class="modal-dialog"
        data-testid="lifecycle-modal-dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="modalTitle()"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-title-row">
            <span class="mode-icon">{{ modeIcon() }}</span>
            <h3 class="modal-title">{{ modalTitle() }}</h3>
          </div>
          <button
            type="button"
            class="close-icon-btn"
            data-testid="modal-close-icon-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <!-- Account Summary Context -->
        <div *ngIf="account()" class="account-summary-card" data-testid="modal-account-summary">
          <div class="summary-item">
            <span class="summary-label">Account ID</span>
            <span class="summary-value font-mono font-bold" data-testid="modal-account-id">{{
              account()?.id
            }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Owner</span>
            <span class="summary-value font-mono" data-testid="modal-owner-id">{{
              account()?.ownerId || '—'
            }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Current Status</span>
            <span
              class="status-badge"
              [ngClass]="'status-' + (account()?.status || 'active').toLowerCase()"
            >
              {{ account()?.status }}
            </span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Authoritative Balance</span>
            <span class="summary-value font-mono font-bold" data-testid="modal-balance">{{
              formattedBalance()
            }}</span>
          </div>
        </div>

        <!-- Modal Body Content -->
        <div class="modal-body">
          <!-- FREEZE MODE -->
          <div *ngIf="mode() === 'FREEZE'" class="mode-section" data-testid="freeze-section">
            <div class="advisory-box warning">
              <span class="advisory-icon">⚠</span>
              <div class="advisory-text">
                Administrative freezes immediately block all outbound debit transfers, payments, and
                scheduled transactions per <strong>FR-OPS-ACC-01</strong>.
              </div>
            </div>

            <div class="form-group">
              <label for="freeze-reason" class="form-label">
                Mandatory Reason / Audit Note <span class="required">*</span>
              </label>
              <textarea
                id="freeze-reason"
                class="form-textarea"
                data-testid="freeze-reason-input"
                rows="3"
                placeholder="E.g., AML compliance flag, fraud alert #389, court order..."
                [ngModel]="reason()"
                (ngModelChange)="reason.set($event)"
              ></textarea>
              <span class="form-hint" [class.hint-error]="reason().length > 0 && !isFreezeValid()">
                Minimum 3 characters required for compliance audit logging.
              </span>
            </div>
          </div>

          <!-- UNFREEZE MODE -->
          <div *ngIf="mode() === 'UNFREEZE'" class="mode-section" data-testid="unfreeze-section">
            <div class="advisory-box success">
              <span class="advisory-icon">✓</span>
              <div class="advisory-text">
                Unfreezing restores full operational capabilities, enabling normal debits and
                credits per <strong>FR-OPS-ACC-01</strong>.
              </div>
            </div>

            <div class="form-group">
              <label for="unfreeze-reason" class="form-label">
                Reinstatement Note / Reason (Optional)
              </label>
              <textarea
                id="unfreeze-reason"
                class="form-textarea"
                data-testid="unfreeze-reason-input"
                rows="3"
                placeholder="E.g., Identity re-verified, documentation clearance..."
                [ngModel]="reason()"
                (ngModelChange)="reason.set($event)"
              ></textarea>
            </div>
          </div>

          <!-- CLOSE MODE -->
          <div *ngIf="mode() === 'CLOSE'" class="mode-section" data-testid="close-section">
            <!-- Non-Zero Balance Warning (BR-F05) -->
            <div
              *ngIf="!isZeroBalance()"
              class="advisory-box danger"
              data-testid="close-balance-error"
            >
              <span class="advisory-icon">⛔</span>
              <div class="advisory-text">
                <strong>INVARIANT VIOLATION (BR-F05):</strong> Core ledger invariants prohibit
                closing accounts with non-zero balances (Current: {{ formattedBalance() }}).
                <div class="sweep-instruction">
                  Operator action required: Sweep all remaining funds to an internal suspense
                  account before closing.
                </div>
              </div>
            </div>

            <!-- Zero Balance Confirmation Flow -->
            <div *ngIf="isZeroBalance()" class="zero-close-flow">
              <div class="advisory-box danger">
                <span class="advisory-icon">⚠</span>
                <div class="advisory-text">
                  <strong>Permanent Irreversible Action (FR-OPS-ACC-02):</strong> Closing an account
                  permanently terminates it. This operation cannot be undone.
                </div>
              </div>

              <div class="form-group">
                <label for="close-confirm" class="form-label">
                  To confirm permanent closure, type <strong>CLOSE</strong>:
                </label>
                <input
                  id="close-confirm"
                  type="text"
                  class="form-input font-mono"
                  data-testid="close-confirm-input"
                  placeholder="CLOSE"
                  [ngModel]="confirmCloseText()"
                  (ngModelChange)="confirmCloseText.set($event)"
                />
              </div>
            </div>
          </div>

          <!-- Modal Error Banner -->
          <div *ngIf="error()" class="modal-error-banner" data-testid="modal-error-banner">
            <span class="error-icon">⚠</span>
            <span class="error-msg">{{ error() }}</span>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button
            type="button"
            class="modal-btn secondary"
            data-testid="modal-cancel-btn"
            (click)="handleCancel()"
            [disabled]="submitting()"
          >
            Cancel
          </button>
          <button
            type="button"
            class="modal-btn"
            [ngClass]="{
              warning: mode() === 'FREEZE',
              success: mode() === 'UNFREEZE',
              danger: mode() === 'CLOSE',
            }"
            data-testid="modal-submit-btn"
            (click)="submit()"
            [disabled]="!isSubmitEnabled()"
          >
            <span *ngIf="submitting()" class="spinner"></span>
            {{ submitBtnText() }}
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
        background: rgba(11, 17, 32, 0.85);
        backdrop-filter: blur(4px);
        z-index: 1050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        animation: fadeIn 150ms ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .modal-dialog {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        width: 100%;
        max-width: 520px;
        box-shadow:
          0 20px 25px -5px rgba(0, 0, 0, 0.5),
          0 8px 10px -6px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .modal-header {
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.6);
      }

      .header-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mode-icon {
        font-size: 16px;
      }

      .modal-title {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .close-icon-btn {
        background: transparent;
        border: none;
        color: var(--ble-color-text-muted, #64748b);
        font-size: 14px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
      }

      .close-icon-btn:hover {
        color: #f8fafc;
        background: var(--ble-color-surface-subtle, #334155);
      }

      /* Account Summary */
      .account-summary-card {
        background: rgba(15, 23, 42, 0.7);
        margin: 14px 18px 0 18px;
        padding: 10px 14px;
        border: 1px solid rgba(51, 65, 85, 0.6);
        border-radius: 6px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px 16px;
      }

      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .summary-label {
        font-size: 10px;
        color: var(--ble-color-text-muted, #64748b);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .summary-value {
        font-size: 12px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      /* Body */
      .modal-body {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .advisory-box {
        padding: 10px 12px;
        border-radius: 6px;
        display: flex;
        gap: 10px;
        font-size: 12px;
        line-height: 1.4;
      }

      .advisory-box.warning {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #fef08a;
      }

      .advisory-box.success {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #a7f3d0;
      }

      .advisory-box.danger {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
      }

      .advisory-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .sweep-instruction {
        margin-top: 6px;
        font-size: 11px;
        color: #fecaca;
        font-style: italic;
      }

      .zero-close-flow {
        display: flex;
        flex-direction: column;
        gap: 12px;
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

      .required {
        color: #f87171;
      }

      .form-textarea,
      .form-input {
        background: var(--ble-color-surface-muted, #0f172a);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 5px;
        color: #f8fafc;
        padding: 8px 10px;
        font-size: 12px;
        outline: none;
        resize: vertical;
      }

      .form-textarea:focus,
      .form-input:focus {
        border-color: #3b82f6;
      }

      .form-hint {
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .form-hint.hint-error {
        color: #f87171;
      }

      .modal-error-banner {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        padding: 8px 12px;
        border-radius: 5px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      /* Footer */
      .modal-footer {
        padding: 12px 18px;
        border-top: 1px solid var(--ble-color-border, #334155);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        background: rgba(15, 23, 42, 0.4);
      }

      .modal-btn {
        padding: 7px 16px;
        border-radius: 5px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid transparent;
        transition: all 150ms ease;
      }

      .modal-btn.secondary {
        background: transparent;
        border-color: var(--ble-color-border, #334155);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .modal-btn.secondary:hover:not(:disabled) {
        background: var(--ble-color-surface-subtle, #334155);
      }

      .modal-btn.warning {
        background: #f59e0b;
        color: #000000;
      }

      .modal-btn.warning:hover:not(:disabled) {
        background: #d97706;
      }

      .modal-btn.success {
        background: #10b981;
        color: #ffffff;
      }

      .modal-btn.success:hover:not(:disabled) {
        background: #059669;
      }

      .modal-btn.danger {
        background: #ef4444;
        color: #ffffff;
      }

      .modal-btn.danger:hover:not(:disabled) {
        background: #dc2626;
      }

      .modal-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: currentColor;
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
export class AccountLifecycleModalComponent {
  adminService: AccountAdminService;

  /** The target account on which the lifecycle action will be executed. */
  readonly account = signal<AccountResponse | null>(null);
  @Input('account') set accountInput(v: AccountResponse | null) {
    this.account.set(v);
  }

  /** The lifecycle mode to execute: 'FREEZE' | 'UNFREEZE' | 'CLOSE'. */
  readonly mode = signal<LifecycleMode>('FREEZE');
  @Input('mode') set modeInput(v: LifecycleMode) {
    this.mode.set(v);
  }

  /** Controls whether the modal dialog is open and visible. */
  readonly isOpen = signal<boolean>(false);
  @Input('isOpen') set isOpenInput(v: boolean) {
    this.isOpen.set(v);
  }

  /** Emitted when the modal is closed or cancelled. */
  @Output() readonly onClose = new EventEmitter<void>();

  /** Emitted upon successful execution of the lifecycle mutation. */
  @Output() readonly onSuccess = new EventEmitter<{
    accountId: string;
    status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  }>();

  // Internal Form State
  readonly reason = signal<string>('');
  readonly confirmCloseText = signal<string>('');
  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Computeds
  readonly formattedBalance = computed<string>(() => {
    const acc = this.account();
    return acc ? this.adminService.formatBalance(acc) : '—';
  });

  /** Checks if account balance is precisely 0.00 for BR-F05 closure invariant. */
  readonly isZeroBalance = computed<boolean>(() => {
    const acc = this.account();
    return acc ? this.adminService.isZeroBalance(acc) : false;
  });

  /** FREEZE requires a non-empty administrative justification reason (min 3 chars). */
  readonly isFreezeValid = computed<boolean>(() => {
    return this.reason().trim().length >= 3;
  });

  /** UNFREEZE does not mandate notes, always eligible to submit. */
  readonly isUnfreezeValid = computed<boolean>(() => {
    return true;
  });

  /** CLOSE requires zero balance and explicit confirmation input matching 'CLOSE'. */
  readonly isCloseValid = computed<boolean>(() => {
    return this.isZeroBalance() && this.confirmCloseText().trim() === 'CLOSE';
  });

  /** Determines whether the primary action button is enabled based on active mode validation. */
  readonly isSubmitEnabled = computed<boolean>(() => {
    if (this.submitting() || !this.account()) return false;
    switch (this.mode()) {
      case 'FREEZE':
        return this.isFreezeValid();
      case 'UNFREEZE':
        return this.isUnfreezeValid();
      case 'CLOSE':
        return this.isCloseValid();
      default:
        return false;
    }
  });

  readonly modalTitle = computed<string>(() => {
    switch (this.mode()) {
      case 'FREEZE':
        return 'Administrative Account Freeze';
      case 'UNFREEZE':
        return 'Restore Account Operations';
      case 'CLOSE':
        return 'Permanent Account Closure';
      default:
        return 'Account Action';
    }
  });

  readonly modeIcon = computed<string>(() => {
    switch (this.mode()) {
      case 'FREEZE':
        return '❄';
      case 'UNFREEZE':
        return '🔓';
      case 'CLOSE':
        return '⛔';
      default:
        return '⚙';
    }
  });

  readonly submitBtnText = computed<string>(() => {
    switch (this.mode()) {
      case 'FREEZE':
        return 'Freeze Account';
      case 'UNFREEZE':
        return 'Unfreeze Account';
      case 'CLOSE':
        return 'Confirm Permanent Closure';
      default:
        return 'Confirm';
    }
  });

  constructor(service?: AccountAdminService) {
    if (service) {
      this.adminService = service;
    } else {
      this.adminService = inject(AccountAdminService);
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

  /**
   * Resets local form state and emits the modal close event.
   */
  handleCancel(): void {
    this.reason.set('');
    this.confirmCloseText.set('');
    this.error.set(null);
    this.submitting.set(false);
    this.isOpen.set(false);
    this.onClose.emit();
  }

  /**
   * Executes the appropriate lifecycle mutation via AccountAdminService.
   */
  async submit(): Promise<void> {
    const acc = this.account();
    if (!acc || !acc.id || !this.isSubmitEnabled()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      if (this.mode() === 'FREEZE') {
        await this.adminService.freezeAccount(acc.id, this.reason().trim());
        this.onSuccess.emit({ accountId: acc.id, status: 'FROZEN' });
      } else if (this.mode() === 'UNFREEZE') {
        const reasonParam = this.reason().trim().length > 0 ? this.reason().trim() : undefined;
        await this.adminService.unfreezeAccount(acc.id, reasonParam);
        this.onSuccess.emit({ accountId: acc.id, status: 'ACTIVE' });
      } else if (this.mode() === 'CLOSE') {
        await this.adminService.closeAccount(acc.id);
        this.onSuccess.emit({ accountId: acc.id, status: 'CLOSED' });
      }

      this.handleCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed on server';
      this.error.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }
}
