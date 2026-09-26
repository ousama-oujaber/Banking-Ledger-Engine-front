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
import { SettlementAdminService } from '../services/settlement-admin.service';
import type { SettlementBatchResponse, SettlementRecordResponse } from '@ble-frontend/api-client';

/**
 * BatchRecordsDrawerComponent
 *
 * Back-office slide-over drawer for inspecting transaction items assigned to a clearing batch.
 * Computes gross debits, gross credits, and net settlement deltas while providing inline retry
 * mechanisms for failed records.
 */
@Component({
  selector: 'ble-batch-records-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="drawer-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="batch-records-backdrop"
    >
      <div
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        data-testid="batch-records-drawer"
      >
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="header-titles">
            <span class="header-icon">📑</span>
            <div>
              <div class="title-row">
                <h3 id="drawer-title" class="title-text">Batch Inspection</h3>
                <span
                  class="status-chip"
                  [ngClass]="(targetBatch()?.status || 'OPEN').toLowerCase()"
                  data-testid="drawer-batch-status"
                >
                  {{ targetBatch()?.status || 'OPEN' }}
                </span>
              </div>
              <p class="subtitle-text mono" data-testid="drawer-batch-id">
                ID: {{ targetBatch()?.id }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleClose()"
            aria-label="Close drawer"
            data-testid="batch-records-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Success Toast Notification -->
        <div class="toast-banner success" *ngIf="toastMessage()" data-testid="drawer-toast">
          <span>✓</span>
          <span>{{ toastMessage() }}</span>
        </div>

        <!-- Error Alert -->
        <div class="alert-box error" *ngIf="settlementService.error()" data-testid="drawer-error">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ settlementService.error() }}</span>
        </div>

        <!-- Meta Summary Bar -->
        <div class="meta-strip" *ngIf="targetBatch()" data-testid="drawer-meta-strip">
          <div class="meta-item">
            <span class="meta-label">Rail</span>
            <span class="meta-val font-semibold">{{ targetBatch()?.rail }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Currency</span>
            <span class="meta-val font-semibold">{{ targetBatch()?.currency }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Business Date</span>
            <span class="meta-val mono">{{ targetBatch()?.businessDate }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">External Ref</span>
            <span class="meta-val mono">{{
              targetBatch()?.externalBatchReference || 'UNASSIGNED'
            }}</span>
          </div>
        </div>

        <!-- Totals KPI Breakdown -->
        <div class="kpi-grid" data-testid="drawer-kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Gross Debit</span>
            <span class="kpi-val debit" data-testid="kpi-gross-debit">
              -{{ recordsSummary().totalGrossDebit | number: '1.2-2' }}
              {{ targetBatch()?.currency }}
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Gross Credit</span>
            <span class="kpi-val credit" data-testid="kpi-gross-credit">
              +{{ recordsSummary().totalGrossCredit | number: '1.2-2' }}
              {{ targetBatch()?.currency }}
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Net Delta</span>
            <span
              class="kpi-val"
              [class.credit]="recordsSummary().netDelta > 0"
              [class.debit]="recordsSummary().netDelta < 0"
              data-testid="kpi-net-delta"
            >
              {{ recordsSummary().netDelta >= 0 ? '+' : ''
              }}{{ recordsSummary().netDelta | number: '1.2-2' }}
              {{ targetBatch()?.currency }}
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Records Count</span>
            <span class="kpi-val" data-testid="kpi-record-count">
              {{ recordsSummary().recordCount }} items
            </span>
          </div>
        </div>

        <!-- Action Ribbon -->
        <div class="action-ribbon" *ngIf="targetBatch()" data-testid="drawer-action-ribbon">
          <div class="status-summary-chips">
            <span class="chip-sm pending" data-testid="chip-pending-count">
              ● {{ recordsSummary().pendingCount }} Pending
            </span>
            <span class="chip-sm settled" data-testid="chip-settled-count">
              ● {{ recordsSummary().settledCount }} Settled
            </span>
            <span
              class="chip-sm failed"
              *ngIf="recordsSummary().failedCount > 0"
              data-testid="chip-failed-count"
            >
              ● {{ recordsSummary().failedCount }} Failed
            </span>
          </div>

          <div class="action-buttons">
            <button
              type="button"
              class="btn-sm btn-outline"
              (click)="refreshRecords()"
              [disabled]="settlementService.recordsLoading()"
              data-testid="drawer-refresh-btn"
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              class="btn-sm btn-settle"
              *ngIf="canSettle()"
              (click)="triggerSettle()"
              data-testid="drawer-settle-btn"
            >
              ⚖ Settle Batch
            </button>
            <button
              type="button"
              class="btn-sm btn-fail"
              *ngIf="canFail()"
              (click)="triggerFail()"
              data-testid="drawer-fail-btn"
            >
              ⛔ Fail
            </button>
            <button
              type="button"
              class="btn-sm btn-close-batch"
              *ngIf="canClose()"
              (click)="triggerClose()"
              data-testid="drawer-close-batch-btn"
            >
              ✓ Close Batch
            </button>
          </div>
        </div>

        <!-- Records Table Section -->
        <div class="table-container" data-testid="drawer-table-container">
          <div class="loading-overlay" *ngIf="settlementService.recordsLoading()">
            <span class="spinner"></span>
            <span>Loading batch records...</span>
          </div>

          <table
            class="records-table"
            *ngIf="!settlementService.recordsLoading() && records().length > 0"
            data-testid="batch-records-table"
          >
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Transaction</th>
                <th>Rail</th>
                <th class="text-right">Amount</th>
                <th>Expected Date</th>
                <th>Status</th>
                <th>Retries</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of records()" [attr.data-testid]="'record-row-' + r.id">
                <td class="mono font-semibold" data-testid="record-id">{{ r.id }}</td>
                <td class="mono" data-testid="record-tx-id">
                  {{ r.transactionId || '—' }}
                </td>
                <td>
                  <span class="rail-tag">{{ r.rail || targetBatch()?.rail }}</span>
                </td>
                <td
                  class="text-right font-semibold"
                  [class.debit]="Number(r.amount?.amount || 0) < 0"
                  [class.credit]="Number(r.amount?.amount || 0) >= 0"
                  data-testid="record-amount"
                >
                  {{ r.amount?.amount | number: '1.2-2' }} {{ r.amount?.currency }}
                </td>
                <td class="mono" data-testid="record-exp-date">
                  {{ r.expectedSettlementDate || '—' }}
                </td>
                <td>
                  <span
                    class="record-status-chip"
                    [ngClass]="(r.status || 'PENDING').toLowerCase()"
                    [title]="r.failureReason || ''"
                    data-testid="record-status"
                  >
                    {{ r.status || 'PENDING' }}
                  </span>
                </td>
                <td class="mono text-center" data-testid="record-retry-count">
                  {{ r.retryCount ?? 0 }}
                </td>
                <td class="text-right">
                  <button
                    type="button"
                    class="btn-retry"
                    *ngIf="(r.status || '').toUpperCase() === 'FAILED'"
                    (click)="retryRecord(r)"
                    [disabled]="settlementService.mutating()"
                    [attr.data-testid]="'retry-btn-' + r.id"
                  >
                    ↻ Retry
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Empty State -->
          <div
            class="empty-state"
            *ngIf="!settlementService.recordsLoading() && records().length === 0"
            data-testid="drawer-empty-state"
          >
            <span class="empty-icon">📭</span>
            <h4>No Records in this Batch</h4>
            <p>Transactions will appear here once clearing items are queued into this batch.</p>
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
        background: rgba(11, 17, 32, 0.75);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: flex-end;
        z-index: 999;
      }

      .drawer-panel {
        background: var(--ble-color-surface, #1e293b);
        border-left: 1px solid var(--ble-color-border, #334155);
        width: 100%;
        max-width: 860px;
        height: 100vh;
        box-shadow: -20px 0 25px -5px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
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
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.6);
      }

      .header-titles {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .header-icon {
        font-size: 26px;
      }

      .title-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .title-text {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .subtitle-text {
        margin: 2px 0 0;
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
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
        color: var(--ble-color-text-primary, #f8fafc);
        background: rgba(255, 255, 255, 0.05);
      }

      .toast-banner.success {
        padding: 10px 24px;
        background: rgba(16, 185, 129, 0.15);
        border-bottom: 1px solid rgba(16, 185, 129, 0.3);
        color: #6ee7b7;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .alert-box.error {
        margin: 12px 24px 0;
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }

      .meta-strip {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: 12px 24px;
        background: rgba(15, 23, 42, 0.3);
        border-bottom: 1px solid var(--ble-color-border, #334155);
        gap: 16px;
      }

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .meta-label {
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.05em;
        color: var(--ble-color-text-muted, #64748b);
      }

      .meta-val {
        font-size: 12px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        padding: 16px 24px;
        gap: 12px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .kpi-card {
        background: rgba(15, 23, 42, 0.5);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .kpi-label {
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .kpi-val {
        font-size: 15px;
        font-weight: 700;
        font-family: var(--ble-font-family-mono, monospace);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .kpi-val.credit {
        color: #34d399;
      }

      .kpi-val.debit {
        color: #f87171;
      }

      .action-ribbon {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 24px;
        background: rgba(15, 23, 42, 0.4);
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .status-summary-chips {
        display: flex;
        gap: 8px;
      }

      .chip-sm {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 9999px;
      }

      .chip-sm.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .chip-sm.settled {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .chip-sm.failed {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
      }

      .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .btn-outline {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .btn-outline:hover:not(:disabled) {
        color: #f8fafc;
        border-color: #64748b;
      }

      .btn-settle {
        background: #10b981;
        border: 1px solid transparent;
        color: #fff;
      }

      .btn-settle:hover:not(:disabled) {
        background: #059669;
      }

      .btn-fail {
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }

      .btn-fail:hover:not(:disabled) {
        background: #ef4444;
        color: #fff;
      }

      .btn-close-batch {
        background: #3b82f6;
        border: 1px solid transparent;
        color: #fff;
      }

      .btn-close-batch:hover:not(:disabled) {
        background: #2563eb;
      }

      .table-container {
        flex: 1;
        overflow-y: auto;
        position: relative;
      }

      .records-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
      }

      .records-table th {
        position: sticky;
        top: 0;
        background: #1e293b;
        color: var(--ble-color-text-muted, #64748b);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
        padding: 10px 14px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
        z-index: 2;
      }

      .records-table td {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.4);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .records-table tr:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .rail-tag {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
      }

      .status-chip {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .status-chip.open,
      .status-chip.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      .status-chip.settled {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      .status-chip.failed {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .status-chip.closed {
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
        border: 1px solid rgba(148, 163, 184, 0.3);
      }

      .record-status-chip {
        display: inline-block;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .record-status-chip.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .record-status-chip.settled {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .record-status-chip.failed {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        cursor: help;
      }

      .btn-retry {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
      }

      .btn-retry:hover:not(:disabled) {
        background: #3b82f6;
        color: #fff;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 24px;
        text-align: center;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .empty-icon {
        font-size: 36px;
        margin-bottom: 12px;
      }

      .empty-state h4 {
        margin: 0 0 6px;
        font-size: 15px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .empty-state p {
        margin: 0;
        font-size: 12px;
        max-width: 320px;
      }

      .mono {
        font-family: var(--ble-font-family-mono, monospace);
      }

      .font-semibold {
        font-weight: 600;
      }

      .text-right {
        text-align: right;
      }

      .text-center {
        text-align: center;
      }

      .debit {
        color: #f87171;
      }

      .credit {
        color: #34d399;
      }

      .loading-overlay {
        position: absolute;
        inset: 0;
        background: rgba(30, 41, 59, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        z-index: 5;
        font-size: 13px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: #38bdf8;
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
export class BatchRecordsDrawerComponent {
  readonly settlementService: SettlementAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly targetBatch = signal<SettlementBatchResponse | null>(null);
  readonly toastMessage = signal<string | null>(null);

  protected readonly Number = Number;

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
    if (value && this.targetBatch()?.id) {
      this.refreshRecords();
    }
  }

  @Input()
  set batch(value: SettlementBatchResponse | null) {
    this.targetBatch.set(value);
  }

  @Output() onClose = new EventEmitter<void>();
  @Output() onTriggerSettle = new EventEmitter<SettlementBatchResponse>();
  @Output() onTriggerFail = new EventEmitter<SettlementBatchResponse>();
  @Output() onTriggerClose = new EventEmitter<SettlementBatchResponse>();

  readonly records = computed<SettlementRecordResponse[]>(() => {
    return this.settlementService.batchRecords();
  });

  readonly recordsSummary = computed(() => {
    return this.settlementService.selectedBatchRecordsSummary();
  });

  readonly canSettle = computed<boolean>(() => {
    const st = (this.targetBatch()?.status || '').toUpperCase();
    return st === 'OPEN' || st === 'PENDING';
  });

  readonly canFail = computed<boolean>(() => {
    const st = (this.targetBatch()?.status || '').toUpperCase();
    return st === 'OPEN' || st === 'PENDING';
  });

  readonly canClose = computed<boolean>(() => {
    const st = (this.targetBatch()?.status || '').toUpperCase();
    return st === 'SETTLED';
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
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
    this.settlementService.clearSelection();
    this.onClose.emit();
  }

  async refreshRecords(): Promise<void> {
    const b = this.targetBatch();
    if (b && b.id) {
      await this.settlementService.loadBatchDetails(b.id);
    }
  }

  async retryRecord(record: SettlementRecordResponse): Promise<void> {
    if (!record.id) return;
    try {
      await this.settlementService.retryRecord(record.id, this.targetBatch()?.id);
      this.showToast(`Record ${record.id} queued for retry`);
    } catch {
      // error set in service
    }
  }

  triggerSettle(): void {
    const b = this.targetBatch();
    if (b) {
      this.onTriggerSettle.emit(b);
    }
  }

  triggerFail(): void {
    const b = this.targetBatch();
    if (b) {
      this.onTriggerFail.emit(b);
    }
  }

  triggerClose(): void {
    const b = this.targetBatch();
    if (b) {
      this.onTriggerClose.emit(b);
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }
}
