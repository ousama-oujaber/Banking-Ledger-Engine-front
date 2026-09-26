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
import { RuleAdminService } from '../services/rule-admin.service';
import type {
  InterestPreviewResponse,
  DailyInterestAccrualResponse,
} from '@ble-frontend/api-client';

/**
 * InterestPreviewModalComponent
 *
 * Standalone Angular 19 modal dialog to forecast and simulate interest accrual runs
 * across historical or projected date ranges for an account.
 */
@Component({
  selector: 'ble-interest-preview-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="isOpen()"
      class="modal-backdrop"
      (click)="onBackdropClick($event)"
      data-testid="interest-preview-backdrop"
    >
      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="interest-preview-title"
        data-testid="interest-preview-dialog"
      >
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-titles">
            <span class="header-icon">📈</span>
            <div>
              <h3 id="interest-preview-title" class="title-text">Interest Accrual Simulation</h3>
              <p class="subtitle-text">Forecast daily accruals and projected interest postings for accounts</p>
            </div>
          </div>
          <button
            type="button"
            class="close-btn"
            (click)="handleCancel()"
            aria-label="Close dialog"
            [disabled]="simulating()"
          >
            ✕
          </button>
        </div>

        <!-- Error Notification -->
        <div *ngIf="error()" class="error-banner" data-testid="interest-preview-error">
          <span class="error-icon">⚠</span>
          <span class="error-text">{{ error() }}</span>
        </div>

        <div class="modal-body">
          <!-- Simulation Parameters -->
          <div class="form-row">
            <div class="form-group flex-2">
              <label class="form-label" for="preview-acc-id">Account ID <span class="required">*</span></label>
              <input
                id="preview-acc-id"
                type="text"
                class="form-input font-mono"
                [ngModel]="accountId()"
                (ngModelChange)="accountId.set($event)"
                placeholder="acc-001"
                data-testid="preview-account-input"
                [disabled]="simulating()"
              />
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="preview-from-date">From Date <span class="required">*</span></label>
              <input
                id="preview-from-date"
                type="date"
                class="form-input font-mono"
                [ngModel]="fromDate()"
                (ngModelChange)="fromDate.set($event)"
                data-testid="preview-fromdate-input"
                [disabled]="simulating()"
              />
            </div>

            <div class="form-group flex-1">
              <label class="form-label" for="preview-to-date">To Date <span class="required">*</span></label>
              <input
                id="preview-to-date"
                type="date"
                class="form-input font-mono"
                [ngModel]="toDate()"
                (ngModelChange)="toDate.set($event)"
                data-testid="preview-todate-input"
                [disabled]="simulating()"
              />
            </div>
          </div>

          <div class="action-bar">
            <button
              type="button"
              class="btn-forecast"
              (click)="runSimulation()"
              [disabled]="!isSubmitEnabled() || simulating()"
              data-testid="run-forecast-btn"
            >
              <span *ngIf="simulating()" class="spinner"></span>
              <span>{{ simulating() ? 'Projecting...' : 'Calculate Forecast' }}</span>
            </button>
          </div>

          <!-- Forecast Results Breakdown -->
          <div *ngIf="forecast()" class="forecast-result" data-testid="forecast-result">
            <div class="kpi-banner">
              <div class="kpi-col">
                <span class="kpi-label">Matched Interest Rule</span>
                <span class="kpi-val font-mono">{{ forecast()?.ruleCode || 'DEFAULT' }}</span>
              </div>
              <div class="kpi-col highlight">
                <span class="kpi-label">Total Projected Interest</span>
                <span class="kpi-val font-mono" data-testid="total-projected-val">
                  {{ formatMoney(forecast()?.totalEstimatedInterest) }}
                </span>
              </div>
            </div>

            <!-- Daily Accruals List -->
            <div class="daily-table-container">
              <span class="table-title">Daily Accruals Breakdown ({{ dailyAccruals().length }} Days)</span>
              <table class="accrual-table" data-testid="accrual-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Eligible Balance</th>
                    <th>Daily Accrual</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of dailyAccruals()">
                    <td class="font-mono">{{ item.businessDate }}</td>
                    <td class="font-mono">{{ formatMoney(item.eligibleBalance) }}</td>
                    <td class="font-mono highlight-green">+{{ formatMoney(item.accruedAmount) }}</td>
                    <td>
                      <span class="status-pill font-mono" [class.accrued]="item.status === 'ACCRUED'">
                        {{ item.status || 'ESTIMATED' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button type="button" class="btn-cancel" (click)="handleCancel()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(11, 17, 32, 0.78);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
      }

      .modal-dialog {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 10px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        width: 100%;
        max-width: 720px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: rgba(15, 23, 42, 0.6);
        border-bottom: 1px solid var(--ble-color-border, #334155);
      }

      .header-titles {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon {
        font-size: 20px;
      }

      .title-text {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .subtitle-text {
        margin: 0;
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 16px;
        cursor: pointer;
      }

      .error-banner {
        background: rgba(239, 68, 68, 0.15);
        border-bottom: 1px solid rgba(239, 68, 68, 0.3);
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f87171;
        font-size: 12px;
      }

      .modal-body {
        padding: 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-row {
        display: flex;
        gap: 12px;
      }

      .flex-1 {
        flex: 1;
      }

      .flex-2 {
        flex: 2;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .form-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--ble-color-text-secondary, #94a3b8);
        text-transform: uppercase;
      }

      .required {
        color: #ef4444;
      }

      .form-input {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 12px;
        outline: none;
      }

      .form-input:focus {
        border-color: #3b82f6;
      }

      .action-bar {
        display: flex;
        justify-content: flex-end;
      }

      .btn-forecast {
        background: #3b82f6;
        border: none;
        color: #ffffff;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-forecast:hover:not(:disabled) {
        background: #2563eb;
      }

      .btn-forecast:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .kpi-banner {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .kpi-col {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kpi-col.highlight .kpi-val {
        color: #34d399;
        font-size: 18px;
      }

      .kpi-label {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 600;
      }

      .kpi-val {
        font-size: 15px;
        font-weight: 700;
        color: #f8fafc;
      }

      .daily-table-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .table-title {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
      }

      .accrual-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .accrual-table th {
        text-align: left;
        padding: 8px 12px;
        background: #0f172a;
        color: #94a3b8;
        font-size: 11px;
        border-bottom: 1px solid #334155;
      }

      .accrual-table td {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(51, 65, 85, 0.5);
        color: #f8fafc;
      }

      .highlight-green {
        color: #34d399;
      }

      .status-pill {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        background: rgba(148, 163, 184, 0.15);
        color: #94a3b8;
      }

      .status-pill.accrued {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }

      .modal-footer {
        padding: 12px 20px;
        border-top: 1px solid var(--ble-color-border, #334155);
        background: rgba(15, 23, 42, 0.6);
        display: flex;
        justify-content: flex-end;
      }

      .btn-cancel {
        background: transparent;
        border: 1px solid #475569;
        color: #94a3b8;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      }

      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
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
export class InterestPreviewModalComponent {
  private adminService: RuleAdminService;

  readonly isOpen = signal<boolean>(false);
  @Input('isOpen') set isOpenInput(val: boolean) {
    this.isOpen.set(val);
  }

  @Output() readonly onClose = new EventEmitter<void>();

  readonly accountId = signal<string>('');
  readonly fromDate = signal<string>('2026-09-01');
  readonly toDate = signal<string>('2026-09-30');
  readonly forecast = signal<InterestPreviewResponse | null>(null);
  readonly simulating = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly dailyAccruals = computed<DailyInterestAccrualResponse[]>(() => {
    return this.forecast()?.dailyAccruals || [];
  });

  readonly isSubmitEnabled = computed<boolean>(() => {
    return (
      this.accountId().trim().length >= 3 &&
      this.fromDate().trim().length > 0 &&
      this.toDate().trim().length > 0 &&
      !this.simulating()
    );
  });

  constructor(service?: RuleAdminService) {
    if (service) {
      this.adminService = service;
    } else {
      this.adminService = inject(RuleAdminService);
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen() && !this.simulating()) {
      this.handleCancel();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop') && !this.simulating()) {
      this.handleCancel();
    }
  }

  formatMoney(dto?: any): string {
    if (!dto) return '—';
    const curr = dto.currency || 'EUR';
    const val = Number(dto.amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${curr} ${val}`;
  }

  handleCancel(): void {
    this.error.set(null);
    this.isOpen.set(false);
    this.onClose.emit();
  }

  async runSimulation(): Promise<void> {
    if (!this.isSubmitEnabled()) return;

    this.simulating.set(true);
    this.error.set(null);

    try {
      const res = await this.adminService.simulateInterest({
        accountId: this.accountId().trim(),
        fromDate: this.fromDate(),
        toDate: this.toDate(),
      });
      this.forecast.set(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Interest simulation failed';
      this.error.set(msg);
      this.forecast.set(null);
    } finally {
      this.simulating.set(false);
    }
  }
}
