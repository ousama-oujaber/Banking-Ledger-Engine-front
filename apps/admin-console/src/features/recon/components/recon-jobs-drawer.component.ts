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
  ReconciliationItemResponse,
} from '@ble-frontend/api-client';

/**
 * ReconJobsDrawerComponent
 *
 * Slide-over inspector for reviewing clearing batch reconciliation jobs and their
 * individual transaction match records (FR-OPS-RECON-02).
 */
@Component({
  selector: 'ble-recon-jobs-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="drawer-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="recon-jobs-backdrop"
    >
      <div
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jobs-drawer-title"
        data-testid="recon-jobs-drawer"
      >
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="header-titles">
            <span class="header-icon">📑</span>
            <div>
              <div class="title-row">
                <h3 id="jobs-drawer-title" class="title-text">
                  Reconciliation Jobs & Clearing Batches
                </h3>
                <span class="badge-count" data-testid="jobs-count-badge">
                  {{ reconService.jobs().length }} Jobs
                </span>
              </div>
              <p class="subtitle-text">
                Audit automated matching runs across clearing payment rails
              </p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleClose()"
            aria-label="Close drawer"
            data-testid="recon-jobs-close-btn"
          >
            ✕
          </button>
        </div>

        <!-- Master-Detail Layout -->
        <div class="drawer-body">
          <!-- Top Section: Jobs List -->
          <div class="jobs-list-container" data-testid="jobs-list-container">
            <div class="section-header">
              <span class="section-title">Clearing Reconciliation Runs</span>
              <button
                type="button"
                class="btn-refresh"
                (click)="reconService.loadJobs()"
                [disabled]="reconService.jobsLoading()"
                data-testid="refresh-jobs-btn"
              >
                <span>↻</span>
                <span>Refresh</span>
              </button>
            </div>

            <!-- Jobs Table -->
            <div class="table-wrapper">
              <table class="data-table" data-testid="jobs-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Source Rail</th>
                    <th>Statement Ref</th>
                    <th>Business Date</th>
                    <th>Status</th>
                    <th class="text-right">Total Ext</th>
                    <th class="text-right">Matched</th>
                    <th class="text-right">Discrepancies</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    *ngFor="let j of reconService.jobs()"
                    [class.selected-row]="reconService.selectedJob()?.id === j.id"
                    (click)="selectJob(j)"
                    data-testid="job-row"
                  >
                    <td class="mono font-semibold text-primary">{{ j.id }}</td>
                    <td>
                      <span class="rail-tag">{{ j.source || 'ALL' }}</span>
                    </td>
                    <td class="mono">{{ j.statementReference || 'N/A' }}</td>
                    <td class="mono">{{ j.businessDate || 'N/A' }}</td>
                    <td>
                      <span class="status-chip" [ngClass]="(j.status || 'PENDING').toLowerCase()">
                        {{ j.status || 'PENDING' }}
                      </span>
                    </td>
                    <td class="text-right mono">{{ j.totalExternalRecords ?? 0 }}</td>
                    <td class="text-right mono text-success">{{ j.matchedCount ?? 0 }}</td>
                    <td
                      class="text-right mono font-semibold"
                      [class.text-danger]="(j.discrepancyCount ?? 0) > 0"
                    >
                      {{ j.discrepancyCount ?? 0 }}
                    </td>
                    <td>
                      <button
                        type="button"
                        class="btn-inspect-job"
                        (click)="selectJob(j); $event.stopPropagation()"
                        data-testid="inspect-job-btn"
                      >
                        Inspect Items
                      </button>
                    </td>
                  </tr>
                  <tr *ngIf="reconService.jobs().length === 0">
                    <td colspan="9" class="empty-cell" data-testid="empty-jobs">
                      No reconciliation jobs found.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Bottom Section: Selected Job Item Inspection -->
          <div
            class="job-items-container"
            *ngIf="reconService.selectedJob()"
            data-testid="job-items-container"
          >
            <div class="items-header">
              <div>
                <span class="section-title">
                  Items for Job <span class="mono">{{ reconService.selectedJob()?.id }}</span>
                </span>
                <span class="sub-stat"> Showing {{ reconService.jobItems().length }} records </span>
              </div>

              <!-- Match Status Filter -->
              <div class="filter-group">
                <label for="item-status-filter" class="filter-label">Match Status:</label>
                <select
                  id="item-status-filter"
                  class="filter-select"
                  [ngModel]="matchStatusFilter()"
                  (ngModelChange)="onFilterChange($event)"
                  data-testid="item-status-filter"
                >
                  <option value="ALL">All Items</option>
                  <option value="MATCHED">MATCHED</option>
                  <option value="DISCREPANCY">DISCREPANCY</option>
                  <option value="UNMATCHED">UNMATCHED</option>
                </select>
              </div>
            </div>

            <!-- Items Loading Indicator -->
            <div
              class="loading-bar"
              *ngIf="reconService.itemsLoading()"
              data-testid="items-loading"
            >
              <span class="spinner"></span>
              <span>Loading clearing records...</span>
            </div>

            <!-- Items Table -->
            <div class="table-wrapper items-table-wrapper" *ngIf="!reconService.itemsLoading()">
              <table class="data-table" data-testid="job-items-table">
                <thead>
                  <tr>
                    <th>Match Status</th>
                    <th>Ext Tx ID</th>
                    <th>Int Tx ID</th>
                    <th class="text-right">External Amt</th>
                    <th class="text-right">Internal Amt</th>
                    <th>Difference / Details</th>
                    <th>Discrepancy Case</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of reconService.jobItems()" data-testid="job-item-row">
                    <td>
                      <span
                        class="status-chip"
                        [ngClass]="(item.matchStatus || 'UNMATCHED').toLowerCase()"
                      >
                        {{ item.matchStatus || 'UNMATCHED' }}
                      </span>
                    </td>
                    <td class="mono">{{ item.externalTransactionId || 'N/A' }}</td>
                    <td class="mono">{{ item.internalTransactionId || 'NONE' }}</td>
                    <td class="text-right mono">
                      {{ item.externalAmount || 0 | number: '1.2-2' }}
                    </td>
                    <td class="text-right mono">
                      {{ item.internalAmount || 0 | number: '1.2-2' }}
                    </td>
                    <td>
                      <span class="details-text">
                        {{ item.differenceDetails || item.discrepancyDetails || 'Balanced' }}
                      </span>
                    </td>
                    <td>
                      <button
                        *ngIf="item.caseId"
                        type="button"
                        class="btn-link-case"
                        (click)="navigateToCase(item.caseId)"
                        data-testid="open-case-link"
                      >
                        Case {{ item.caseId }} →
                      </button>
                      <span *ngIf="!item.caseId" class="text-muted">—</span>
                    </td>
                  </tr>
                  <tr *ngIf="reconService.jobItems().length === 0">
                    <td colspan="7" class="empty-cell" data-testid="empty-job-items">
                      No matching records for this job and filter.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="drawer-footer">
          <button
            type="button"
            class="btn-close"
            (click)="handleClose()"
            data-testid="jobs-drawer-close-btn"
          >
            Close
          </button>
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
        max-width: 960px;
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
        gap: 12px;
      }

      .title-text {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .badge-count {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 9999px;
        background: rgba(14, 165, 233, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(14, 165, 233, 0.3);
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

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .section-title {
        font-size: 13px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .btn-refresh {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .btn-refresh:hover:not(:disabled) {
        color: #f8fafc;
        border-color: #475569;
      }

      .table-wrapper {
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        overflow-x: auto;
        background: rgba(15, 23, 42, 0.3);
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
      }

      .data-table th {
        background: rgba(15, 23, 42, 0.7);
        color: var(--ble-color-text-secondary, #94a3b8);
        font-weight: 600;
        padding: 10px 12px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .data-table td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .data-table tbody tr {
        cursor: pointer;
        transition: background 0.1s ease;
      }

      .data-table tbody tr:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .selected-row {
        background: rgba(56, 189, 248, 0.08) !important;
      }

      .rail-tag {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(148, 163, 184, 0.1);
        color: #cbd5e1;
        border: 1px solid rgba(148, 163, 184, 0.2);
      }

      .status-chip {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 9999px;
        text-transform: uppercase;
      }

      .status-chip.completed,
      .status-chip.matched {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
      }

      .status-chip.running,
      .status-chip.in_progress {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
      }

      .status-chip.failed,
      .status-chip.discrepancy {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .status-chip.unmatched,
      .status-chip.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .btn-inspect-job {
        background: rgba(56, 189, 248, 0.1);
        border: 1px solid rgba(56, 189, 248, 0.3);
        color: #38bdf8;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
      }

      .btn-inspect-job:hover {
        background: rgba(56, 189, 248, 0.2);
      }

      .job-items-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-top: 1px dashed var(--ble-color-border, #334155);
        padding-top: 16px;
      }

      .items-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .sub-stat {
        display: block;
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
        margin-top: 2px;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-size: 11px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .filter-select {
        background: var(--ble-color-background, #0b1120);
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-primary, #f8fafc);
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 4px;
        outline: none;
      }

      .items-table-wrapper {
        max-height: 280px;
        overflow-y: auto;
      }

      .details-text {
        color: #cbd5e1;
        font-size: 11px;
      }

      .btn-link-case {
        background: transparent;
        border: none;
        color: #38bdf8;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
      }

      .btn-link-case:hover {
        color: #7dd3fc;
      }

      .loading-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 24px;
        justify-content: center;
        font-size: 12px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .empty-cell {
        text-align: center;
        padding: 24px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .drawer-footer {
        padding: 16px 24px;
        border-top: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.4);
        display: flex;
        justify-content: flex-end;
      }

      .btn-close {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
      }

      .btn-close:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .text-right {
        text-align: right;
      }

      .text-primary {
        color: #38bdf8;
      }

      .text-success {
        color: #4ade80;
      }

      .text-danger {
        color: #f87171;
      }

      .text-muted {
        color: #64748b;
      }

      .spinner {
        width: 14px;
        height: 14px;
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
export class ReconJobsDrawerComponent {
  readonly reconService: ReconAdminService;

  readonly isOpen = signal<boolean>(false);
  readonly matchStatusFilter = signal<string>('ALL');

  @Input() set open(value: boolean) {
    this.isOpen.set(value);
    if (value && this.reconService.jobs().length === 0) {
      this.reconService.loadJobs();
    }
  }

  @Output() closed = new EventEmitter<void>();
  @Output() caseSelected = new EventEmitter<string>();

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

  selectJob(job: ReconciliationJobResponse): void {
    if (job.id) {
      const filter = this.matchStatusFilter();
      this.reconService.loadJobDetails(job.id, filter !== 'ALL' ? filter : undefined);
    }
  }

  onFilterChange(status: string): void {
    this.matchStatusFilter.set(status);
    const selected = this.reconService.selectedJob();
    if (selected?.id) {
      this.reconService.loadJobDetails(selected.id, status !== 'ALL' ? status : undefined);
    }
  }

  navigateToCase(caseId: string): void {
    this.caseSelected.emit(caseId);
    this.handleClose();
  }
}
