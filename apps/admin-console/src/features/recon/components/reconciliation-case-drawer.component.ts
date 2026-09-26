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
import { ReconAdminService } from '../services/recon-admin.service';
import type {
  ReconciliationCaseResponse,
  ReconciliationCaseHistoryResponse,
} from '@ble-frontend/api-client';

/**
 * ReconciliationCaseDrawerComponent
 *
 * Back-office slide-over drawer for inspecting discrepancy cases (FR-OPS-RECON-02).
 * Compares external clearing records against internal double-entry ledger entries side-by-side,
 * displays variance delta calculations, audit trails, and triggers resolution/escalation workflows.
 */
@Component({
  selector: 'ble-reconciliation-case-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="drawer-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="recon-case-backdrop"
    >
      <div
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-drawer-title"
        data-testid="recon-case-drawer"
      >
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="header-titles">
            <span class="header-icon">⚖</span>
            <div>
              <div class="title-row">
                <h3 id="case-drawer-title" class="title-text">Discrepancy Case Inspection</h3>
                <span
                  class="status-chip"
                  [ngClass]="(targetCase()?.status || 'OPEN').toLowerCase()"
                  data-testid="drawer-case-status"
                >
                  {{ targetCase()?.status || 'OPEN' }}
                </span>
                <span class="discrepancy-chip" data-testid="drawer-case-disc-type">
                  {{ targetCase()?.discrepancyType || 'MISMATCH' }}
                </span>
              </div>
              <p class="subtitle-text mono" data-testid="drawer-case-id">
                Case ID: {{ targetCase()?.id }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleClose()"
            aria-label="Close drawer"
            data-testid="recon-case-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Meta Strip -->
        <div class="meta-strip" *ngIf="targetCase()" data-testid="drawer-case-meta-strip">
          <div class="meta-item">
            <span class="meta-label">Reconciliation Job</span>
            <span class="meta-val mono">{{ targetCase()?.jobId || 'N/A' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Currency</span>
            <span class="meta-val font-semibold">{{ targetCase()?.currency || 'EUR' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Assigned To</span>
            <span class="meta-val">{{ targetCase()?.assignedTo || 'Unassigned' }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Created At</span>
            <span class="meta-val mono">{{
              targetCase()?.createdAt ? (targetCase()?.createdAt | date: 'medium') : 'N/A'
            }}</span>
          </div>
        </div>

        <!-- Side-by-Side Comparison Container -->
        <div class="drawer-body">
          <div class="section-title">
            <span>Transaction Comparison Analysis</span>
            <span class="section-sub">External Clearing File vs. Internal Double-Entry Ledger</span>
          </div>

          <div class="comparison-grid" data-testid="comparison-grid">
            <!-- Left: External Bank Clearing Record -->
            <div class="comparison-card external" data-testid="card-external-record">
              <div class="card-header">
                <span class="card-icon">🏦</span>
                <span class="card-title">External Clearing File</span>
              </div>
              <div class="card-field">
                <span class="field-label">External Tx ID</span>
                <span class="field-val mono">{{ targetCase()?.externalTransactionId || 'N/A' }}</span>
              </div>
              <div class="card-field">
                <span class="field-label">External Recorded Amount</span>
                <span class="field-val amount-val mono">
                  {{ targetCase()?.currency || 'EUR' }}
                  {{ (targetCase()?.discrepancyAmount || 0) | number: '1.2-2' }}
                </span>
              </div>
              <div class="card-field">
                <span class="field-label">Status in Network</span>
                <span class="field-val badge-neutral">REPORTED_SETTLED</span>
              </div>
            </div>

            <!-- Variance Delta Pillar -->
            <div class="variance-pillar" data-testid="variance-pillar">
              <span class="variance-label">Net Variance</span>
              <span class="variance-delta mono">
                Δ {{ (targetCase()?.discrepancyAmount || 0) | number: '1.2-2' }}
              </span>
              <span class="variance-chip warning">
                {{ targetCase()?.discrepancyType || 'DISCREPANCY' }}
              </span>
            </div>

            <!-- Right: Internal Ledger Posting -->
            <div class="comparison-card internal" data-testid="card-internal-record">
              <div class="card-header">
                <span class="card-icon">📖</span>
                <span class="card-title">Internal Ledger State</span>
              </div>
              <div class="card-field">
                <span class="field-label">Internal Tx ID</span>
                <span class="field-val mono">{{ targetCase()?.internalTransactionId || 'MISSING_POSTING' }}</span>
              </div>
              <div class="card-field">
                <span class="field-label">Ledger Booking Status</span>
                <span class="field-val">
                  <span
                    class="field-tag"
                    [class.danger]="!targetCase()?.internalTransactionId"
                    [class.success]="!!targetCase()?.internalTransactionId"
                  >
                    {{ targetCase()?.internalTransactionId ? 'POSTED_ENTRY' : 'UNMATCHED_IN_LEDGER' }}
                  </span>
                </span>
              </div>
              <div class="card-field">
                <span class="field-label">Compensating Tx</span>
                <span class="field-val mono">{{ targetCase()?.compensatingTransactionId || 'None' }}</span>
              </div>
            </div>
          </div>

          <!-- Notes / Description -->
          <div class="notes-panel" *ngIf="targetCase()?.notes" data-testid="drawer-notes-panel">
            <span class="notes-title">Operator Notes & Description</span>
            <p class="notes-body">{{ targetCase()?.notes }}</p>
          </div>

          <!-- Audit & Resolution History Timeline -->
          <div class="history-section" data-testid="drawer-history-section">
            <div class="section-title">
              <span>Audit & Resolution History</span>
              <span class="section-sub">Immutable lifecycle events</span>
            </div>

            <div class="timeline" *ngIf="historyItems().length > 0; else noHistory">
              <div
                class="timeline-item"
                *ngFor="let h of historyItems()"
                data-testid="timeline-item"
              >
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="timeline-action font-semibold">{{ h.action || 'STATUS_UPDATE' }}</span>
                    <span class="timeline-time mono">{{ h.timestamp ? (h.timestamp | date: 'short') : 'Just now' }}</span>
                  </div>
                  <div class="timeline-meta">
                    <span class="meta-tag">From: {{ h.fromStatus || 'N/A' }} → To: {{ h.toStatus || 'N/A' }}</span>
                    <span class="operator-tag" *ngIf="h.changedBy">By: {{ h.changedBy }}</span>
                  </div>
                  <p class="timeline-notes" *ngIf="h.notes">{{ h.notes }}</p>
                </div>
              </div>
            </div>

            <ng-template #noHistory>
              <div class="empty-history" data-testid="empty-history">
                <span>No prior lifecycle events recorded for this case.</span>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- Drawer Action Footer -->
        <div class="drawer-footer">
          <button
            type="button"
            class="btn-secondary"
            (click)="handleClose()"
            data-testid="case-drawer-close-btn"
          >
            Close
          </button>

          <div class="action-btn-group" *ngIf="canTakeAction()">
            <button
              type="button"
              class="btn-escalate"
              (click)="onEscalateClick()"
              data-testid="case-drawer-escalate-btn"
            >
              <span class="btn-icon">⚡</span>
              <span>Escalate Case</span>
            </button>
            <button
              type="button"
              class="btn-resolve"
              (click)="onResolveClick()"
              data-testid="case-drawer-resolve-btn"
            >
              <span class="btn-icon">✓</span>
              <span>Resolve Discrepancy</span>
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
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex;
        justify-content: flex-end;
      }

      .drawer-panel {
        width: 100%;
        max-width: 780px;
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
        line-height: 1;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .status-chip {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;
        text-transform: uppercase;
      }

      .status-chip.open,
      .status-chip.assigned {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.3);
      }

      .status-chip.escalated {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .status-chip.resolved,
      .status-chip.closed {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .discrepancy-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
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

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .section-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-bottom: 4px;
      }

      .section-title span:first-child {
        font-size: 14px;
        font-weight: 600;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .section-sub {
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .comparison-grid {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 16px;
        align-items: stretch;
      }

      .comparison-card {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .comparison-card.external {
        border-top: 3px solid #38bdf8;
      }

      .comparison-card.internal {
        border-top: 3px solid #a855f7;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .card-icon {
        font-size: 16px;
      }

      .card-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .card-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .field-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .field-val {
        font-size: 13px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .amount-val {
        font-size: 16px;
        font-weight: 700;
        color: #38bdf8;
      }

      .field-tag {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .field-tag.danger {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .field-tag.success {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .variance-pillar {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: rgba(15, 23, 42, 0.3);
        border: 1px dashed var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 12px 14px;
        min-width: 110px;
      }

      .variance-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .variance-delta {
        font-size: 14px;
        font-weight: 700;
        color: #fbbf24;
      }

      .variance-chip {
        font-size: 9px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .variance-chip.warning {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .notes-panel {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 12px 16px;
      }

      .notes-title {
        display: block;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--ble-color-text-secondary, #94a3b8);
        margin-bottom: 6px;
      }

      .notes-body {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .timeline {
        display: flex;
        flex-direction: column;
        gap: 16px;
        position: relative;
        padding-left: 20px;
        border-left: 2px solid var(--ble-color-border, #334155);
        margin-top: 12px;
      }

      .timeline-item {
        position: relative;
      }

      .timeline-dot {
        position: absolute;
        left: -26px;
        top: 4px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #38bdf8;
        border: 2px solid var(--ble-color-surface, #1e293b);
      }

      .timeline-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .timeline-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .timeline-action {
        font-size: 12px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .timeline-time {
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .timeline-meta {
        display: flex;
        gap: 8px;
        font-size: 11px;
      }

      .meta-tag {
        color: #94a3b8;
      }

      .operator-tag {
        color: #38bdf8;
      }

      .timeline-notes {
        margin: 4px 0 0;
        font-size: 12px;
        color: #cbd5e1;
        background: rgba(0, 0, 0, 0.2);
        padding: 6px 10px;
        border-radius: 4px;
      }

      .empty-history {
        padding: 24px;
        text-align: center;
        font-size: 12px;
        color: var(--ble-color-text-secondary, #94a3b8);
        border: 1px dashed var(--ble-color-border, #334155);
        border-radius: 6px;
        margin-top: 12px;
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
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .btn-escalate {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #f87171;
        font-size: 13px;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .btn-escalate:hover {
        background: rgba(239, 68, 68, 0.25);
        color: #fca5a5;
      }

      .btn-resolve {
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
        transition: all 0.15s ease;
      }

      .btn-resolve:hover {
        background: #0369a1;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .font-semibold {
        font-weight: 600;
      }
    `,
  ],
})
export class ReconciliationCaseDrawerComponent {
  readonly reconService: ReconAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetCase = signal<ReconciliationCaseResponse | null>(null);

  @Input() set open(value: boolean) {
    this.isOpen.set(value);
  }

  @Input() set caseItem(value: ReconciliationCaseResponse | null) {
    this.targetCase.set(value);
  }

  @Output() closed = new EventEmitter<void>();
  @Output() resolveRequested = new EventEmitter<ReconciliationCaseResponse>();
  @Output() escalateRequested = new EventEmitter<ReconciliationCaseResponse>();

  readonly historyItems = computed<ReconciliationCaseHistoryResponse[]>(() => {
    const c = this.targetCase();
    if (!c) return [];
    return c.auditHistory || c.history || [];
  });

  readonly canTakeAction = computed<boolean>(() => {
    const st = (this.targetCase()?.status || '').toUpperCase();
    return st === 'OPEN' || st === 'ASSIGNED' || st === 'ESCALATED';
  });

  constructor(service?: ReconAdminService) {
    this.reconService = service ?? inject(ReconAdminService);
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

  onResolveClick(): void {
    const c = this.targetCase();
    if (c) {
      this.resolveRequested.emit(c);
    }
  }

  onEscalateClick(): void {
    const c = this.targetCase();
    if (c) {
      this.escalateRequested.emit(c);
    }
  }
}
