import {
  Component,
  signal,
  Input,
  Output,
  EventEmitter,
  inject,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DlqAdminService } from '../services/dlq-admin.service';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

/**
 * DiscardConfirmModalComponent
 *
 * Back-office confirmation modal for permanently discarding unrecoverable or poisoned dead-letter events.
 */
@Component({
  selector: 'ble-discard-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="discard-modal-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-modal-title"
        data-testid="discard-confirm-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">✕</span>
            <div>
              <h3 id="discard-modal-title" class="title-text">Discard Dead-Letter Event</h3>
              <p class="subtitle-text">Permanently purge event from delivery pipeline</p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="discard-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Danger Callout -->
        <div class="callout danger" data-testid="discard-callout">
          <span class="callout-icon">⛔</span>
          <div class="callout-text">
            <strong>Irreversible Action:</strong> Discarding marks this event as dead-ended.
            Subscribers will not receive this event and no further automatic or manual retries will
            be attempted.
          </div>
        </div>

        <!-- Event Summary -->
        <div class="event-summary-card" *ngIf="targetEvent()" data-testid="discard-event-summary">
          <div class="summary-col">
            <span class="summary-label">Event ID</span>
            <span class="summary-val mono">{{ targetEvent()?.id }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Topic</span>
            <span class="summary-val font-semibold">{{ targetEvent()?.topic }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Failure Reason</span>
            <span class="summary-val text-danger truncate">{{
              targetEvent()?.errorMessage || 'Unknown error'
            }}</span>
          </div>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="discard-error-box">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ error() }}</span>
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer">
          <button
            type="button"
            class="btn-cancel"
            (click)="handleCancel()"
            [disabled]="submitting()"
            data-testid="discard-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-confirm-discard"
            (click)="handleConfirm()"
            [disabled]="submitting()"
            data-testid="discard-confirm-btn"
          >
            <span class="spinner" *ngIf="submitting()"></span>
            <span>{{ submitting() ? 'Discarding...' : 'Permanently Discard' }}</span>
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
        max-width: 520px;
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
        font-size: 20px;
        color: #f87171;
        background: rgba(239, 68, 68, 0.15);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
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

      .callout.danger {
        margin: 16px 24px 0;
        padding: 12px 14px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 12px;
        color: #fca5a5;
        line-height: 1.5;
      }

      .event-summary-card {
        display: grid;
        grid-template-columns: 1fr 1fr 1.5fr;
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

      .truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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

      .modal-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 24px;
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

      .btn-confirm-discard {
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

      .btn-confirm-discard:hover:not(:disabled) {
        background: #dc2626;
      }

      .btn-confirm-discard:disabled {
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

      .font-semibold {
        font-weight: 600;
      }

      .text-danger {
        color: #f87171;
      }
    `,
  ],
})
export class DiscardConfirmModalComponent {
  readonly dlqService: DlqAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetEvent = signal<DeadLetterEventResponse | null>(null);

  readonly submitting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (value) {
      this.error.set(null);
      this.submitting.set(false);
    }
  }

  @Input() set eventItem(value: DeadLetterEventResponse | null) {
    this.targetEvent.set(value);
  }

  @Output() discarded = new EventEmitter<DeadLetterEventResponse>();
  @Output() cancelled = new EventEmitter<void>();

  constructor(service?: DlqAdminService) {
    this.dlqService = service ?? inject(DlqAdminService);
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

  async handleConfirm(): Promise<void> {
    const ev = this.targetEvent();
    if (!ev || !ev.id || this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      const res = await this.dlqService.discardEvent(ev.id);
      this.submitting.set(false);
      this.isOpen.set(false);
      this.discarded.emit(res);
    } catch (err: unknown) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : 'Discard operation failed';
      this.error.set(msg);
    }
  }
}
