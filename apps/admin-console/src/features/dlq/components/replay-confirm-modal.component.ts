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
 * ReplayConfirmModalComponent
 *
 * Back-office confirmation modal for re-queuing failed dead-letter events into the broker pipeline.
 * Supports individual event replay or bulk recovery for all pending events in view.
 */
@Component({
  selector: 'ble-replay-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="replay-modal-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-modal-title"
        data-testid="replay-confirm-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">↻</span>
            <div>
              <h3 id="replay-modal-title" class="title-text">
                {{ isBulk() ? 'Replay All Pending Events' : 'Replay Dead-Letter Event' }}
              </h3>
              <p class="subtitle-text">
                Re-publish failed message into the transactional outbox pipeline
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            data-testid="replay-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Warning Callout -->
        <div class="callout warning" data-testid="replay-callout">
          <span class="callout-icon">⚡</span>
          <div class="callout-text">
            <strong>Broker Redistribution Notice:</strong> Replaying will re-queue the message to
            the broker. Downstream consumers will receive and process this event again.
          </div>
        </div>

        <!-- Event Details (Single Mode) -->
        <div class="event-summary-card" *ngIf="!isBulk() && targetEvent()" data-testid="replay-event-summary">
          <div class="summary-col">
            <span class="summary-label">Event ID</span>
            <span class="summary-val mono">{{ targetEvent()?.id }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Topic / Channel</span>
            <span class="summary-val font-semibold text-primary">{{ targetEvent()?.topic }}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">Retries</span>
            <span class="summary-val mono">
              {{ targetEvent()?.retryCount ?? 0 }} / {{ targetEvent()?.maxRetries ?? 3 }}
            </span>
          </div>
        </div>

        <!-- Bulk Summary (Bulk Mode) -->
        <div class="bulk-summary-card" *ngIf="isBulk()" data-testid="replay-bulk-summary">
          <span class="bulk-count">{{ bulkCount() }}</span>
          <span class="bulk-label">Pending events will be submitted for re-processing</span>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="error()" data-testid="replay-error-box">
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
            data-testid="replay-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-confirm-replay"
            (click)="handleConfirm()"
            [disabled]="submitting()"
            data-testid="replay-confirm-btn"
          >
            <span class="spinner" *ngIf="submitting()"></span>
            <span>{{ submitting() ? 'Replaying...' : (isBulk() ? 'Replay All' : 'Confirm Replay') }}</span>
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

      .callout.warning {
        margin: 16px 24px 0;
        padding: 12px 14px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 6px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 12px;
        color: #fbbf24;
      }

      .event-summary-card {
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

      .bulk-summary-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        margin: 16px 24px 0;
        padding: 20px;
        background: rgba(15, 23, 42, 0.5);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        text-align: center;
      }

      .bulk-count {
        font-size: 28px;
        font-weight: 700;
        color: #38bdf8;
        font-family: ui-monospace, SFMono-Regular, monospace;
      }

      .bulk-label {
        font-size: 13px;
        color: var(--ble-color-text-secondary, #94a3b8);
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

      .btn-confirm-replay {
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

      .btn-confirm-replay:hover:not(:disabled) {
        background: #0369a1;
      }

      .btn-confirm-replay:disabled {
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

      .text-primary {
        color: #38bdf8;
      }
    `,
  ],
})
export class ReplayConfirmModalComponent {
  readonly dlqService: DlqAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetEvent = signal<DeadLetterEventResponse | null>(null);
  readonly isBulk = signal<boolean>(false);
  readonly bulkCount = signal<number>(0);

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
    this.isBulk.set(false);
  }

  @Input() set bulk(value: { active: boolean; count: number }) {
    this.isBulk.set(value.active);
    this.bulkCount.set(value.count);
    if (value.active) {
      this.targetEvent.set(null);
    }
  }

  @Output() replayed = new EventEmitter<DeadLetterEventResponse | number>();
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
    if (this.submitting()) return;

    this.submitting.set(true);
    this.error.set(null);

    try {
      if (this.isBulk()) {
        const count = await this.dlqService.replayAllPending();
        this.submitting.set(false);
        this.isOpen.set(false);
        this.replayed.emit(count);
      } else {
        const ev = this.targetEvent();
        if (!ev || !ev.id) return;
        const res = await this.dlqService.replayEvent(ev.id);
        this.submitting.set(false);
        this.isOpen.set(false);
        this.replayed.emit(res);
      }
    } catch (err: unknown) {
      this.submitting.set(false);
      const msg = err instanceof Error ? err.message : 'Replay operation failed';
      this.error.set(msg);
    }
  }
}
