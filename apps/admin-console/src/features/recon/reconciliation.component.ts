import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SettlementBatchDashboardComponent } from '../settlement';
import { ReconciliationCasesDashboardComponent } from './reconciliation-cases-dashboard.component';

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
  imports: [CommonModule, SettlementBatchDashboardComponent, ReconciliationCasesDashboardComponent],
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
          <span class="active-indicator"></span>
        </button>
      </div>

      <!-- Tab 1: Settlement Batches (FR-OPS-RECON-01) -->
      <div class="tab-content" *ngIf="activeTab() === 'batches'" data-testid="tab-content-batches">
        <ble-settlement-batch-dashboard />
      </div>

      <!-- Tab 2: Reconciliation Discrepancy Cases (FR-OPS-RECON-02) -->
      <div class="tab-content" *ngIf="activeTab() === 'cases'" data-testid="tab-content-cases">
        <ble-reconciliation-cases-dashboard />
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

      .tab-content {
        flex: 1;
        overflow: hidden;
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
