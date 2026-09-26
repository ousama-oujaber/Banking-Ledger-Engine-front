import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RuleAdminService } from './services/rule-admin.service';
import {
  FeeRuleFormComponent,
  InterestRuleFormComponent,
  FeeCalculationSimulatorComponent,
  InterestPreviewModalComponent,
  InterestOpsModalComponent,
} from './components';
import type { FeeRuleResponse, InterestRuleResponse } from '@ble-frontend/api-client';

/**
 * RulesMatrixComponent
 *
 * Back-office Rules Engine Workspace (Sprint 5 Task 1).
 * High-density management interface for configuring fee schedules, interest accrual rules,
 * running real-time fee calculation simulations, and triggering administrative accrual/posting operations.
 */
@Component({
  selector: 'ble-rules-matrix',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FeeRuleFormComponent,
    InterestRuleFormComponent,
    FeeCalculationSimulatorComponent,
    InterestPreviewModalComponent,
    InterestOpsModalComponent,
  ],
  template: `
    <div class="rules-workspace" data-testid="rules-workspace">
      <!-- Workspace Page Title & Header Stats -->
      <div class="workspace-header">
        <div class="title-block">
          <div class="breadcrumb">Operations / Rules Engine</div>
          <h1 class="page-title">Fee & Interest Rule Matrix</h1>
          <p class="page-subtitle">
            Configure transaction fee structures, progressive tiers, interest yields, and test live
            calculation models
          </p>
        </div>

        <div class="stats-cards-bar">
          <!-- Active Fee Rules Metric -->
          <div class="stat-card" data-testid="stat-fee-rules">
            <span class="stat-label">Active Fee Rules</span>
            <div class="stat-val-row">
              <span class="stat-val font-mono">{{ activeFeeCount() }}</span>
              <span class="stat-badge blue">Of {{ feeRules().length }} Total</span>
            </div>
          </div>

          <!-- Active Interest Rules Metric -->
          <div class="stat-card" data-testid="stat-interest-rules">
            <span class="stat-label">Active Interest Rules</span>
            <div class="stat-val-row">
              <span class="stat-val font-mono">{{ activeInterestCount() }}</span>
              <span class="stat-badge green">Of {{ interestRules().length }} Total</span>
            </div>
          </div>

          <!-- Supported Currencies Metric -->
          <div class="stat-card">
            <span class="stat-label">Currencies Configured</span>
            <div class="stat-val-row">
              <span class="stat-val font-mono">5</span>
              <span class="stat-badge amber">EUR · USD · MAD · GBP · JPY</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Success Banner / Toast -->
      <div *ngIf="successMessage()" class="success-banner" data-testid="rules-success-banner">
        <div class="success-content">
          <span class="success-icon">✓</span>
          <span class="success-text">{{ successMessage() }}</span>
        </div>
        <button
          type="button"
          class="dismiss-btn"
          (click)="dismissSuccessMessage()"
          aria-label="Dismiss message"
        >
          ✕
        </button>
      </div>

      <!-- Toolbar: Tabs, Search & Action Triggers -->
      <div class="toolbar-card" data-testid="rules-toolbar">
        <!-- Tab Navigation Switcher -->
        <div class="tabs-nav" data-testid="rules-tabs">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'fees'"
            (click)="switchTab('fees')"
            data-testid="tab-fees"
          >
            <span class="tab-icon">💳</span>
            <span>Fee Rules ({{ feeRules().length }})</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'interest'"
            (click)="switchTab('interest')"
            data-testid="tab-interest"
          >
            <span class="tab-icon">📈</span>
            <span>Interest Rules ({{ interestRules().length }})</span>
          </button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab() === 'simulator'"
            (click)="switchTab('simulator')"
            data-testid="tab-simulator"
          >
            <span class="tab-icon">🧮</span>
            <span>Simulation Sandbox</span>
          </button>
        </div>

        <!-- Controls & Action Buttons -->
        <div class="toolbar-controls">
          <div *ngIf="activeTab() !== 'simulator'" class="search-box">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              class="search-input"
              placeholder="Filter by code or name..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              data-testid="rules-search-input"
            />
          </div>

          <label *ngIf="activeTab() !== 'simulator'" class="active-toggle-label">
            <input
              type="checkbox"
              [ngModel]="activeOnly()"
              (ngModelChange)="activeOnly.set($event)"
              data-testid="active-only-checkbox"
            />
            <span>Active Only</span>
          </label>

          <!-- Contextual Action Buttons -->
          <ng-container [ngSwitch]="activeTab()">
            <!-- Fee Tab Actions -->
            <div *ngSwitchCase="'fees'" class="action-buttons-group">
              <button
                type="button"
                class="btn-primary"
                (click)="openFeeModal()"
                data-testid="create-fee-rule-btn"
              >
                + New Fee Rule
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="refresh()"
                [disabled]="loading()"
                title="Reload fee rules"
              >
                ↻ Refresh
              </button>
            </div>

            <!-- Interest Tab Actions -->
            <div *ngSwitchCase="'interest'" class="action-buttons-group">
              <button
                type="button"
                class="btn-primary"
                (click)="openInterestModal()"
                data-testid="create-interest-rule-btn"
              >
                + New Interest Rule
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="openInterestOpsModal('ACCRUE')"
                data-testid="accrue-sweep-btn"
              >
                ⚡ Accrual Sweep
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="openInterestOpsModal('POST')"
                data-testid="post-interest-btn"
              >
                💰 Post Interest
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="openInterestPreviewModal()"
                data-testid="preview-forecast-btn"
              >
                📊 Forecast Preview
              </button>
              <button
                type="button"
                class="btn-secondary"
                (click)="refresh()"
                [disabled]="loading()"
                title="Reload interest rules"
              >
                ↻ Refresh
              </button>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Main Content Area: Based on Active Tab -->

      <!-- TAB 1: FEE RULES TABLE -->
      <div
        *ngIf="activeTab() === 'fees'"
        class="table-container"
        data-testid="fee-rules-table-container"
      >
        <div *ngIf="loading()" class="loading-state">
          <span class="loading-spinner"></span>
          <span>Loading configured fee rules...</span>
        </div>

        <table *ngIf="!loading()" class="data-table" data-testid="fee-rules-table">
          <thead>
            <tr>
              <th>Rule Code</th>
              <th>Display Name</th>
              <th>Transaction Type</th>
              <th>Currency</th>
              <th>Calculation Model</th>
              <th>Rate / Amount</th>
              <th>Caps (Min / Max)</th>
              <th>Tax Rate</th>
              <th>Version</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="filteredFeeRules().length === 0">
              <td colspan="11" class="empty-cell">
                No fee rules found matching the current search criteria.
              </td>
            </tr>
            <tr *ngFor="let rule of filteredFeeRules()" [attr.data-testid]="'fee-row-' + rule.code">
              <!-- Code & Copy -->
              <td>
                <span class="code-pill font-mono">{{ rule.code }}</span>
              </td>

              <!-- Display Name -->
              <td class="font-semibold">{{ rule.name }}</td>

              <!-- Transaction Type -->
              <td>
                <span class="type-pill font-mono">{{ rule.transactionType }}</span>
              </td>

              <!-- Currency -->
              <td>
                <span class="currency-badge font-mono">{{ rule.currency }}</span>
              </td>

              <!-- Calculation Model Badge -->
              <td>
                <span
                  class="model-badge font-mono"
                  [class.fixed]="rule.calculationType === 'FIXED'"
                  [class.percentage]="rule.calculationType === 'PERCENTAGE'"
                  [class.tiered]="rule.calculationType === 'TIERED'"
                >
                  {{ rule.calculationType }}
                </span>
              </td>

              <!-- Rate / Amount Details -->
              <td class="font-mono">
                <span *ngIf="rule.calculationType === 'FIXED'">
                  {{ formatAmount(rule.fixedAmount, rule.currency) }}
                </span>
                <span *ngIf="rule.calculationType === 'PERCENTAGE'">
                  {{ rule.percentageRate }}%
                </span>
                <span *ngIf="rule.calculationType === 'TIERED'" class="tiered-info">
                  {{ rule.tiers?.length || 0 }} Brackets
                </span>
              </td>

              <!-- Caps -->
              <td class="font-mono font-muted">
                {{ formatCap(rule.minFee) }} / {{ formatCap(rule.maxFee) }}
              </td>

              <!-- Tax Rate -->
              <td class="font-mono">
                <span *ngIf="rule.taxRate !== undefined && rule.taxRate !== null">
                  {{ rule.taxRate }}%
                </span>
                <span
                  *ngIf="rule.taxRate === undefined || rule.taxRate === null"
                  class="font-muted"
                >
                  0%
                </span>
              </td>

              <!-- Version -->
              <td class="font-mono font-muted">v{{ rule.version || 1 }}</td>

              <!-- Status -->
              <td>
                <span
                  class="status-pill font-mono"
                  [class.active]="rule.active !== false"
                  [class.inactive]="rule.active === false"
                >
                  {{ rule.active !== false ? 'ACTIVE' : 'INACTIVE' }}
                </span>
              </td>

              <!-- Actions -->
              <td class="text-right">
                <button
                  type="button"
                  class="btn-table-action"
                  (click)="testRuleInSimulator(rule.code)"
                  title="Test in simulation sandbox"
                  data-testid="test-rule-btn"
                >
                  🧮 Test
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TAB 2: INTEREST RULES TABLE -->
      <div
        *ngIf="activeTab() === 'interest'"
        class="table-container"
        data-testid="interest-rules-table-container"
      >
        <div *ngIf="loading()" class="loading-state">
          <span class="loading-spinner"></span>
          <span>Loading configured interest rules...</span>
        </div>

        <table *ngIf="!loading()" class="data-table" data-testid="interest-rules-table">
          <thead>
            <tr>
              <th>Rule Code</th>
              <th>Target Product</th>
              <th>Direction</th>
              <th>Annual Rate (%)</th>
              <th>Day Count Basis</th>
              <th>Balance Basis</th>
              <th>Min Balance</th>
              <th>Version</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="filteredInterestRules().length === 0">
              <td colspan="9" class="empty-cell">
                No interest rules found matching the current search criteria.
              </td>
            </tr>
            <tr
              *ngFor="let rule of filteredInterestRules()"
              [attr.data-testid]="'interest-row-' + rule.code"
            >
              <!-- Code -->
              <td>
                <span class="code-pill font-mono">{{ rule.code }}</span>
              </td>

              <!-- Target Product -->
              <td>
                <span class="product-tag font-mono">{{ rule.productCode }}</span>
              </td>

              <!-- Direction -->
              <td>
                <span
                  class="direction-pill font-mono"
                  [class.credit]="rule.interestType === 'CREDIT'"
                  [class.debit]="rule.interestType === 'DEBIT'"
                >
                  {{ rule.interestType }}
                </span>
              </td>

              <!-- Rate -->
              <td class="font-mono rate-val font-semibold">{{ rule.annualRate }}% p.a.</td>

              <!-- Day Count Basis -->
              <td>
                <span class="basis-pill font-mono">{{ rule.accrualBasis }}</span>
              </td>

              <!-- Balance Basis -->
              <td>
                <span class="basis-pill font-mono">{{ rule.balanceBasis }}</span>
              </td>

              <!-- Min Eligible Balance -->
              <td class="font-mono">
                <span *ngIf="rule.minEligibleBalance">
                  {{ rule.minEligibleBalance.currency }} {{ rule.minEligibleBalance.amount }}
                </span>
                <span *ngIf="!rule.minEligibleBalance" class="font-muted">None</span>
              </td>

              <!-- Version -->
              <td class="font-mono font-muted">v{{ rule.version || 1 }}</td>

              <!-- Status -->
              <td>
                <span
                  class="status-pill font-mono"
                  [class.active]="rule.active !== false"
                  [class.inactive]="rule.active === false"
                >
                  {{ rule.active !== false ? 'ACTIVE' : 'INACTIVE' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TAB 3: SIMULATION SANDBOX -->
      <div
        *ngIf="activeTab() === 'simulator'"
        class="sandbox-container"
        data-testid="simulator-container"
      >
        <ble-fee-calculation-simulator
          [preselectedRuleCode]="selectedRuleCodeForSimulation()"
        ></ble-fee-calculation-simulator>
      </div>

      <!-- Modals & Drawers -->
      <ble-fee-rule-form
        [isOpen]="isFeeModalOpen()"
        (onClose)="closeFeeModal()"
        (onSuccess)="onFeeRuleCreated($event)"
      ></ble-fee-rule-form>

      <ble-interest-rule-form
        [isOpen]="isInterestModalOpen()"
        (onClose)="closeInterestModal()"
        (onSuccess)="onInterestRuleCreated($event)"
      ></ble-interest-rule-form>

      <ble-interest-preview-modal
        [isOpen]="isPreviewModalOpen()"
        (onClose)="closeInterestPreviewModal()"
      ></ble-interest-preview-modal>

      <ble-interest-ops-modal
        [isOpen]="isOpsModalOpen()"
        [mode]="opsMode()"
        (onClose)="closeInterestOpsModal()"
        (onSuccess)="onInterestOpsSuccess($event)"
      ></ble-interest-ops-modal>
    </div>
  `,
  styles: [
    `
      .rules-workspace {
        padding: 24px 32px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      /* Workspace Header */
      .workspace-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 24px;
        flex-wrap: wrap;
      }

      .title-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .breadcrumb {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--ble-color-text-muted, #64748b);
        font-weight: 600;
      }

      .page-title {
        font-size: 22px;
        font-weight: 700;
        margin: 0;
        letter-spacing: -0.02em;
      }

      .page-subtitle {
        font-size: 13px;
        color: var(--ble-color-text-secondary, #94a3b8);
        margin: 0;
      }

      .stats-cards-bar {
        display: flex;
        gap: 12px;
      }

      .stat-card {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 10px 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 140px;
      }

      .stat-label {
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
        font-weight: 600;
        text-transform: uppercase;
      }

      .stat-val-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      .stat-val {
        font-size: 18px;
        font-weight: 700;
        color: #f8fafc;
      }

      .stat-badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 600;
      }

      .stat-badge.blue {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
      }

      .stat-badge.green {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .stat-badge.amber {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      /* Success Toast Banner */
      .success-banner {
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #6ee7b7;
        padding: 10px 14px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
      }

      .success-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .success-icon {
        font-weight: 700;
        font-size: 14px;
      }

      .dismiss-btn {
        background: transparent;
        border: none;
        color: #6ee7b7;
        cursor: pointer;
        padding: 2px 6px;
      }

      /* Toolbar Card */
      .toolbar-card {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .tabs-nav {
        display: flex;
        background: #0f172a;
        padding: 3px;
        border-radius: 6px;
        border: 1px solid #334155;
      }

      .tab-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }

      .tab-btn.active {
        background: #3b82f6;
        color: #ffffff;
      }

      .toolbar-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .search-box {
        display: flex;
        align-items: center;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        padding: 6px 10px;
        gap: 6px;
      }

      .search-icon {
        color: #64748b;
        font-size: 12px;
      }

      .search-input {
        background: transparent;
        border: none;
        color: #f8fafc;
        font-size: 12px;
        outline: none;
        width: 180px;
      }

      .active-toggle-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #94a3b8;
        cursor: pointer;
      }

      .action-buttons-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-primary {
        background: #3b82f6;
        border: none;
        color: #ffffff;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .btn-primary:hover {
        background: #2563eb;
      }

      .btn-secondary {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #475569;
        color: #cbd5e1;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        color: #f8fafc;
      }

      /* Data Tables */
      .table-container {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        overflow: hidden;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .data-table th {
        text-align: left;
        padding: 10px 14px;
        background: rgba(15, 23, 42, 0.8);
        border-bottom: 1px solid var(--ble-color-border, #334155);
        color: #94a3b8;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .data-table td {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.4);
      }

      .data-table tr:hover td {
        background: rgba(255, 255, 255, 0.02);
      }

      .code-pill {
        background: #0f172a;
        border: 1px solid #334155;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        color: #60a5fa;
      }

      .type-pill {
        background: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }

      .product-tag {
        background: rgba(168, 85, 247, 0.15);
        color: #d8b4fe;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }

      .currency-badge {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid #334155;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .model-badge {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
      }

      .model-badge.fixed {
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
      }

      .model-badge.percentage {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }

      .model-badge.tiered {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .direction-pill {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
      }

      .direction-pill.credit {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .direction-pill.debit {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .basis-pill {
        font-size: 11px;
        color: #cbd5e1;
      }

      .rate-val {
        color: #34d399;
      }

      .status-pill {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
      }

      .status-pill.active {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .status-pill.inactive {
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
      }

      .btn-table-action {
        background: transparent;
        border: 1px solid #475569;
        color: #94a3b8;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
      }

      .btn-table-action:hover {
        color: #f8fafc;
        border-color: #64748b;
      }

      .font-muted {
        color: #64748b;
      }

      .font-semibold {
        font-weight: 600;
      }

      .text-right {
        text-align: right;
      }

      .empty-cell {
        text-align: center;
        padding: 30px;
        color: #64748b;
        font-style: italic;
      }

      .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 40px;
        color: #94a3b8;
        font-size: 13px;
      }

      .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: #3b82f6;
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
export class RulesMatrixComponent implements OnInit {
  private adminService: RuleAdminService;

  readonly activeTab = signal<'fees' | 'interest' | 'simulator'>('fees');
  readonly searchQuery = signal<string>('');
  readonly activeOnly = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly selectedRuleCodeForSimulation = signal<string | undefined>(undefined);
  private successTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Modal Dialog Visibility Signals
  readonly isFeeModalOpen = signal<boolean>(false);
  readonly isInterestModalOpen = signal<boolean>(false);
  readonly isPreviewModalOpen = signal<boolean>(false);
  readonly isOpsModalOpen = signal<boolean>(false);
  readonly opsMode = signal<'ACCRUE' | 'POST'>('ACCRUE');

  // Service Signals Proxy
  get feeRules() {
    return this.adminService.feeRules;
  }

  get interestRules() {
    return this.adminService.interestRules;
  }

  get loading() {
    return this.adminService.loading;
  }

  get activeFeeCount() {
    return this.adminService.activeFeeRulesCount;
  }

  get activeInterestCount() {
    return this.adminService.activeInterestRulesCount;
  }

  // Filtered Computeds
  readonly filteredFeeRules = computed<FeeRuleResponse[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const activeOnlyFilter = this.activeOnly();

    return this.feeRules().filter((rule) => {
      if (activeOnlyFilter && rule.active === false) return false;
      if (!query) return true;
      const codeMatch = rule.code?.toLowerCase().includes(query);
      const nameMatch = rule.name?.toLowerCase().includes(query);
      const txMatch = rule.transactionType?.toLowerCase().includes(query);
      return codeMatch || nameMatch || txMatch;
    });
  });

  readonly filteredInterestRules = computed<InterestRuleResponse[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const activeOnlyFilter = this.activeOnly();

    return this.interestRules().filter((rule) => {
      if (activeOnlyFilter && rule.active === false) return false;
      if (!query) return true;
      const codeMatch = rule.code?.toLowerCase().includes(query);
      const productMatch = rule.productCode?.toLowerCase().includes(query);
      return codeMatch || productMatch;
    });
  });

  constructor(service?: RuleAdminService) {
    if (service) {
      this.adminService = service;
    } else {
      this.adminService = inject(RuleAdminService);
    }
  }

  ngOnInit(): void {
    if (this.feeRules().length === 0) {
      this.adminService.loadFeeRules();
    }
    if (this.interestRules().length === 0) {
      this.adminService.loadInterestRules();
    }
  }

  refresh(): void {
    if (this.activeTab() === 'fees') {
      this.adminService.loadFeeRules(this.activeOnly());
    } else if (this.activeTab() === 'interest') {
      this.adminService.loadInterestRules(undefined, this.activeOnly());
    }
  }

  switchTab(tab: 'fees' | 'interest' | 'simulator'): void {
    this.activeTab.set(tab);
  }

  openFeeModal(): void {
    this.isFeeModalOpen.set(true);
  }

  closeFeeModal(): void {
    this.isFeeModalOpen.set(false);
  }

  openInterestModal(): void {
    this.isInterestModalOpen.set(true);
  }

  closeInterestModal(): void {
    this.isInterestModalOpen.set(false);
  }

  openInterestPreviewModal(): void {
    this.isPreviewModalOpen.set(true);
  }

  closeInterestPreviewModal(): void {
    this.isPreviewModalOpen.set(false);
  }

  openInterestOpsModal(mode: 'ACCRUE' | 'POST'): void {
    this.opsMode.set(mode);
    this.isOpsModalOpen.set(true);
  }

  closeInterestOpsModal(): void {
    this.isOpsModalOpen.set(false);
  }

  testRuleInSimulator(code?: string): void {
    this.selectedRuleCodeForSimulation.set(code);
    this.activeTab.set('simulator');
  }

  formatAmount(amount?: number, currency = 'EUR'): string {
    if (amount === undefined || amount === null) return '—';
    return `${currency} ${amount.toFixed(2)}`;
  }

  formatCap(cap?: number): string {
    return cap !== undefined && cap !== null ? `${cap}` : '—';
  }

  onFeeRuleCreated(rule: FeeRuleResponse): void {
    this.showToast(`Fee Rule ${rule.code} successfully created.`);
  }

  onInterestRuleCreated(rule: InterestRuleResponse): void {
    this.showToast(`Interest Rule ${rule.code} successfully created.`);
  }

  onInterestOpsSuccess(event: { action: string; count?: number }): void {
    if (event.action === 'ACCRUE') {
      this.showToast(`Accrual sweep completed across ${event.count || 0} accounts.`);
    } else {
      this.showToast(`Accrued interest successfully posted (${event.count || 1} entries).`);
    }
  }

  private showToast(msg: string): void {
    this.successMessage.set(msg);
    if (this.successTimeoutId) {
      clearTimeout(this.successTimeoutId);
    }
    this.successTimeoutId = setTimeout(() => {
      this.successMessage.set(null);
    }, 5000);
  }

  dismissSuccessMessage(): void {
    if (this.successTimeoutId) {
      clearTimeout(this.successTimeoutId);
    }
    this.successMessage.set(null);
  }
}
