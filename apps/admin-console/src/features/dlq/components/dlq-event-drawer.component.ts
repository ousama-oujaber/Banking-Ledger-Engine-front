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
import { DlqAdminService } from '../services/dlq-admin.service';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

/**
 * DlqEventDrawerComponent
 *
 * Back-office slide-over drawer for inspecting failed outbox and broker dead-letter events (FR-OPS-AUDIT-02).
 * Displays failure stack trace, payload, retry counts, transport headers, and triggers replay/discard.
 */
@Component({
  selector: 'ble-dlq-event-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="drawer-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="dlq-drawer-backdrop"
    >
      <div
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlq-drawer-title"
        data-testid="dlq-event-drawer"
      >
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="header-titles">
            <span class="header-icon">⚠</span>
            <div>
              <div class="title-row">
                <h3 id="dlq-drawer-title" class="title-text">Dead-Letter Event Diagnostics</h3>
                <span
                  class="status-chip"
                  [ngClass]="(targetEvent()?.status || 'PENDING').toLowerCase()"
                  data-testid="drawer-event-status"
                >
                  {{ targetEvent()?.status || 'PENDING' }}
                </span>
                <span class="topic-chip" data-testid="drawer-event-topic">
                  {{ targetEvent()?.topic || 'UNASSIGNED_TOPIC' }}
                </span>
              </div>
              <p class="subtitle-text mono" data-testid="drawer-event-id">
                Event ID: {{ targetEvent()?.id }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleClose()"
            aria-label="Close drawer"
            data-testid="dlq-drawer-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Copy Feedback Banner -->
        <div class="copy-banner" *ngIf="copyFeedback()" data-testid="copy-feedback">
          <span>✓</span>
          <span>{{ copyFeedback() }}</span>
        </div>

        <!-- Meta Summary Strip -->
        <div class="meta-strip" *ngIf="targetEvent()" data-testid="drawer-meta-strip">
          <div class="meta-item">
            <span class="meta-label">Event Type</span>
            <span class="meta-val font-semibold">{{ targetEvent()?.eventType || 'N/A' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Aggregate</span>
            <span class="meta-val mono">
              {{ targetEvent()?.aggregateType || 'Aggregate' }}: {{ targetEvent()?.aggregateId || 'N/A' }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Retries</span>
            <span class="meta-val mono" [class.highlight-max]="isMaxRetries()">
              {{ targetEvent()?.retryCount ?? 0 }} / {{ targetEvent()?.maxRetries ?? 3 }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Failed Timestamp</span>
            <span class="meta-val mono">
              {{ targetEvent()?.createdAt ? (targetEvent()?.createdAt | date: 'medium') : 'N/A' }}
            </span>
          </div>
        </div>

        <!-- Drawer Body -->
        <div class="drawer-body">
          <!-- Failure Root Cause Alert -->
          <div class="failure-alert" data-testid="drawer-failure-alert">
            <div class="failure-header">
              <span class="failure-title">Root Cause Error Message</span>
              <span class="original-evt mono" *ngIf="targetEvent()?.originalEventId">
                Original Evt: {{ targetEvent()?.originalEventId }}
              </span>
            </div>
            <p class="failure-message mono" data-testid="drawer-error-message">
              {{ targetEvent()?.errorMessage || 'No error message provided' }}
            </p>
          </div>

          <!-- Stack Trace Viewer -->
          <div class="section-card" *ngIf="targetEvent()?.stackTrace" data-testid="drawer-stacktrace-section">
            <div class="section-header">
              <span class="section-title">Exception Stack Trace</span>
              <button
                type="button"
                class="btn-copy"
                (click)="copyToClipboard(targetEvent()?.stackTrace, 'Stack trace copied to clipboard')"
                data-testid="copy-stacktrace-btn"
              >
                <span>📋</span>
                <span>Copy Stack Trace</span>
              </button>
            </div>
            <pre class="code-block stack-trace mono" data-testid="drawer-stacktrace">{{ targetEvent()?.stackTrace }}</pre>
          </div>

          <!-- JSON Payload Inspector -->
          <div class="section-card" data-testid="drawer-payload-section">
            <div class="section-header">
              <span class="section-title">Transactional Outbox Payload</span>
              <button
                type="button"
                class="btn-copy"
                (click)="copyToClipboard(formattedPayload(), 'Payload JSON copied to clipboard')"
                data-testid="copy-payload-btn"
              >
                <span>📋</span>
                <span>Copy JSON Payload</span>
              </button>
            </div>
            <pre class="code-block payload-json mono" data-testid="drawer-payload">{{ formattedPayload() }}</pre>
          </div>

          <!-- Message Headers Table -->
          <div class="section-card" *ngIf="headerEntries().length > 0" data-testid="drawer-headers-section">
            <div class="section-header">
              <span class="section-title">Transport & Broker Headers</span>
              <span class="badge-headers-count">{{ headerEntries().length }} Headers</span>
            </div>
            <div class="headers-table-wrap">
              <table class="headers-table">
                <thead>
                  <tr>
                    <th>Header Key</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let h of headerEntries()" data-testid="header-row">
                    <td class="mono font-semibold text-secondary">{{ h.key }}</td>
                    <td class="mono text-primary">{{ h.value }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Drawer Action Footer -->
        <div class="drawer-footer">
          <button
            type="button"
            class="btn-secondary"
            (click)="handleClose()"
            data-testid="dlq-drawer-close-action-btn"
          >
            Close
          </button>

          <div class="action-btn-group" *ngIf="canTakeAction()">
            <button
              type="button"
              class="btn-discard"
              (click)="onDiscardClick()"
              [disabled]="targetEvent()?.status === 'DISCARDED'"
              data-testid="drawer-discard-btn"
            >
              <span>✕</span>
              <span>Discard Event</span>
            </button>
            <button
              type="button"
              class="btn-replay"
              (click)="onReplayClick()"
              [disabled]="targetEvent()?.status === 'REPLAYED'"
              data-testid="drawer-replay-btn"
            >
              <span>↻</span>
              <span>Replay Event</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .drawer-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: flex-end;
      }

      .drawer-panel {
        width: 100%;
        max-width: 820px;
        height: 100%;
        background: var(--ble-color-surface, #1e293b);
        border-left: 1px solid var(--ble-color-border, #334155);
        box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }

      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.4);
      }

      .header-titles {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .header-icon {
        font-size: 24px;
        color: #f87171;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .title-text {
        margin: 0;
        font-size: 17px;
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
        padding: 6px;
        border-radius: 4px;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .copy-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 24px;
        background: rgba(34, 197, 94, 0.15);
        border-bottom: 1px solid rgba(34, 197, 94, 0.3);
        color: #4ade80;
        font-size: 12px;
        font-weight: 500;
      }

      .status-chip {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;
        text-transform: uppercase;
      }

      .status-chip.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .status-chip.replayed {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .status-chip.discarded {
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
        border: 1px solid rgba(148, 163, 184, 0.3);
      }

      .topic-chip {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.25);
      }

      .meta-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        padding: 12px 24px;
        background: rgba(15, 23, 42, 0.2);
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .meta-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .meta-val {
        font-size: 12px;
        color: var(--ble-color-text-primary, #f8fafc);
        word-break: break-all;
      }

      .highlight-max {
        color: #f87171;
        font-weight: 700;
      }

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .failure-alert {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .failure-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .failure-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #f87171;
      }

      .original-evt {
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .failure-message {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
        color: #fca5a5;
        word-break: break-word;
      }

      .section-card {
        background: rgba(15, 23, 42, 0.5);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: rgba(15, 23, 42, 0.7);
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .section-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .btn-copy {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
        font-size: 11px;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .btn-copy:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
      }

      .code-block {
        margin: 0;
        padding: 16px;
        font-size: 12px;
        line-height: 1.6;
        color: #e2e8f0;
        background: #090d16;
        overflow-x: auto;
        max-height: 240px;
        white-space: pre-wrap;
        word-break: break-all;
      }

      .stack-trace {
        color: #fda4af;
        max-height: 200px;
      }

      .badge-headers-count {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
      }

      .headers-table-wrap {
        max-height: 180px;
        overflow-y: auto;
      }

      .headers-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .headers-table th {
        background: rgba(15, 23, 42, 0.4);
        padding: 8px 16px;
        color: var(--ble-color-text-secondary, #94a3b8);
        font-weight: 600;
        text-align: left;
        border-bottom: 1px solid rgba(51, 65, 85, 0.4);
      }

      .headers-table td {
        padding: 8px 16px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.2);
      }

      .drawer-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.4);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .action-btn-group {
        display: flex;
        gap: 10px;
      }

      .btn-secondary {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
        font-size: 13px;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .btn-discard {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #f87171;
        font-size: 13px;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-discard:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.2);
      }

      .btn-discard:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-replay {
        background: var(--ble-color-primary, #0284c7);
        border: 1px solid var(--ble-color-primary, #0284c7);
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        padding: 8px 18px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .btn-replay:hover:not(:disabled) {
        background: #0369a1;
      }

      .btn-replay:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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

      .text-secondary {
        color: #94a3b8;
      }
    `,
  ],
})
export class DlqEventDrawerComponent {
  readonly dlqService: DlqAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetEvent = signal<DeadLetterEventResponse | null>(null);
  readonly copyFeedback = signal<string | null>(null);

  @Input() set open(value: boolean) {
    this.isOpen.set(value);
  }

  @Input() set eventItem(value: DeadLetterEventResponse | null) {
    this.targetEvent.set(value);
  }

  @Output() closed = new EventEmitter<void>();
  @Output() replayRequested = new EventEmitter<DeadLetterEventResponse>();
  @Output() discardRequested = new EventEmitter<DeadLetterEventResponse>();

  readonly formattedPayload = computed<string>(() => {
    const raw = this.targetEvent()?.payload;
    if (!raw) return '// No payload content';
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  });

  readonly headerEntries = computed<{ key: string; value: string }[]>(() => {
    const headers = this.targetEvent()?.headers;
    if (!headers) return [];
    return Object.entries(headers).map(([key, value]) => ({ key, value }));
  });

  readonly isMaxRetries = computed<boolean>(() => {
    const e = this.targetEvent();
    if (!e) return false;
    return (e.retryCount ?? 0) >= (e.maxRetries ?? 3);
  });

  readonly canTakeAction = computed<boolean>(() => {
    const st = (this.targetEvent()?.status || 'PENDING').toUpperCase();
    return st === 'PENDING';
  });

  constructor(service?: DlqAdminService) {
    this.dlqService = service ?? inject(DlqAdminService);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.handleClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('drawer-backdrop')) {
      this.handleClose();
    }
  }

  handleClose(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }

  onReplayClick(): void {
    const e = this.targetEvent();
    if (e) {
      this.replayRequested.emit(e);
    }
  }

  onDiscardClick(): void {
    const e = this.targetEvent();
    if (e) {
      this.discardRequested.emit(e);
    }
  }

  copyToClipboard(text: string | undefined, message: string): void {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    this.copyFeedback.set(message);
    setTimeout(() => {
      if (this.copyFeedback() === message) {
        this.copyFeedback.set(null);
      }
    }, 2500);
  }
}
