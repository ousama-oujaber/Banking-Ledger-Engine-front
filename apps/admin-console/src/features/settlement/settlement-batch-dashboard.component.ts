import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettlementAdminService } from './services/settlement-admin.service';
import {
  CreateBatchModalComponent,
  SettleBatchModalComponent,
  FailBatchModalComponent,
  BatchRecordsDrawerComponent,
} from './components';
import type { SettlementBatchResponse } from '@ble-frontend/api-client';

/**
 * SettlementBatchDashboardComponent
 *
 * Back-Office Clearing & Settlement Batches Workspace (Sprint 5 Task 2).
 * Displays real-time clearing batches, netting totals, record inspection drawers,
 * and handles batch lifecycle actions (Create, Settle, Fail, Close) with client idempotency.
 */
@Component({
  selector: 'ble-settlement-batch-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CreateBatchModalComponent,
    SettleBatchModalComponent,
    FailBatchModalComponent,
    BatchRecordsDrawerComponent,
  ],
  template: `
    <div class="settlement-workspace" data-testid="settlement-workspace">
      <!-- Workspace Page Header -->
      <div class="workspace-header">
        <div class="title-block">
          <div class="breadcrumb">Operations / Settlement & Clearing</div>
          <h1 class="page-title">Settlement Batch Management</h1>
          <p class="page-subtitle">
            Monitor clearing windows, netting totals across payment rails, and execute atomic
            settlement runs
          </p>
        </div>

        <div class="header-actions">
          <button
            type="button"
            class="btn-refresh"
            (click)="refreshBatches()"
            [disabled]="settlementService.loading()"
            data-testid="settlement-refresh-btn"
          >
            <span class="btn-icon">↻</span>
            <span>Refresh</span>
          </button>
          <button
            type="button"
            class="btn-create"
            (click)="openCreateModal()"
            data-testid="settlement-create-btn"
          >
            <span class="btn-icon">+</span>
            <span>New Settlement Batch</span>
          </button>
        </div>
      </div>

      <!-- Toast Notification Banner -->
      <div class="toast-banner success" *ngIf="toastMessage()" data-testid="settlement-toast">
        <span class="toast-icon">✓</span>
        <span class="toast-text">{{ toastMessage() }}</span>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-banner" data-testid="settlement-kpi-banner">
        <!-- Total Batches -->
        <div class="kpi-card" data-testid="kpi-total-batches">
          <span class="kpi-label">Total Batches</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono">{{ kpi().totalCount }}</span>
            <span class="kpi-chip neutral">Tracked</span>
          </div>
        </div>

        <!-- Open / In-Flight Batches -->
        <div class="kpi-card" data-testid="kpi-open-batches">
          <span class="kpi-label">Open / In-Flight</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-open">{{ kpi().openCount }}</span>
            <span class="kpi-chip warning">Pending Settlement</span>
          </div>
        </div>

        <!-- Settled Volume -->
        <div class="kpi-card" data-testid="kpi-settled-volume">
          <span class="kpi-label">Settled Volume (EUR Equiv)</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-settled">
              {{ kpi().totalSettledAmount | number: '1.2-2' }}
            </span>
            <span class="kpi-chip success">{{ kpi().settledCount }} Settled</span>
          </div>
        </div>

        <!-- Failed Batches Requiring Attention -->
        <div class="kpi-card" data-testid="kpi-failed-batches">
          <span class="kpi-label">Failed Batches</span>
          <div class="kpi-val-row">
            <span class="kpi-val mono highlight-failed">{{ kpi().failedCount }}</span>
            <span
              class="kpi-chip danger"
              [class.pulsing]="kpi().failedCount > 0"
              *ngIf="kpi().failedCount > 0"
            >
              Action Required
            </span>
            <span class="kpi-chip success" *ngIf="kpi().failedCount === 0">Clean</span>
          </div>
        </div>
      </div>

      <!-- Filter Toolbar -->
      <div class="filter-toolbar" data-testid="settlement-filter-toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input"
            placeholder="Search by batch ID, rail, or external ref..."
            [ngModel]="settlementService.searchQuery()"
            (ngModelChange)="settlementService.searchQuery.set($event)"
            data-testid="settlement-search-input"
          />
        </div>

        <!-- Rail Filter Dropdown -->
        <div class="filter-group">
          <label for="filter-rail-select" class="filter-label">Rail:</label>
          <select
            id="filter-rail-select"
            class="filter-select"
            [ngModel]="settlementService.railFilter()"
            (ngModelChange)="settlementService.railFilter.set($event)"
            data-testid="filter-rail-select"
          >
            <option value="ALL">All Rails</option>
            <option value="SEPA">SEPA</option>
            <option value="ACH">ACH</option>
            <option value="FEDWIRE">FEDWIRE</option>
            <option value="SWIFT">SWIFT</option>
            <option value="FAWRY">FAWRY</option>
          </select>
        </div>

        <!-- Status Filter Chips -->
        <div class="status-filters" data-testid="status-filter-group">
          <button
            type="button"
            class="status-btn"
            [class.active]="settlementService.statusFilter() === 'ALL'"
            (click)="settlementService.statusFilter.set('ALL')"
            data-testid="status-filter-all"
          >
            All
          </button>
          <button
            type="button"
            class="status-btn"
            [class.active]="settlementService.statusFilter() === 'OPEN'"
            (click)="settlementService.statusFilter.set('OPEN')"
            data-testid="status-filter-open"
          >
            Open
          </button>
          <button
            type="button"
            class="status-btn"
            [class.active]="settlementService.statusFilter() === 'SETTLED'"
            (click)="settlementService.statusFilter.set('SETTLED')"
            data-testid="status-filter-settled"
          >
            Settled
          </button>
          <button
            type="button"
            class="status-btn"
            [class.active]="settlementService.statusFilter() === 'FAILED'"
            (click)="settlementService.statusFilter.set('FAILED')"
            data-testid="status-filter-failed"
          >
            Failed
          </button>
          <button
            type="button"
            class="status-btn"
            [class.active]="settlementService.statusFilter() === 'CLOSED'"
            (click)="settlementService.statusFilter.set('CLOSED')"
            data-testid="status-filter-closed"
          >
            Closed
          </button>
        </div>
      </div>

      <!-- Error State -->
      <div class="alert-box error" *ngIf="settlementService.error()" data-testid="batches-error">
        <span class="alert-icon">⚠</span>
        <span class="alert-msg">{{ settlementService.error() }}</span>
      </div>

      <!-- Batches Data Table -->
      <div class="table-container" data-testid="batches-table-container">
        <!-- Loading Spinner Overlay -->
        <div class="loading-overlay" *ngIf="settlementService.loading()">
          <span class="spinner"></span>
          <span>Loading settlement batches...</span>
        </div>

        <table
          class="batches-table"
          *ngIf="!settlementService.loading() && batches().length > 0"
          data-testid="batches-table"
        >
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Rail</th>
              <th>Business Date</th>
              <th>Currency</th>
              <th class="text-right">Total Volume</th>
              <th class="text-center">Items</th>
              <th>Status</th>
              <th>External Clearing Ref</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let b of batches()" [attr.data-testid]="'batch-row-' + b.id">
              <!-- Batch ID -->
              <td>
                <button
                  type="button"
                  class="batch-id-btn mono font-semibold"
                  (click)="openInspectionDrawer(b)"
                  [title]="'Inspect records for ' + b.id"
                  data-testid="batch-id-link"
                >
                  {{ b.id }}
                </button>
              </td>

              <!-- Rail -->
              <td>
                <span class="rail-tag">{{ b.rail }}</span>
              </td>

              <!-- Business Date -->
              <td class="mono" data-testid="batch-business-date">
                {{ b.businessDate }}
              </td>

              <!-- Currency -->
              <td class="font-semibold">{{ b.currency }}</td>

              <!-- Total Volume -->
              <td
                class="text-right font-semibold highlight-volume"
                data-testid="batch-total-volume"
              >
                {{ b.totalAmount?.amount ?? 0 | number: '1.2-2' }}
              </td>

              <!-- Record Count -->
              <td class="text-center mono" data-testid="batch-record-count">
                {{ b.recordCount ?? 0 }}
              </td>

              <!-- Status Chip -->
              <td>
                <span
                  class="status-chip"
                  [ngClass]="(b.status || 'OPEN').toLowerCase()"
                  data-testid="batch-status-chip"
                >
                  {{ b.status || 'OPEN' }}
                </span>
              </td>

              <!-- External Ref -->
              <td class="mono text-muted" data-testid="batch-ext-ref">
                {{ b.externalBatchReference || '—' }}
              </td>

              <!-- Row Actions -->
              <td class="text-right">
                <div class="row-actions">
                  <button
                    type="button"
                    class="btn-row-action inspect"
                    (click)="openInspectionDrawer(b)"
                    [title]="'Inspect records in batch ' + b.id"
                    [attr.data-testid]="'inspect-batch-btn-' + b.id"
                  >
                    Inspect
                  </button>

                  <button
                    type="button"
                    class="btn-row-action settle"
                    *ngIf="canSettleBatch(b)"
                    (click)="openSettleModal(b)"
                    [title]="'Settle batch ' + b.id"
                    [attr.data-testid]="'settle-batch-btn-' + b.id"
                  >
                    Settle
                  </button>

                  <button
                    type="button"
                    class="btn-row-action fail"
                    *ngIf="canFailBatch(b)"
                    (click)="openFailModal(b)"
                    [title]="'Mark batch failed ' + b.id"
                    [attr.data-testid]="'fail-batch-btn-' + b.id"
                  >
                    Fail
                  </button>

                  <button
                    type="button"
                    class="btn-row-action close-batch"
                    *ngIf="canCloseBatch(b)"
                    (click)="closeBatch(b)"
                    [disabled]="settlementService.mutating()"
                    [title]="'Close settled batch ' + b.id"
                    [attr.data-testid]="'close-batch-btn-' + b.id"
                  >
                    Close
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty State -->
        <div
          class="empty-state"
          *ngIf="!settlementService.loading() && batches().length === 0"
          data-testid="batches-empty-state"
        >
          <span class="empty-icon">📭</span>
          <h3>No Settlement Batches Found</h3>
          <p>
            No clearing batches match the current filters. Initialize a new batch to start netting
            clearing entries.
          </p>
          <button type="button" class="btn-create" (click)="openCreateModal()">
            + Create First Settlement Batch
          </button>
        </div>
      </div>

      <!-- Modals & Drawers -->
      <ble-create-batch-modal
        [open]="isCreateModalOpen()"
        (onClose)="isCreateModalOpen.set(false)"
        (onCreated)="handleBatchCreated($event)"
      />

      <ble-settle-batch-modal
        [open]="isSettleModalOpen()"
        [batch]="selectedBatchForAction()"
        (onClose)="isSettleModalOpen.set(false)"
        (onSettled)="handleBatchSettled($event)"
      />

      <ble-fail-batch-modal
        [open]="isFailModalOpen()"
        [batch]="selectedBatchForAction()"
        (onClose)="isFailModalOpen.set(false)"
        (onFailed)="handleBatchFailed($event)"
      />

      <ble-batch-records-drawer
        [open]="isDrawerOpen()"
        [batch]="selectedBatchForAction()"
        (onClose)="isDrawerOpen.set(false)"
        (onTriggerSettle)="openSettleModal($event)"
        (onTriggerFail)="openFailModal($event)"
        (onTriggerClose)="closeBatch($event)"
      />
    </div>
  `,
  styles: [
    `
      .settlement-workspace {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        height: 100%;
        overflow-y: auto;
      }

      /* Workspace Header */
      .workspace-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
      }

      .breadcrumb {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ble-color-primary, #3b82f6);
        margin-bottom: 4px;
      }

      .page-title {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .page-subtitle {
        margin: 4px 0 0;
        font-size: 13px;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .header-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .btn-refresh,
      .btn-create {
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .btn-refresh {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .btn-refresh:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .btn-create {
        background: var(--ble-color-primary, #3b82f6);
        border: 1px solid transparent;
        color: #fff;
      }

      .btn-create:hover {
        background: #2563eb;
      }

      .toast-banner.success {
        padding: 10px 16px;
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 6px;
        color: #6ee7b7;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: fadeIn 0.2s ease;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* KPI Cards */
      .kpi-banner {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }

      .kpi-card {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .kpi-label {
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.05em;
      }

      .kpi-val-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }

      .kpi-val {
        font-size: 22px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .highlight-open {
        color: #fbbf24;
      }

      .highlight-settled {
        color: #34d399;
      }

      .highlight-failed {
        color: #f87171;
      }

      .kpi-chip {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }

      .kpi-chip.neutral {
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
      }

      .kpi-chip.warning {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .kpi-chip.success {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .kpi-chip.danger {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .kpi-chip.pulsing {
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      /* Filter Toolbar */
      .filter-toolbar {
        display: flex;
        gap: 16px;
        align-items: center;
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 10px 16px;
        flex-wrap: wrap;
      }

      .search-box {
        position: relative;
        flex: 1;
        min-width: 240px;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        color: #64748b;
      }

      .search-input {
        width: 100%;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 6px 12px 6px 30px;
        color: #f8fafc;
        font-size: 13px;
        outline: none;
      }

      .search-input:focus {
        border-color: #3b82f6;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-size: 12px;
        color: #94a3b8;
      }

      .filter-select {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 6px;
        padding: 6px 10px;
        color: #f8fafc;
        font-size: 12px;
        outline: none;
      }

      .status-filters {
        display: flex;
        gap: 4px;
        background: rgba(15, 23, 42, 0.4);
        padding: 2px;
        border-radius: 6px;
        border: 1px solid var(--ble-color-border, #334155);
      }

      .status-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 500;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .status-btn.active {
        background: #3b82f6;
        color: #fff;
      }

      .alert-box.error {
        padding: 12px 16px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: 6px;
        color: #fca5a5;
        font-size: 13px;
        display: flex;
        gap: 8px;
        align-items: center;
      }

      /* Table Styles */
      .table-container {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        overflow: hidden;
        position: relative;
        min-height: 240px;
      }

      .batches-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
        text-align: left;
      }

      .batches-table th {
        background: rgba(15, 23, 42, 0.8);
        color: var(--ble-color-text-muted, #64748b);
        font-weight: 600;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.05em;
        padding: 12px 16px;
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .batches-table td {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.4);
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .batches-table tr:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .batch-id-btn {
        background: transparent;
        border: none;
        color: #38bdf8;
        cursor: pointer;
        padding: 0;
        font-size: 12px;
      }

      .batch-id-btn:hover {
        text-decoration: underline;
      }

      .rail-tag {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.3);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
      }

      .highlight-volume {
        color: #38bdf8;
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

      .row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }

      .btn-row-action {
        padding: 4px 8px;
        font-size: 11px;
        font-weight: 500;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-row-action.inspect {
        background: transparent;
        border: 1px solid var(--ble-color-border, #334155);
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .btn-row-action.inspect:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }

      .btn-row-action.settle {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #34d399;
      }

      .btn-row-action.settle:hover {
        background: #10b981;
        color: #fff;
      }

      .btn-row-action.fail {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #f87171;
      }

      .btn-row-action.fail:hover {
        background: #ef4444;
        color: #fff;
      }

      .btn-row-action.close-batch {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
        color: #60a5fa;
      }

      .btn-row-action.close-batch:hover:not(:disabled) {
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
        font-size: 40px;
        margin-bottom: 12px;
      }

      .empty-state h3 {
        margin: 0 0 6px;
        font-size: 16px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .empty-state p {
        margin: 0 0 16px;
        font-size: 13px;
        max-width: 400px;
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

      .text-muted {
        color: var(--ble-color-text-muted, #64748b);
      }

      .loading-overlay {
        position: absolute;
        inset: 0;
        background: rgba(30, 41, 59, 0.85);
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
        width: 24px;
        height: 24px;
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
export class SettlementBatchDashboardComponent implements OnInit {
  readonly settlementService: SettlementAdminService;

  // Dialog & Drawer Visibility Signals
  readonly isCreateModalOpen = signal<boolean>(false);
  readonly isSettleModalOpen = signal<boolean>(false);
  readonly isFailModalOpen = signal<boolean>(false);
  readonly isDrawerOpen = signal<boolean>(false);

  // Selected Target Batch for Actions
  readonly selectedBatchForAction = signal<SettlementBatchResponse | null>(null);

  // Toast Feedback Signal
  readonly toastMessage = signal<string | null>(null);

  constructor(service?: SettlementAdminService) {
    if (service) {
      this.settlementService = service;
    } else {
      this.settlementService = inject(SettlementAdminService);
    }
  }

  ngOnInit(): void {
    this.refreshBatches();
  }

  readonly batches = computed<SettlementBatchResponse[]>(() => {
    return this.settlementService.filteredBatches();
  });

  readonly kpi = computed(() => {
    return this.settlementService.kpiSummary();
  });

  async refreshBatches(): Promise<void> {
    await this.settlementService.loadBatches(
      this.settlementService.railFilter(),
      this.settlementService.statusFilter(),
    );
  }

  openCreateModal(): void {
    this.isCreateModalOpen.set(true);
  }

  openSettleModal(batch: SettlementBatchResponse): void {
    this.selectedBatchForAction.set(batch);
    this.isSettleModalOpen.set(true);
  }

  openFailModal(batch: SettlementBatchResponse): void {
    this.selectedBatchForAction.set(batch);
    this.isFailModalOpen.set(true);
  }

  openInspectionDrawer(batch: SettlementBatchResponse): void {
    this.selectedBatchForAction.set(batch);
    this.isDrawerOpen.set(true);
  }

  canSettleBatch(batch: SettlementBatchResponse): boolean {
    const st = (batch.status || '').toUpperCase();
    return st === 'OPEN' || st === 'PENDING';
  }

  canFailBatch(batch: SettlementBatchResponse): boolean {
    const st = (batch.status || '').toUpperCase();
    return st === 'OPEN' || st === 'PENDING';
  }

  canCloseBatch(batch: SettlementBatchResponse): boolean {
    const st = (batch.status || '').toUpperCase();
    return st === 'SETTLED';
  }

  async closeBatch(batch: SettlementBatchResponse): Promise<void> {
    if (!batch.id) return;
    try {
      await this.settlementService.closeBatch(batch.id);
      this.showToast(`Batch ${batch.id} marked as CLOSED`);
    } catch {
      // error handled in service
    }
  }

  handleBatchCreated(created: SettlementBatchResponse): void {
    this.showToast(`Settlement batch ${created.id} created successfully on ${created.rail}`);
  }

  handleBatchSettled(settled: SettlementBatchResponse): void {
    this.showToast(`Batch ${settled.id} settled successfully`);
    if (this.isDrawerOpen()) {
      this.selectedBatchForAction.set(settled);
    }
  }

  handleBatchFailed(failed: SettlementBatchResponse): void {
    this.showToast(`Batch ${failed.id} marked as FAILED`);
    if (this.isDrawerOpen()) {
      this.selectedBatchForAction.set(failed);
    }
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4500);
  }
}
