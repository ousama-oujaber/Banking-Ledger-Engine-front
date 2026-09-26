import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReconAdminService } from './services/recon-admin.service';
import {
  ReconciliationCaseDrawerComponent,
  ResolveCaseModalComponent,
  EscalateCaseModalComponent,
  RunReconJobModalComponent,
  ReconJobsDrawerComponent,
} from './components';
import type {
  ReconciliationCaseResponse,
  ReconciliationJobResponse,
} from '@ble-frontend/api-client';

/**
 * ReconciliationCasesDashboardComponent
 *
 * Back-Office External Reconciliation Case Explorer (Sprint 5 Task 3, FR-OPS-RECON-02).
 * Equips operators and auditors to inspect mismatched transactions against external bank
 * clearing files, review side-by-side ledger comparisons, and trigger administrative resolutions.
 */
@Component({
  selector: 'ble-reconciliation-cases-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReconciliationCaseDrawerComponent,
    ResolveCaseModalComponent,
    EscalateCaseModalComponent,
    RunReconJobModalComponent,
    ReconJobsDrawerComponent,
  ],
  template: `
    <div class="recon-cases-workspace" data-testid="recon-cases-workspace">
      <!-- Workspace Page Header -->
      <div class="workspace-header">
        <div class="title-block">
          <div class="breadcrumb">Operations / Reconciliation / Discrepancy Cases</div>
          <h1 class="page-title">Reconciliation Case Explorer</h1>
          <p class="page-subtitle">
            Detect, analyze, and resolve transaction mismatches between external bank clearing files
            and the immutable double-entry ledger
          </p>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-jobs"
            (click)="openJobsDrawer()"
            data-testid="recon-jobs-drawer-btn"
          >
            <span class="btn-icon">📑</span>
            <span>Clearing Jobs</span>
          </button>
          <button
            type="button"
            class="btn-refresh"
            (click)="refreshData()"
            [disabled]="reconService.loading()"
            data-testid="recon-refresh-btn"
          >
            <span class="btn-icon">↻</span>
            <span>Refresh</span>
          </button>
          <button
            type="button"
            class="btn-run-job"
            (click)="openRunJobModal()"
            data-testid="recon-run-job-btn"
          >
            <span class="btn-icon">⚙</span>
            <span>Run Reconciliation</span>
          </button>
        </div>
      </div>

      <!-- Toast Notification Banner -->
      <div class="toast-banner success" *ngIf="toastMessage()" data-testid="recon-toast">
        <span class="toast-icon">✓</span>
        <span class="toast-text">{{ toastMessage() }}</span>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-banner" data-testid="recon-kpi-banner">
        <!-- Open Cases -->
        <div class="kpi-card" data-testid="kpi-open-cases">
          <span class="kpi-label">Open / In-Triage Cases</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-open">{{ kpi().openCases }}</span>
            <span class="kpi-chip warning" *ngIf="kpi().openCases > 0">Action Required</span>
            <span class="kpi-chip success" *ngIf="kpi().openCases === 0">Clear</span>
          </div>
        </div>

        <!-- Escalated Cases -->
        <div class="kpi-card" data-testid="kpi-escalated-cases">
          <span class="kpi-label">Escalated Cases</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-escalated">{{ kpi().escalatedCases }}</span>
            <span class="kpi-chip danger" *ngIf="kpi().escalatedCases > 0">Supervisor Review</span>
            <span class="kpi-chip neutral" *ngIf="kpi().escalatedCases === 0">None</span>
          </div>
        </div>

        <!-- Discrepancy Exposure -->
        <div class="kpi-card" data-testid="kpi-exposure">
          <span class="kpi-label">Total Discrepancy Exposure</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-exposure">
              EUR {{ kpi().totalDiscrepancyAmount | number: '1.2-2' }}
            </span>
            <span class="kpi-chip neutral">Absolute Delta</span>
          </div>
        </div>

        <!-- Clearing Jobs -->
        <div class="kpi-card" data-testid="kpi-clearing-jobs">
          <span class="kpi-label">Clearing Reconciliation Runs</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono">{{ kpi().totalJobs }}</span>
            <span class="kpi-chip primary" *ngIf="kpi().runningJobs > 0">
              {{ kpi().runningJobs }} Active
            </span>
            <span class="kpi-chip neutral" *ngIf="kpi().runningJobs === 0">Idle</span>
          </div>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="toolbar" data-testid="recon-toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input"
            placeholder="Search by Case ID, Ext/Int Tx, Assignee, Notes..."
            [ngModel]="reconService.searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            data-testid="recon-search-input"
          />
        </div>

        <div class="filter-controls">
          <!-- Status Filter -->
          <div class="filter-item">
            <label for="recon-status-filter" class="filter-label">Status:</label>
            <select
              id="recon-status-filter"
              class="filter-select"
              [ngModel]="reconService.statusFilter()"
              (ngModelChange)="onStatusChange($event)"
              data-testid="recon-status-filter"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <!-- Discrepancy Type Filter -->
          <div class="filter-item">
            <label for="recon-disc-filter" class="filter-label">Discrepancy Type:</label>
            <select
              id="recon-disc-filter"
              class="filter-select"
              [ngModel]="reconService.discrepancyFilter()"
              (ngModelChange)="onDiscrepancyChange($event)"
              data-testid="recon-disc-filter"
            >
              <option value="ALL">All Types</option>
              <option value="AMOUNT_MISMATCH">AMOUNT_MISMATCH</option>
              <option value="MISSING_INTERNAL">MISSING_INTERNAL</option>
              <option value="MISSING_EXTERNAL">MISSING_EXTERNAL</option>
              <option value="CURRENCY_MISMATCH">CURRENCY_MISMATCH</option>
            </select>
          </div>

          <!-- Reset Filters -->
          <button
            type="button"
            class="btn-reset"
            *ngIf="hasActiveFilters()"
            (click)="resetFilters()"
            data-testid="recon-reset-filters-btn"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Main Content Area: Cases Data Table -->
      <div class="table-container">
        <!-- Error Alert -->
        <div
          class="alert-banner error"
          *ngIf="reconService.error()"
          data-testid="recon-error-banner"
        >
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ reconService.error() }}</span>
          <button type="button" class="btn-retry" (click)="refreshData()">Retry</button>
        </div>

        <!-- Table Loading State -->
        <div class="table-loading" *ngIf="reconService.loading()" data-testid="recon-loading">
          <span class="spinner"></span>
          <span>Loading reconciliation discrepancy cases...</span>
        </div>

        <!-- Cases Table -->
        <div class="table-scroll-wrap" *ngIf="!reconService.loading()">
          <table class="data-table" data-testid="recon-cases-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Job ID</th>
                <th>Discrepancy Type</th>
                <th>External Clearing Tx</th>
                <th>Internal Ledger Tx</th>
                <th class="text-right">Variance Delta</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let c of reconService.filteredCases()"
                (click)="openCaseDrawer(c)"
                data-testid="recon-case-row"
              >
                <!-- Case ID -->
                <td class="mono font-semibold text-primary">
                  {{ c.id }}
                </td>

                <!-- Job ID -->
                <td class="mono text-muted">
                  {{ c.jobId || 'N/A' }}
                </td>

                <!-- Discrepancy Type -->
                <td>
                  <span class="disc-type-tag">
                    {{ c.discrepancyType || 'MISMATCH' }}
                  </span>
                </td>

                <!-- External Tx ID -->
                <td class="mono">
                  {{ c.externalTransactionId || 'N/A' }}
                </td>

                <!-- Internal Ledger Tx -->
                <td>
                  <span
                    class="mono font-semibold"
                    [class.text-danger]="!c.internalTransactionId"
                    [class.text-muted]="!!c.internalTransactionId"
                  >
                    {{ c.internalTransactionId || 'MISSING_POSTING' }}
                  </span>
                </td>

                <!-- Variance Delta -->
                <td class="text-right mono font-semibold">
                  <span class="delta-badge">
                    {{ c.currency || 'EUR' }}
                    {{ c.discrepancyAmount || 0 | number: '1.2-2' }}
                  </span>
                </td>

                <!-- Status Chip -->
                <td>
                  <span
                    class="status-chip"
                    [ngClass]="(c.status || 'OPEN').toLowerCase()"
                    data-testid="case-status-chip"
                  >
                    {{ c.status || 'OPEN' }}
                  </span>
                </td>

                <!-- Assigned To -->
                <td>
                  <span class="assignee-text">{{ c.assignedTo || 'Unassigned' }}</span>
                </td>

                <!-- Actions -->
                <td class="actions-cell" (click)="$event.stopPropagation()">
                  <button
                    type="button"
                    class="action-btn inspect"
                    (click)="openCaseDrawer(c)"
                    title="Inspect Discrepancy Details"
                    data-testid="row-inspect-btn"
                  >
                    Inspect
                  </button>

                  <button
                    *ngIf="canResolve(c)"
                    type="button"
                    class="action-btn resolve"
                    (click)="openResolveModal(c)"
                    title="Resolve Case"
                    data-testid="row-resolve-btn"
                  >
                    Resolve
                  </button>

                  <button
                    *ngIf="canEscalate(c)"
                    type="button"
                    class="action-btn escalate"
                    (click)="openEscalateModal(c)"
                    title="Escalate Case"
                    data-testid="row-escalate-btn"
                  >
                    Escalate
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr *ngIf="reconService.filteredCases().length === 0">
                <td colspan="9" class="empty-state" data-testid="recon-empty-state">
                  <div class="empty-content">
                    <span class="empty-icon">⚖</span>
                    <h3>No Discrepancy Cases Found</h3>
                    <p>
                      All external clearing records are balanced against internal ledger entries, or
                      no cases match current filter criteria.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modals and Drawers -->
      <ble-reconciliation-case-drawer
        [open]="isDrawerOpen()"
        [caseItem]="selectedCaseForDrawer()"
        (closed)="closeCaseDrawer()"
        (resolveRequested)="onDrawerResolveRequested($event)"
        (escalateRequested)="onDrawerEscalateRequested($event)"
      />

      <ble-resolve-case-modal
        [open]="isResolveModalOpen()"
        [caseItem]="selectedCaseForAction()"
        (resolved)="onCaseResolved($event)"
        (cancelled)="closeResolveModal()"
      />

      <ble-escalate-case-modal
        [open]="isEscalateModalOpen()"
        [caseItem]="selectedCaseForAction()"
        (escalated)="onCaseEscalated($event)"
        (cancelled)="closeEscalateModal()"
      />

      <ble-run-recon-job-modal
        [open]="isRunJobModalOpen()"
        (jobStarted)="onJobStarted($event)"
        (cancelled)="closeRunJobModal()"
      />

      <ble-recon-jobs-drawer
        [open]="isJobsDrawerOpen()"
        (closed)="closeJobsDrawer()"
        (caseSelected)="onJobDrawerCaseSelected($event)"
      />
    </div>
  `,
  styles: [
    `
      .recon-cases-workspace {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow-y: auto;
        padding: 24px;
        gap: 20px;
        background: var(--ble-color-background, #0b1120);
      }

      .workspace-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .breadcrumb {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--ble-color-text-secondary, #94a3b8);
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }

      .page-title {
        font-size: 22px;
        font-weight: 700;
        margin: 0;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .page-subtitle {
        font-size: 13px;
        color: var(--ble-color-text-secondary, #94a3b8);
        margin: 4px 0 0;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .btn-jobs,
      .btn-refresh {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-primary, #f8fafc);
        font-size: 13px;
        font-weight: 600;
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .btn-jobs:hover,
      .btn-refresh:hover:not(:disabled) {
        background: #334155;
        border-color: #475569;
      }

      .btn-run-job {
        background: var(--ble-color-primary, #0284c7);
        border: 1px solid var(--ble-color-primary, #0284c7);
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s ease;
      }

      .btn-run-job:hover {
        background: #0369a1;
      }

      .toast-banner.success {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: rgba(34, 197, 94, 0.15);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 6px;
        color: #4ade80;
        font-size: 13px;
        font-weight: 500;
      }

      .kpi-banner {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }

      .kpi-card {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .kpi-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .kpi-val-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }

      .kpi-val {
        font-size: 20px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .highlight-open {
        color: #38bdf8;
      }

      .highlight-escalated {
        color: #f87171;
      }

      .highlight-exposure {
        color: #fbbf24;
      }

      .kpi-chip {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .kpi-chip.warning {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .kpi-chip.danger {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .kpi-chip.success {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
      }

      .kpi-chip.primary {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
      }

      .kpi-chip.neutral {
        background: rgba(148, 163, 184, 0.1);
        color: #94a3b8;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 12px 16px;
      }

      .search-box {
        position: relative;
        flex: 1;
        max-width: 380px;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 13px;
        color: #94a3b8;
      }

      .search-input {
        width: 100%;
        background: var(--ble-color-background, #0b1120);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 6px 10px 6px 32px;
        font-size: 13px;
        color: var(--ble-color-text-primary, #f8fafc);
        outline: none;
      }

      .search-input:focus {
        border-color: var(--ble-color-primary, #38bdf8);
      }

      .filter-controls {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .filter-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .filter-select {
        background: var(--ble-color-background, #0b1120);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        color: var(--ble-color-text-primary, #f8fafc);
        outline: none;
      }

      .btn-reset {
        background: transparent;
        border: none;
        color: #38bdf8;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 4px;
      }

      .btn-reset:hover {
        text-decoration: underline;
      }

      .table-container {
        flex: 1;
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .alert-banner.error {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: rgba(239, 68, 68, 0.15);
        border-bottom: 1px solid rgba(239, 68, 68, 0.3);
        color: #fca5a5;
        font-size: 12px;
      }

      .btn-retry {
        margin-left: auto;
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #fca5a5;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
      }

      .table-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 48px;
        color: var(--ble-color-text-secondary, #94a3b8);
        font-size: 13px;
      }

      .table-scroll-wrap {
        overflow-x: auto;
        flex: 1;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        text-align: left;
      }

      .data-table th {
        background: rgba(15, 23, 42, 0.6);
        color: var(--ble-color-text-secondary, #94a3b8);
        font-weight: 600;
        padding: 12px 16px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .data-table td {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.4);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .data-table tbody tr {
        cursor: pointer;
        transition: background 0.1s ease;
      }

      .data-table tbody tr:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .disc-type-tag {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.25);
      }

      .delta-badge {
        font-size: 13px;
        color: #fbbf24;
      }

      .status-chip {
        font-size: 10px;
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

      .assignee-text {
        font-size: 12px;
        color: #cbd5e1;
      }

      .actions-cell {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .action-btn {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.1s ease;
      }

      .action-btn.inspect {
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .action-btn.inspect:hover {
        color: #f8fafc;
        border-color: #64748b;
      }

      .action-btn.resolve {
        background: rgba(2, 132, 199, 0.15);
        border-color: rgba(2, 132, 199, 0.3);
        color: #38bdf8;
      }

      .action-btn.resolve:hover {
        background: rgba(2, 132, 199, 0.25);
      }

      .action-btn.escalate {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #f87171;
      }

      .action-btn.escalate:hover {
        background: rgba(239, 68, 68, 0.2);
      }

      .empty-state {
        padding: 48px;
        text-align: center;
      }

      .empty-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .empty-icon {
        font-size: 32px;
      }

      .empty-content h3 {
        margin: 0;
        font-size: 16px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .empty-content p {
        margin: 0;
        font-size: 12px;
        color: var(--ble-color-text-secondary, #94a3b8);
        max-width: 440px;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .font-semibold {
        font-weight: 600;
      }

      .text-right {
        text-align: right;
      }

      .text-primary {
        color: #38bdf8;
      }

      .text-danger {
        color: #f87171;
      }

      .text-muted {
        color: #94a3b8;
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
export class ReconciliationCasesDashboardComponent implements OnInit {
  readonly reconService: ReconAdminService;

  // UI State Signals
  readonly isDrawerOpen = signal<boolean>(false);
  readonly selectedCaseForDrawer = signal<ReconciliationCaseResponse | null>(null);

  readonly isResolveModalOpen = signal<boolean>(false);
  readonly isEscalateModalOpen = signal<boolean>(false);
  readonly selectedCaseForAction = signal<ReconciliationCaseResponse | null>(null);

  readonly isRunJobModalOpen = signal<boolean>(false);
  readonly isJobsDrawerOpen = signal<boolean>(false);

  readonly toastMessage = signal<string | null>(null);

  readonly kpi = computed(() => this.reconService.kpiSummary());

  constructor(service?: ReconAdminService) {
    this.reconService = service ?? inject(ReconAdminService);
  }

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.reconService.loadCases();
    this.reconService.loadJobs();
  }

  onSearchChange(query: string): void {
    this.reconService.setSearchQuery(query);
  }

  onStatusChange(status: string): void {
    this.reconService.setStatusFilter(status);
  }

  onDiscrepancyChange(type: string): void {
    this.reconService.setDiscrepancyFilter(type);
  }

  hasActiveFilters(): boolean {
    return (
      this.reconService.statusFilter() !== 'ALL' ||
      this.reconService.discrepancyFilter() !== 'ALL' ||
      this.reconService.searchQuery().trim().length > 0
    );
  }

  resetFilters(): void {
    this.reconService.setStatusFilter('ALL');
    this.reconService.setDiscrepancyFilter('ALL');
    this.reconService.setSearchQuery('');
  }

  canResolve(c: ReconciliationCaseResponse): boolean {
    const st = (c.status || '').toUpperCase();
    return st === 'OPEN' || st === 'ASSIGNED' || st === 'ESCALATED';
  }

  canEscalate(c: ReconciliationCaseResponse): boolean {
    const st = (c.status || '').toUpperCase();
    return st === 'OPEN' || st === 'ASSIGNED';
  }

  openCaseDrawer(c: ReconciliationCaseResponse): void {
    this.selectedCaseForDrawer.set(c);
    this.isDrawerOpen.set(true);
    if (c.id) {
      this.reconService.selectCase(c);
    }
  }

  closeCaseDrawer(): void {
    this.isDrawerOpen.set(false);
    this.selectedCaseForDrawer.set(null);
  }

  openResolveModal(c: ReconciliationCaseResponse): void {
    this.selectedCaseForAction.set(c);
    this.isResolveModalOpen.set(true);
  }

  closeResolveModal(): void {
    this.isResolveModalOpen.set(false);
    this.selectedCaseForAction.set(null);
  }

  onCaseResolved(resolved: ReconciliationCaseResponse): void {
    this.closeResolveModal();
    this.closeCaseDrawer();
    this.showToast(
      `Case ${resolved.id} successfully resolved with action ${resolved.resolutionAction || 'RESOLVE'}.`,
    );
  }

  onDrawerResolveRequested(c: ReconciliationCaseResponse): void {
    this.openResolveModal(c);
  }

  openEscalateModal(c: ReconciliationCaseResponse): void {
    this.selectedCaseForAction.set(c);
    this.isEscalateModalOpen.set(true);
  }

  closeEscalateModal(): void {
    this.isEscalateModalOpen.set(false);
    this.selectedCaseForAction.set(null);
  }

  onCaseEscalated(escalated: ReconciliationCaseResponse): void {
    this.closeEscalateModal();
    this.closeCaseDrawer();
    this.showToast(`Case ${escalated.id} escalated to supervisor review queue.`);
  }

  onDrawerEscalateRequested(c: ReconciliationCaseResponse): void {
    this.openEscalateModal(c);
  }

  openRunJobModal(): void {
    this.isRunJobModalOpen.set(true);
  }

  closeRunJobModal(): void {
    this.isRunJobModalOpen.set(false);
  }

  onJobStarted(job: ReconciliationJobResponse): void {
    this.closeRunJobModal();
    this.showToast(`Clearing reconciliation run ${job.id || job.statementReference} initiated.`);
  }

  openJobsDrawer(): void {
    this.isJobsDrawerOpen.set(true);
  }

  closeJobsDrawer(): void {
    this.isJobsDrawerOpen.set(false);
  }

  onJobDrawerCaseSelected(caseId: string): void {
    const found = this.reconService.cases().find((c) => c.id === caseId);
    if (found) {
      this.openCaseDrawer(found);
    } else {
      this.openCaseDrawer({ id: caseId, status: 'OPEN' });
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set(null);
      }
    }, 4000);
  }
}
