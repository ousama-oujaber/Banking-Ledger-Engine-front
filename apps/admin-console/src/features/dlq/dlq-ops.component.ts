import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DlqAdminService } from './services/dlq-admin.service';
import {
  DlqEventDrawerComponent,
  ReplayConfirmModalComponent,
  DiscardConfirmModalComponent,
} from './components';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

/**
 * DlqOpsComponent
 *
 * Back-Office Dead-Letter Queue (DLQ) Operations & Broker Diagnostics Console (Sprint 5 Task 4, FR-OPS-AUDIT-02).
 * Enables SREs and financial operations administrators to monitor failed outbox events,
 * inspect error stack traces and payloads, and execute manual replay or discard operations.
 */
@Component({
  selector: 'ble-dlq-ops',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DlqEventDrawerComponent,
    ReplayConfirmModalComponent,
    DiscardConfirmModalComponent,
  ],
  template: `
    <div class="dlq-workspace" data-testid="dlq-workspace">
      <!-- Workspace Page Header -->
      <div class="workspace-header">
        <div class="title-block">
          <div class="breadcrumb">Operations / Diagnostics / DLQ</div>
          <h1 class="page-title">Dead-Letter Queue Operations</h1>
          <p class="page-subtitle">
            Monitor failed transactional outbox events, inspect error stack traces, and trigger
            manual replay or discard operations
          </p>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-refresh"
            (click)="refreshData()"
            [disabled]="dlqService.loading()"
            data-testid="dlq-refresh-btn"
          >
            <span class="btn-icon">↻</span>
            <span>Refresh</span>
          </button>
          <button
            type="button"
            class="btn-replay-all"
            *ngIf="kpi().pendingCount > 0"
            (click)="openBulkReplayModal()"
            data-testid="dlq-replay-all-btn"
          >
            <span class="btn-icon">⚡</span>
            <span>Replay All Pending ({{ kpi().pendingCount }})</span>
          </button>
        </div>
      </div>

      <!-- Toast Notification Banner -->
      <div class="toast-banner success" *ngIf="toastMessage()" data-testid="dlq-toast">
        <span class="toast-icon">✓</span>
        <span class="toast-text">{{ toastMessage() }}</span>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-banner" data-testid="dlq-kpi-banner">
        <!-- Pending Dead-Letters -->
        <div class="kpi-card" data-testid="kpi-pending-dlq">
          <span class="kpi-label">Pending Dead-Letters</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-pending">{{ kpi().pendingCount }}</span>
            <span class="kpi-chip danger" *ngIf="kpi().pendingCount > 0">Needs Attention</span>
            <span class="kpi-chip success" *ngIf="kpi().pendingCount === 0">Clear</span>
          </div>
        </div>

        <!-- Successfully Replayed -->
        <div class="kpi-card" data-testid="kpi-replayed-dlq">
          <span class="kpi-label">Successfully Replayed</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-replayed">{{ kpi().replayedCount }}</span>
            <span class="kpi-chip success">Recovered</span>
          </div>
        </div>

        <!-- Permanently Discarded -->
        <div class="kpi-card" data-testid="kpi-discarded-dlq">
          <span class="kpi-label">Permanently Discarded</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono">{{ kpi().discardedCount }}</span>
            <span class="kpi-chip neutral">Purged</span>
          </div>
        </div>

        <!-- Outbox Lag & Broker Health -->
        <div class="kpi-card" data-testid="kpi-broker-health">
          <span class="kpi-label">Outbox Lag & Broker Health</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono">{{ kpi().outboxLag }} msg</span>
            <span
              class="kpi-chip"
              [ngClass]="kpi().brokerHealth.toLowerCase()"
              data-testid="broker-health-chip"
            >
              {{ kpi().brokerHealth }}
            </span>
          </div>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="toolbar" data-testid="dlq-toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input"
            placeholder="Search by Event ID, Aggregate, Error message..."
            [ngModel]="dlqService.searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            data-testid="dlq-search-input"
          />
        </div>

        <div class="filter-controls">
          <!-- Status Filter -->
          <div class="filter-item">
            <label for="dlq-status-filter" class="filter-label">Status:</label>
            <select
              id="dlq-status-filter"
              class="filter-select"
              [ngModel]="dlqService.statusFilter()"
              (ngModelChange)="onStatusChange($event)"
              data-testid="dlq-status-filter"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="REPLAYED">REPLAYED</option>
              <option value="DISCARDED">DISCARDED</option>
            </select>
          </div>

          <!-- Topic Filter -->
          <div class="filter-item">
            <label for="dlq-topic-filter" class="filter-label">Topic:</label>
            <select
              id="dlq-topic-filter"
              class="filter-select"
              [ngModel]="dlqService.topicFilter()"
              (ngModelChange)="onTopicChange($event)"
              data-testid="dlq-topic-filter"
            >
              <option value="ALL">All Topics</option>
              <option value="ACCOUNT_EVENTS">ACCOUNT_EVENTS</option>
              <option value="TRANSACTION_EVENTS">TRANSACTION_EVENTS</option>
              <option value="HOLD_EVENTS">HOLD_EVENTS</option>
              <option value="SETTLEMENT_EVENTS">SETTLEMENT_EVENTS</option>
              <option value="RECONCILIATION_EVENTS">RECONCILIATION_EVENTS</option>
              <option value="NOTIFICATION_EVENTS">NOTIFICATION_EVENTS</option>
            </select>
          </div>

          <!-- Reset Filters -->
          <button
            type="button"
            class="btn-reset"
            *ngIf="hasActiveFilters()"
            (click)="resetFilters()"
            data-testid="dlq-reset-filters-btn"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Main Content: Dead-Letter Events Table -->
      <div class="table-container">
        <!-- Error Alert Banner -->
        <div class="alert-banner error" *ngIf="dlqService.error()" data-testid="dlq-error-banner">
          <span class="alert-icon">⚠</span>
          <span class="alert-msg">{{ dlqService.error() }}</span>
          <button type="button" class="btn-retry" (click)="refreshData()">Retry</button>
        </div>

        <!-- Table Loading State -->
        <div class="table-loading" *ngIf="dlqService.loading()" data-testid="dlq-loading">
          <span class="spinner"></span>
          <span>Loading dead-letter events...</span>
        </div>

        <!-- Events Table -->
        <div class="table-scroll-wrap" *ngIf="!dlqService.loading()">
          <table class="data-table" data-testid="dlq-events-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Event ID</th>
                <th>Topic</th>
                <th>Event Type</th>
                <th>Aggregate</th>
                <th>Error Summary</th>
                <th>Retries</th>
                <th>Failed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                *ngFor="let ev of dlqService.filteredEvents()"
                (click)="openEventDrawer(ev)"
                data-testid="dlq-event-row"
              >
                <!-- Status Chip -->
                <td>
                  <span
                    class="status-chip"
                    [ngClass]="(ev.status || 'PENDING').toLowerCase()"
                    data-testid="event-status-chip"
                  >
                    {{ ev.status || 'PENDING' }}
                  </span>
                </td>

                <!-- Event ID -->
                <td class="mono font-semibold text-primary">
                  {{ ev.id }}
                </td>

                <!-- Topic -->
                <td>
                  <span class="topic-tag">{{ ev.topic || 'GENERAL' }}</span>
                </td>

                <!-- Event Type -->
                <td class="font-semibold">{{ ev.eventType || 'N/A' }}</td>

                <!-- Aggregate Type & ID -->
                <td class="mono text-muted">
                  {{ ev.aggregateType ? ev.aggregateType + ':' : '' }}{{ ev.aggregateId || 'N/A' }}
                </td>

                <!-- Error Summary -->
                <td class="error-cell">
                  <span class="error-text text-danger truncate" [title]="ev.errorMessage">
                    {{ ev.errorMessage || 'No error message provided' }}
                  </span>
                </td>

                <!-- Retries -->
                <td class="mono text-secondary">
                  {{ ev.retryCount ?? 0 }} / {{ ev.maxRetries ?? 3 }}
                </td>

                <!-- Failed At -->
                <td class="mono text-secondary">
                  {{ ev.createdAt ? (ev.createdAt | date: 'short') : 'N/A' }}
                </td>

                <!-- Actions -->
                <td class="actions-cell" (click)="$event.stopPropagation()">
                  <button
                    type="button"
                    class="action-btn inspect"
                    (click)="openEventDrawer(ev)"
                    title="Inspect Failure Details"
                    data-testid="row-inspect-btn"
                  >
                    Inspect
                  </button>

                  <button
                    *ngIf="canReplay(ev)"
                    type="button"
                    class="action-btn replay"
                    (click)="openReplayModal(ev)"
                    title="Replay Event"
                    data-testid="row-replay-btn"
                  >
                    Replay
                  </button>

                  <button
                    *ngIf="canDiscard(ev)"
                    type="button"
                    class="action-btn discard"
                    (click)="openDiscardModal(ev)"
                    title="Discard Event"
                    data-testid="row-discard-btn"
                  >
                    Discard
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr *ngIf="dlqService.filteredEvents().length === 0">
                <td colspan="9" class="empty-state" data-testid="dlq-empty-state">
                  <div class="empty-content">
                    <span class="empty-icon">✓</span>
                    <h3>Dead-Letter Queue Clean</h3>
                    <p>
                      No transactional outbox delivery failures or dead-letter events detected for
                      the selected criteria.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modals and Drawer -->
      <ble-dlq-event-drawer
        [open]="isDrawerOpen()"
        [eventItem]="selectedEventForDrawer()"
        (closed)="closeEventDrawer()"
        (replayRequested)="onDrawerReplayRequested($event)"
        (discardRequested)="onDrawerDiscardRequested($event)"
      />

      <ble-replay-confirm-modal
        [open]="isReplayModalOpen()"
        [eventItem]="selectedEventForAction()"
        [bulk]="bulkReplayConfig()"
        (replayed)="onEventReplayed($event)"
        (cancelled)="closeReplayModal()"
      />

      <ble-discard-confirm-modal
        [open]="isDiscardModalOpen()"
        [eventItem]="selectedEventForAction()"
        (discarded)="onEventDiscarded($event)"
        (cancelled)="closeDiscardModal()"
      />
    </div>
  `,
  styles: [
    `
      .dlq-workspace {
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

      .btn-refresh:hover:not(:disabled) {
        background: #334155;
        border-color: #475569;
      }

      .btn-replay-all {
        background: rgba(2, 132, 199, 0.2);
        border: 1px solid var(--ble-color-primary, #0284c7);
        color: #38bdf8;
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

      .btn-replay-all:hover {
        background: rgba(2, 132, 199, 0.35);
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

      .highlight-pending {
        color: #f87171;
      }

      .highlight-replayed {
        color: #4ade80;
      }

      .kpi-chip {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .kpi-chip.danger {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .kpi-chip.success,
      .kpi-chip.healthy {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
      }

      .kpi-chip.degraded {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .kpi-chip.critical {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
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

      .status-chip {
        font-size: 10px;
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

      .topic-tag {
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(56, 189, 248, 0.12);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.25);
      }

      .error-cell {
        max-width: 280px;
      }

      .error-text {
        font-size: 12px;
        display: block;
      }

      .truncate {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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

      .action-btn.replay {
        background: rgba(2, 132, 199, 0.15);
        border-color: rgba(2, 132, 199, 0.3);
        color: #38bdf8;
      }

      .action-btn.replay:hover {
        background: rgba(2, 132, 199, 0.25);
      }

      .action-btn.discard {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        color: #f87171;
      }

      .action-btn.discard:hover {
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
        color: #4ade80;
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

      .text-primary {
        color: #38bdf8;
      }

      .text-danger {
        color: #f87171;
      }

      .text-secondary {
        color: #94a3b8;
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
export class DlqOpsComponent implements OnInit {
  readonly dlqService: DlqAdminService;

  readonly isDrawerOpen = signal<boolean>(false);
  readonly selectedEventForDrawer = signal<DeadLetterEventResponse | null>(null);

  readonly isReplayModalOpen = signal<boolean>(false);
  readonly isDiscardModalOpen = signal<boolean>(false);
  readonly selectedEventForAction = signal<DeadLetterEventResponse | null>(null);
  readonly bulkReplayConfig = signal<{ active: boolean; count: number }>({
    active: false,
    count: 0,
  });

  readonly toastMessage = signal<string | null>(null);

  readonly kpi = computed(() => this.dlqService.kpiSummary());

  constructor(service?: DlqAdminService) {
    this.dlqService = service ?? inject(DlqAdminService);
  }

  ngOnInit(): void {
    this.refreshData();
  }

  refreshData(): void {
    this.dlqService.loadEvents();
    this.dlqService.loadObservabilityStats();
  }

  onSearchChange(query: string): void {
    this.dlqService.setSearchQuery(query);
  }

  onStatusChange(status: string): void {
    this.dlqService.setStatusFilter(status);
  }

  onTopicChange(topic: string): void {
    this.dlqService.setTopicFilter(topic);
  }

  hasActiveFilters(): boolean {
    return (
      this.dlqService.statusFilter() !== 'ALL' ||
      this.dlqService.topicFilter() !== 'ALL' ||
      this.dlqService.searchQuery().trim().length > 0
    );
  }

  resetFilters(): void {
    this.dlqService.setStatusFilter('ALL');
    this.dlqService.setTopicFilter('ALL');
    this.dlqService.setSearchQuery('');
  }

  canReplay(ev: DeadLetterEventResponse): boolean {
    const st = (ev.status || 'PENDING').toUpperCase();
    return st === 'PENDING';
  }

  canDiscard(ev: DeadLetterEventResponse): boolean {
    const st = (ev.status || 'PENDING').toUpperCase();
    return st === 'PENDING';
  }

  openEventDrawer(ev: DeadLetterEventResponse): void {
    this.selectedEventForDrawer.set(ev);
    this.isDrawerOpen.set(true);
    this.dlqService.selectEvent(ev);
  }

  closeEventDrawer(): void {
    this.isDrawerOpen.set(false);
    this.selectedEventForDrawer.set(null);
  }

  openReplayModal(ev: DeadLetterEventResponse): void {
    this.bulkReplayConfig.set({ active: false, count: 0 });
    this.selectedEventForAction.set(ev);
    this.isReplayModalOpen.set(true);
  }

  openBulkReplayModal(): void {
    this.selectedEventForAction.set(null);
    this.bulkReplayConfig.set({ active: true, count: this.kpi().pendingCount });
    this.isReplayModalOpen.set(true);
  }

  closeReplayModal(): void {
    this.isReplayModalOpen.set(false);
    this.selectedEventForAction.set(null);
    this.bulkReplayConfig.set({ active: false, count: 0 });
  }

  onEventReplayed(result: DeadLetterEventResponse | number): void {
    this.closeReplayModal();
    this.closeEventDrawer();

    if (typeof result === 'number') {
      this.showToast(`Bulk recovery executed: ${result} pending events re-published to broker.`);
    } else {
      this.showToast(`Event ${result.id} successfully submitted for replay.`);
    }
  }

  onDrawerReplayRequested(ev: DeadLetterEventResponse): void {
    this.openReplayModal(ev);
  }

  openDiscardModal(ev: DeadLetterEventResponse): void {
    this.selectedEventForAction.set(ev);
    this.isDiscardModalOpen.set(true);
  }

  closeDiscardModal(): void {
    this.isDiscardModalOpen.set(false);
    this.selectedEventForAction.set(null);
  }

  onEventDiscarded(ev: DeadLetterEventResponse): void {
    this.closeDiscardModal();
    this.closeEventDrawer();
    this.showToast(`Event ${ev.id} permanently discarded from delivery pipeline.`);
  }

  onDrawerDiscardRequested(ev: DeadLetterEventResponse): void {
    this.openDiscardModal(ev);
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
