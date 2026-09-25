import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountAdminService } from './services/account-admin.service';
import type { AccountResponse } from '@ble-frontend/api-client';

@Component({
  selector: 'ble-account-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="account-workspace" data-testid="account-workspace">
      <!-- Workspace Page Title & Stats -->
      <div class="workspace-header">
        <div class="title-section">
          <h1 class="page-title">Accounts Directory</h1>
          <p class="page-subtitle">
            High-density operator ledger view with multi-column filtering and lifecycle controls
          </p>
        </div>
        <div class="header-stats">
          <div class="stat-pill">
            <span class="stat-label">Total Filtered:</span>
            <span class="stat-value font-mono" data-testid="stat-total">{{ totalCount() }}</span>
          </div>
          <button
            type="button"
            class="action-btn secondary refresh-btn"
            data-testid="account-refresh-btn"
            (click)="refresh()"
            [disabled]="loading()"
            title="Refresh Account Data"
          >
            <span class="refresh-icon" [class.spinning]="loading()">↻</span>
            Refresh
          </button>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="toolbar-card" data-testid="account-toolbar">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input font-mono"
            data-testid="account-search-input"
            placeholder="Filter by Account ID, Owner ID, or Label..."
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchChange($event)"
          />
          <button
            *ngIf="searchQuery().length > 0"
            type="button"
            class="clear-search-btn"
            (click)="onSearchChange('')"
            title="Clear search"
          >
            ✕
          </button>
        </div>

        <div class="filters-row">
          <!-- Type Filter -->
          <div class="filter-group">
            <label class="filter-label" for="type-filter">Type</label>
            <select
              id="type-filter"
              class="filter-select"
              data-testid="account-type-filter"
              [ngModel]="typeFilter()"
              (ngModelChange)="onTypeChange($event)"
            >
              <option value="ALL">All Types</option>
              <option value="CLASSIC">Classic</option>
              <option value="SAVINGS">Savings</option>
              <option value="ESCROW">Escrow</option>
              <option value="SETTLEMENT">Settlement</option>
              <option value="CLEARING">Clearing</option>
              <option value="FEE_INCOME">Fee Income</option>
            </select>
          </div>

          <!-- Status Filter -->
          <div class="filter-group">
            <label class="filter-label" for="status-filter">Status</label>
            <select
              id="status-filter"
              class="filter-select"
              data-testid="account-status-filter"
              [ngModel]="statusFilter()"
              (ngModelChange)="onStatusChange($event)"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          <!-- Currency Filter -->
          <div class="filter-group">
            <label class="filter-label" for="currency-filter">Currency</label>
            <select
              id="currency-filter"
              class="filter-select"
              data-testid="account-currency-filter"
              [ngModel]="currencyFilter()"
              (ngModelChange)="onCurrencyChange($event)"
            >
              <option value="ALL">All Currencies</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="MAD">MAD</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>

          <!-- Reset Filters Button -->
          <div class="filter-group filter-actions">
            <button
              type="button"
              class="reset-btn"
              data-testid="account-reset-btn"
              (click)="resetFilters()"
              [disabled]="!hasActiveFilters()"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Error State Banner -->
      <div *ngIf="error()" class="error-banner" data-testid="account-error-banner">
        <div class="error-content">
          <span class="error-icon">⚠</span>
          <span class="error-text">{{ error() }}</span>
        </div>
        <button type="button" class="retry-btn" (click)="refresh()">Retry</button>
      </div>

      <!-- Table Container -->
      <div class="table-container">
        <!-- Skeleton Loading State -->
        <div *ngIf="loading() && paginatedAccounts().length === 0" class="skeleton-wrapper" data-testid="account-table-loading">
          <div class="skeleton-row" *ngFor="let i of [1, 2, 3, 4, 5]">
            <div class="skeleton-cell w-20"></div>
            <div class="skeleton-cell w-15"></div>
            <div class="skeleton-cell w-15"></div>
            <div class="skeleton-cell w-10"></div>
            <div class="skeleton-cell w-15"></div>
            <div class="skeleton-cell w-25"></div>
          </div>
        </div>

        <!-- High-Density Data Table -->
        <table *ngIf="!loading() || paginatedAccounts().length > 0" class="data-table" data-testid="account-table">
          <thead>
            <tr>
              <th (click)="toggleSort('id')" data-testid="sort-id" class="sortable col-id">
                <span>Account ID</span>
                <span class="sort-icon">{{ getSortIcon('id') }}</span>
              </th>
              <th (click)="toggleSort('ownerId')" data-testid="sort-ownerId" class="sortable col-owner">
                <span>Owner</span>
                <span class="sort-icon">{{ getSortIcon('ownerId') }}</span>
              </th>
              <th (click)="toggleSort('type')" data-testid="sort-type" class="sortable col-type">
                <span>Type</span>
                <span class="sort-icon">{{ getSortIcon('type') }}</span>
              </th>
              <th (click)="toggleSort('currency')" data-testid="sort-currency" class="sortable col-currency">
                <span>Currency</span>
                <span class="sort-icon">{{ getSortIcon('currency') }}</span>
              </th>
              <th (click)="toggleSort('status')" data-testid="sort-status" class="sortable col-status">
                <span>Status</span>
                <span class="sort-icon">{{ getSortIcon('status') }}</span>
              </th>
              <th (click)="toggleSort('balance')" data-testid="sort-balance" class="sortable col-balance text-right">
                <span>Authoritative Balance</span>
                <span class="sort-icon">{{ getSortIcon('balance') }}</span>
              </th>
              <th class="col-actions text-center">Lifecycle Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let account of paginatedAccounts()"
              class="data-row"
              [attr.data-testid]="'account-row-' + account.id"
            >
              <!-- Account ID & Copy -->
              <td class="col-id font-mono">
                <div class="id-wrapper">
                  <span class="id-text" [title]="account.id">{{ account.id }}</span>
                  <button
                    type="button"
                    class="copy-btn"
                    [attr.data-testid]="'copy-id-' + account.id"
                    (click)="copyAccountId(account.id!)"
                    [title]="copiedAccountId() === account.id ? 'Copied!' : 'Copy Account ID'"
                  >
                    {{ copiedAccountId() === account.id ? '✓' : '⧉' }}
                  </button>
                </div>
              </td>

              <!-- Owner ID -->
              <td class="col-owner font-mono text-muted">
                {{ account.ownerId || '—' }}
              </td>

              <!-- Account Type -->
              <td class="col-type">
                <span class="type-pill">{{ account.type || 'CLASSIC' }}</span>
              </td>

              <!-- Currency -->
              <td class="col-currency font-mono font-bold">
                {{ account.currency || 'EUR' }}
              </td>

              <!-- Status Badge -->
              <td class="col-status">
                <span
                  class="status-badge"
                  [ngClass]="'status-' + (account.status || 'active').toLowerCase()"
                  [attr.data-testid]="'status-badge-' + account.id"
                >
                  {{ account.status || 'ACTIVE' }}
                </span>
              </td>

              <!-- Authoritative Derived Balance (BR-F01, BR-F02) -->
              <td class="col-balance text-right font-mono">
                <span
                  class="balance-amount"
                  [class.zero]="isZeroBalance(account)"
                  [attr.data-testid]="'balance-' + account.id"
                >
                  {{ formatBalance(account) }}
                </span>
              </td>

              <!-- Lifecycle Actions Placeholder for S4-T3 -->
              <td class="col-actions text-center">
                <div class="row-actions">
                  <!-- Freeze Button (shown if active) -->
                  <button
                    *ngIf="account.status === 'ACTIVE'"
                    type="button"
                    class="action-btn warning"
                    [attr.data-testid]="'action-freeze-' + account.id"
                    (click)="freeze(account)"
                    title="Freeze Account (FR-OPS-ACC-01)"
                  >
                    Freeze
                  </button>

                  <!-- Unfreeze Button (shown if frozen) -->
                  <button
                    *ngIf="account.status === 'FROZEN'"
                    type="button"
                    class="action-btn success"
                    [attr.data-testid]="'action-unfreeze-' + account.id"
                    (click)="unfreeze(account)"
                    title="Unfreeze Account (FR-OPS-ACC-01)"
                  >
                    Unfreeze
                  </button>

                  <!-- Close Button (with zero balance invariant check BR-F05) -->
                  <button
                    *ngIf="account.status !== 'CLOSED'"
                    type="button"
                    class="action-btn danger"
                    [attr.data-testid]="'action-close-' + account.id"
                    [disabled]="!canClose(account)"
                    (click)="close(account)"
                    [title]="canClose(account) ? 'Close Account permanently' : 'Cannot close: Balance must be zero (BR-F05)'"
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
          *ngIf="!loading() && paginatedAccounts().length === 0"
          class="empty-state"
          data-testid="account-empty-state"
        >
          <div class="empty-icon">📂</div>
          <div class="empty-title">No Accounts Found</div>
          <div class="empty-desc">
            No ledger accounts match your active search or filter parameters.
          </div>
          <button
            *ngIf="hasActiveFilters()"
            type="button"
            class="action-btn secondary"
            (click)="resetFilters()"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      <!-- Pagination Footer -->
      <div class="pagination-bar" data-testid="account-pagination">
        <div class="pagination-info" data-testid="page-info">
          Showing <span class="font-mono">{{ startRecordIndex() }}</span> to
          <span class="font-mono">{{ endRecordIndex() }}</span> of
          <span class="font-mono">{{ totalCount() }}</span> accounts
          (Page <span class="font-mono">{{ currentPage() }}</span> of
          <span class="font-mono">{{ totalPages() }}</span>)
        </div>

        <div class="pagination-controls">
          <div class="page-size-wrapper">
            <label for="page-size" class="page-size-label">Per page:</label>
            <select
              id="page-size"
              class="page-size-select font-mono"
              data-testid="page-size-select"
              [ngModel]="pageSize()"
              (ngModelChange)="onPageSizeChange($event)"
            >
              <option [value]="10">10</option>
              <option [value]="25">25</option>
              <option [value]="50">50</option>
            </select>
          </div>

          <div class="page-nav-btns">
            <button
              type="button"
              class="nav-page-btn"
              data-testid="prev-page-btn"
              (click)="prevPage()"
              [disabled]="currentPage() <= 1"
              title="Previous Page"
            >
              ◀ Prev
            </button>
            <span class="current-page-badge font-mono">{{ currentPage() }}</span>
            <button
              type="button"
              class="nav-page-btn"
              data-testid="next-page-btn"
              (click)="nextPage()"
              [disabled]="currentPage() >= totalPages()"
              title="Next Page"
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 16px 20px;
    }

    .account-workspace {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 1600px;
      margin: 0 auto;
    }

    /* Workspace Header */
    .workspace-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--ble-color-text-primary, #f8fafc);
      margin: 0;
      letter-spacing: -0.01em;
    }

    .page-subtitle {
      font-size: 12px;
      color: var(--ble-color-text-secondary, #94a3b8);
      margin: 2px 0 0 0;
    }

    .header-stats {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: var(--ble-color-surface, #1e293b);
      border: 1px solid var(--ble-color-border, #334155);
      border-radius: 4px;
      font-size: 11px;
    }

    .stat-label {
      color: var(--ble-color-text-secondary, #94a3b8);
    }

    .stat-value {
      color: #38bdf8;
      font-weight: 700;
    }

    .refresh-icon.spinning {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* Toolbar Card */
    .toolbar-card {
      background: var(--ble-color-surface, #1e293b);
      border: 1px solid var(--ble-color-border, #334155);
      border-radius: 6px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      font-size: 13px;
      color: var(--ble-color-text-muted, #64748b);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      background: var(--ble-color-surface-muted, #0f172a);
      border: 1px solid var(--ble-color-border, #334155);
      border-radius: 4px;
      color: var(--ble-color-text-primary, #f8fafc);
      padding: 7px 32px 7px 32px;
      font-size: 12px;
      outline: none;
      transition: border-color 150ms ease;
    }

    .search-input:focus {
      border-color: #3b82f6;
    }

    .clear-search-btn {
      position: absolute;
      right: 8px;
      background: transparent;
      border: none;
      color: var(--ble-color-text-muted, #64748b);
      font-size: 12px;
      cursor: pointer;
      padding: 2px 6px;
    }

    .clear-search-btn:hover {
      color: #f8fafc;
    }

    .filters-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .filter-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--ble-color-text-secondary, #94a3b8);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .filter-select {
      background: var(--ble-color-surface-muted, #0f172a);
      border: 1px solid var(--ble-color-border, #334155);
      color: var(--ble-color-text-primary, #f8fafc);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }

    .filter-select:focus {
      border-color: #3b82f6;
    }

    .reset-btn {
      background: transparent;
      border: 1px solid var(--ble-color-border, #334155);
      color: var(--ble-color-text-secondary, #94a3b8);
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: all 120ms ease;
    }

    .reset-btn:hover:not(:disabled) {
      background: var(--ble-color-surface-subtle, #334155);
      color: #f8fafc;
    }

    .reset-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Error Banner */
    .error-banner {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 10px 14px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
    }

    .error-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .retry-btn {
      background: #ef4444;
      border: none;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }

    /* Table Container */
    .table-container {
      background: var(--ble-color-surface, #1e293b);
      border: 1px solid var(--ble-color-border, #334155);
      border-radius: 6px;
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    .data-table thead th {
      background: rgba(15, 23, 42, 0.85);
      padding: 8px 12px;
      border-bottom: 1px solid var(--ble-color-border, #334155);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--ble-color-text-secondary, #94a3b8);
      white-space: nowrap;
      user-select: none;
    }

    .data-table thead th.sortable {
      cursor: pointer;
      transition: color 120ms ease;
    }

    .data-table thead th.sortable:hover {
      color: #f8fafc;
    }

    .sort-icon {
      margin-left: 4px;
      font-size: 10px;
      opacity: 0.7;
    }

    .data-table tbody tr {
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
      transition: background-color 100ms ease;
    }

    .data-table tbody tr:hover {
      background: rgba(30, 41, 59, 0.8);
    }

    .data-table tbody td {
      padding: 8px 12px;
      vertical-align: middle;
      white-space: nowrap;
    }

    .id-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .id-text {
      font-weight: 600;
      color: #93c5fd;
    }

    .copy-btn {
      background: transparent;
      border: none;
      color: var(--ble-color-text-muted, #64748b);
      font-size: 12px;
      cursor: pointer;
      padding: 0 4px;
      border-radius: 2px;
    }

    .copy-btn:hover {
      color: #f8fafc;
      background: rgba(255, 255, 255, 0.1);
    }

    .text-muted {
      color: var(--ble-color-text-muted, #64748b);
    }

    .font-bold {
      font-weight: 700;
    }

    .text-right {
      text-align: right;
    }

    .text-center {
      text-align: center;
    }

    .type-pill {
      background: rgba(148, 163, 184, 0.12);
      color: #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .balance-amount {
      font-size: 13px;
      font-weight: 600;
      color: #f8fafc;
    }

    .balance-amount.zero {
      color: var(--ble-color-text-muted, #64748b);
    }

    .row-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .action-btn {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 120ms ease;
    }

    .action-btn.secondary {
      background: var(--ble-color-surface-muted, #0f172a);
      border-color: var(--ble-color-border, #334155);
      color: var(--ble-color-text-primary, #f8fafc);
    }

    .action-btn.secondary:hover {
      background: var(--ble-color-surface-subtle, #334155);
    }

    .action-btn.warning {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border-color: rgba(245, 158, 11, 0.3);
    }

    .action-btn.warning:hover {
      background: rgba(245, 158, 11, 0.25);
    }

    .action-btn.success {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .action-btn.success:hover {
      background: rgba(16, 185, 129, 0.25);
    }

    .action-btn.danger {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.3);
    }

    .action-btn.danger:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.25);
    }

    .action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* Empty State */
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      font-size: 32px;
      opacity: 0.6;
    }

    .empty-title {
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
    }

    .empty-desc {
      font-size: 12px;
      color: var(--ble-color-text-muted, #64748b);
      margin-bottom: 8px;
    }

    /* Skeleton Loading */
    .skeleton-wrapper {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .skeleton-row {
      display: flex;
      gap: 12px;
      height: 24px;
    }

    .skeleton-cell {
      background: rgba(51, 65, 85, 0.4);
      border-radius: 4px;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .w-10 { width: 10%; }
    .w-15 { width: 15%; }
    .w-20 { width: 20%; }
    .w-25 { width: 25%; }

    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }

    /* Pagination Bar */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding: 8px 4px;
      font-size: 12px;
    }

    .pagination-info {
      color: var(--ble-color-text-secondary, #94a3b8);
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .page-size-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .page-size-label {
      color: var(--ble-color-text-muted, #64748b);
      font-size: 11px;
    }

    .page-size-select {
      background: var(--ble-color-surface, #1e293b);
      border: 1px solid var(--ble-color-border, #334155);
      color: var(--ble-color-text-primary, #f8fafc);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      outline: none;
    }

    .page-nav-btns {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .nav-page-btn {
      background: var(--ble-color-surface, #1e293b);
      border: 1px solid var(--ble-color-border, #334155);
      color: var(--ble-color-text-primary, #f8fafc);
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: all 120ms ease;
    }

    .nav-page-btn:hover:not(:disabled) {
      background: var(--ble-color-surface-subtle, #334155);
    }

    .nav-page-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .current-page-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #60a5fa;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
    }
  `]
})
export class AccountTableComponent implements OnInit {
  adminService: AccountAdminService;

  // Delegated reactive state signals
  get accounts() { return this.adminService.accounts; }
  get loading() { return this.adminService.loading; }
  get error() { return this.adminService.error; }
  get searchQuery() { return this.adminService.searchQuery; }
  get statusFilter() { return this.adminService.statusFilter; }
  get typeFilter() { return this.adminService.typeFilter; }
  get currencyFilter() { return this.adminService.currencyFilter; }
  get sortBy() { return this.adminService.sortBy; }
  get sortDirection() { return this.adminService.sortDirection; }
  get currentPage() { return this.adminService.currentPage; }
  get pageSize() { return this.adminService.pageSize; }
  get totalCount() { return this.adminService.totalCount; }
  get totalPages() { return this.adminService.totalPages; }
  get paginatedAccounts() { return this.adminService.paginatedAccounts; }
  get hasActiveFilters() { return this.adminService.hasActiveFilters; }
  get startRecordIndex() { return this.adminService.startRecordIndex; }
  get endRecordIndex() { return this.adminService.endRecordIndex; }

  // Local interaction signals
  readonly copiedAccountId = signal<string | null>(null);

  constructor(service?: AccountAdminService) {
    if (service) {
      this.adminService = service;
    } else {
      this.adminService = inject(AccountAdminService);
    }
  }

  ngOnInit(): void {
    if (this.accounts().length === 0) {
      this.adminService.loadAccounts();
    }
  }

  refresh(): void {
    this.adminService.loadAccounts();
  }

  onSearchChange(value: string): void {
    this.adminService.setSearch(value);
  }

  onStatusChange(value: string): void {
    this.adminService.setStatusFilter(value);
  }

  onTypeChange(value: string): void {
    this.adminService.setTypeFilter(value);
  }

  onCurrencyChange(value: string): void {
    this.adminService.setCurrencyFilter(value);
  }

  resetFilters(): void {
    this.adminService.resetFilters();
  }

  toggleSort(column: string): void {
    this.adminService.toggleSort(column);
  }

  getSortIcon(column: string): string {
    if (this.sortBy() !== column) return '⇅';
    return this.sortDirection() === 'asc' ? '▲' : '▼';
  }

  prevPage(): void {
    this.adminService.setPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.adminService.setPage(this.currentPage() + 1);
  }

  onPageSizeChange(size: number | string): void {
    const parsed = typeof size === 'string' ? parseInt(size, 10) : size;
    if (!isNaN(parsed) && parsed > 0) {
      this.adminService.setPageSize(parsed);
    }
  }

  formatBalance(account: AccountResponse): string {
    return this.adminService.formatBalance(account);
  }

  isZeroBalance(account: AccountResponse): boolean {
    return this.adminService.isZeroBalance(account);
  }

  canClose(account: AccountResponse): boolean {
    // BR-F05 Zero-Balance Terminal Rule: Cannot close if derivedBalance != 0.00
    return this.isZeroBalance(account);
  }

  async copyAccountId(id: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(id);
      }
      this.copiedAccountId.set(id);
      setTimeout(() => {
        if (this.copiedAccountId() === id) {
          this.copiedAccountId.set(null);
        }
      }, 2000);
    } catch (err) {
      console.error('Failed to copy account ID', err);
    }
  }

  // Lifecycle Action Triggers (Wired for S4-T3)
  freeze(account: AccountResponse): void {
    console.info('[AccountOps] Trigger freeze dialog for', account.id);
  }

  unfreeze(account: AccountResponse): void {
    console.info('[AccountOps] Trigger unfreeze dialog for', account.id);
  }

  close(account: AccountResponse): void {
    console.info('[AccountOps] Trigger close dialog for', account.id);
  }
}
