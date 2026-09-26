import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SettlementBatchDashboardComponent } from '../settlement';

export type ReconTab = 'batches' | 'cases';

/**
 * ReconciliationComponent
 *
 * Back-office Settlement & Reconciliation Hub (Sprint 5 Tasks 2 & 3).
 * Dual-tab workspace managing:
 * - Settlement Batches (FR-OPS-RECON-01): Clearing batch monitor, netting totals, atomic settlements.
 * - Reconciliation Cases (FR-OPS-RECON-02): Discrepancy case resolution against external banking files.
 */
@Component({
  selector: 'ble-reconciliation',
  standalone: true,
  imports: [CommonModule, SettlementBatchDashboardComponent],
  template: `
    <div class="recon-hub" data-testid="recon-hub">
      <!-- Navigation Tabs Header -->
      <div class="recon-tabs-bar" data-testid="recon-tabs-bar">
        <button
          type="button"
          class="recon-tab-btn"
          [class.active]="activeTab() === 'batches'"
          (click)="setTab('batches')"
          data-testid="tab-settlement-batches"
        >
          <span class="tab-icon">📦</span>
          <span>Settlement Batches</span>
          <span class="active-indicator"></span>
        </button>

        <button
          type="button"
          class="recon-tab-btn"
          [class.active]="activeTab() === 'cases'"
          (click)="setTab('cases')"
          data-testid="tab-recon-cases"
        >
          <span class="tab-icon">⚖</span>
          <span>Reconciliation Cases</span>
          <span class="badge-stage">S5-T3</span>
          <span class="active-indicator"></span>
        </button>
      </div>

      <!-- Tab 1: Settlement Batches -->
      <div class="tab-content" *ngIf="activeTab() === 'batches'" data-testid="tab-content-batches">
        <ble-settlement-batch-dashboard />
      </div>

      <!-- Tab 2: Reconciliation Discrepancy Cases (Staged S5-T3) -->
      <div class="tab-content" *ngIf="activeTab() === 'cases'" data-testid="tab-content-cases">
        <div class="cases-placeholder" data-testid="cases-placeholder">
          <div class="placeholder-card">
            <span class="placeholder-icon">⚖</span>
            <h3>External Reconciliation Cases (FR-OPS-RECON-02)</h3>
            <p>
              Compare internal ledger movements against external bank clearing files, inspect
              discrepancy mismatches, and execute administrative resolution actions (RESOLVE,
              ESCALATE, FORCE_ADJUST).
            </p>
            <div class="badge-staged-info">
              <span>Staged for Sprint 5 Task 3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .recon-hub {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        background: var(--ble-color-background, #0b1120);
      }

      .recon-tabs-bar {
        display: flex;
        gap: 8px;
        padding: 0 24px;
        background: var(--ble-color-surface, #1e293b);
        border-bottom: 1px solid var(--ble-color-border, #334155);
        flex-shrink: 0;
      }

      .recon-tab-btn {
        position: relative;
        background: transparent;
        border: none;
        color: var(--ble-color-text-secondary, #94a3b8);
        font-size: 13px;
        font-weight: 500;
        padding: 14px 16px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: color 0.15s ease;
      }

      .recon-tab-btn:hover {
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .recon-tab-btn.active {
        color: var(--ble-color-primary, #38bdf8);
        font-weight: 600;
      }

      .active-indicator {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: transparent;
        transition: background 0.15s ease;
      }

      .recon-tab-btn.active .active-indicator {
        background: var(--ble-color-primary, #38bdf8);
      }

      .tab-icon {
        font-size: 15px;
      }

      .badge-stage {
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(14, 165, 233, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(14, 165, 233, 0.3);
      }

      .tab-content {
        flex: 1;
        overflow: hidden;
      }

      .cases-placeholder {
        padding: 40px 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
      }

      .placeholder-card {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 40px;
        max-width: 580px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .placeholder-icon {
        font-size: 40px;
      }

      .placeholder-card h3 {
        margin: 0;
        font-size: 18px;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .placeholder-card p {
        margin: 0;
        font-size: 13px;
        line-height: 1.5;
        color: var(--ble-color-text-secondary, #94a3b8);
      }

      .badge-staged-info {
        margin-top: 8px;
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #fbbf24;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 12px;
        border-radius: 9999px;
      }
    `,
  ],
})
export class ReconciliationComponent implements OnInit {
  private readonly route?: ActivatedRoute;
  private readonly router?: Router;

  readonly activeTab = signal<ReconTab>('batches');

  constructor(route?: ActivatedRoute, router?: Router) {
    if (route && router) {
      this.route = route;
      this.router = router;
    } else {
      try {
        this.route = inject(ActivatedRoute);
        this.router = inject(Router);
      } catch {
        // Safe fallback for isolated unit tests
      }
    }
  }

  ngOnInit(): void {
    if (this.route?.queryParams) {
      this.route.queryParams.subscribe((params) => {
        if (params['tab'] === 'cases') {
          this.activeTab.set('cases');
        } else {
          this.activeTab.set('batches');
        }
      });
    }
  }

  setTab(tab: ReconTab): void {
    this.activeTab.set(tab);
    if (this.router && this.route) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        queryParamsHandling: 'merge',
      });
    }
  }
}
