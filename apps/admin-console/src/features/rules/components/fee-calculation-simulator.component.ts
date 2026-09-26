import { Component, signal, computed, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RuleAdminService } from '../services/rule-admin.service';
import type {
  PreviewFeeRequest,
  FeePreviewResponse,
  FeeRuleResponse,
} from '@ble-frontend/api-client';

/**
 * FeeCalculationSimulatorComponent
 *
 * Interactive real-time testing sandbox for transaction fees.
 * Allows operators to simulate fee deductions, tax calculations, and tier matches across varying amounts.
 */
@Component({
  selector: 'ble-fee-calculation-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="simulator-card" data-testid="fee-simulator-card">
      <div class="card-header">
        <div class="header-left">
          <span class="header-icon">🧮</span>
          <div class="header-titles">
            <h4 class="title-text">Fee Calculation Simulator</h4>
            <p class="subtitle-text">Test fee schedules, progressive tiers, and VAT deduction in real-time</p>
          </div>
        </div>
      </div>

      <!-- Simulator Controls Form -->
      <div class="simulator-body">
        <div class="form-grid">
          <!-- Transaction Amount -->
          <div class="form-group">
            <label class="form-label" for="sim-amount">Transaction Amount</label>
            <div class="input-with-currency">
              <input
                id="sim-amount"
                type="number"
                min="0.01"
                step="0.01"
                class="sim-input font-mono"
                [ngModel]="amount()"
                (ngModelChange)="amount.set($event)"
                data-testid="sim-amount-input"
              />
              <span class="currency-tag">{{ currency() }}</span>
            </div>
          </div>

          <!-- Currency Selector -->
          <div class="form-group">
            <label class="form-label" for="sim-currency">Currency</label>
            <select
              id="sim-currency"
              class="sim-select font-mono"
              [ngModel]="currency()"
              (ngModelChange)="currency.set($event)"
              data-testid="sim-currency-select"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="MAD">MAD (DH)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>

          <!-- Transaction Type -->
          <div class="form-group">
            <label class="form-label" for="sim-txtype">Transaction Type</label>
            <select
              id="sim-txtype"
              class="sim-select font-mono"
              [ngModel]="transactionType()"
              (ngModelChange)="transactionType.set($event)"
              data-testid="sim-txtype-select"
            >
              <option value="TRANSFER">TRANSFER</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="FX_TRANSFER">FX_TRANSFER</option>
              <option value="HOLD_CAPTURE">HOLD_CAPTURE</option>
            </select>
          </div>

          <!-- Target Rule Code -->
          <div class="form-group">
            <label class="form-label" for="sim-rulecode">Rule Code (Optional)</label>
            <input
              id="sim-rulecode"
              type="text"
              class="sim-input font-mono"
              [ngModel]="feeRuleCode()"
              (ngModelChange)="feeRuleCode.set($event.toUpperCase())"
              placeholder="e.g. TRF_EUR_STD (Blank = Default)"
              data-testid="sim-rulecode-input"
            />
          </div>
        </div>

        <!-- Simulation Action Button -->
        <div class="action-row">
          <button
            type="button"
            class="btn-simulate"
            (click)="runSimulation()"
            [disabled]="simulating() || amount() <= 0"
            data-testid="run-sim-btn"
          >
            <span *ngIf="simulating()" class="spinner"></span>
            <span>{{ simulating() ? 'Calculating...' : 'Run Fee Simulation' }}</span>
          </button>
        </div>

        <!-- Error Notification -->
        <div *ngIf="error()" class="sim-error-alert" data-testid="sim-error-alert">
          <span class="alert-icon">⚠</span>
          <span class="error-msg">{{ error() }}</span>
        </div>

        <!-- Simulation Result Card -->
        <div *ngIf="result()" class="result-breakdown" data-testid="sim-result-breakdown">
          <div class="breakdown-header">
            <span class="breakdown-title">Simulation Results Breakdown</span>
            <span class="effective-pill font-mono">
              Effective Fee: {{ formattedEffectiveRate() }}
            </span>
          </div>

          <div class="metric-tiles">
            <!-- Gross Fee Tile -->
            <div class="tile">
              <span class="tile-label">Gross Fee</span>
              <span class="tile-val gross font-mono" data-testid="gross-fee-val">
                {{ formatMoney(result()?.grossFee) }}
              </span>
              <span class="tile-sub">Base calculation</span>
            </div>

            <!-- Tax Amount Tile -->
            <div class="tile">
              <span class="tile-label">Tax / VAT</span>
              <span class="tile-val tax font-mono" data-testid="tax-fee-val">
                {{ formatMoney(result()?.taxAmount) }}
              </span>
              <span class="tile-sub">Withheld tax</span>
            </div>

            <!-- Net Total Fee Tile -->
            <div class="tile highlight">
              <span class="tile-label">Total Customer Deduction</span>
              <span class="tile-val total font-mono" data-testid="net-fee-val">
                {{ formatMoney(result()?.netFee) }}
              </span>
              <span class="tile-sub">Gross Fee + Tax</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .simulator-card {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        overflow: hidden;
      }

      .card-header {
        padding: 14px 18px;
        background: rgba(15, 23, 42, 0.6);
        border-bottom: 1px solid var(--ble-color-border, #334155);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .header-icon {
        font-size: 18px;
      }

      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .title-text {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .subtitle-text {
        margin: 0;
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .simulator-body {
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
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

      .input-with-currency {
        display: flex;
        align-items: center;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        overflow: hidden;
      }

      .input-with-currency:focus-within {
        border-color: #3b82f6;
      }

      .sim-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
      }

      .currency-tag {
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        font-weight: 700;
        font-size: 11px;
        border-left: 1px solid #334155;
      }

      .sim-select {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 6px;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 13px;
        outline: none;
      }

      .sim-select:focus {
        border-color: #3b82f6;
      }

      .action-row {
        display: flex;
        justify-content: flex-end;
      }

      .btn-simulate {
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
        transition: background-color 0.15s ease;
      }

      .btn-simulate:hover:not(:disabled) {
        background: #2563eb;
      }

      .btn-simulate:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .sim-error-alert {
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 6px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #f87171;
        font-size: 12px;
      }

      .result-breakdown {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .breakdown-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .breakdown-title {
        font-size: 12px;
        font-weight: 700;
        color: #f8fafc;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .effective-pill {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.35);
        color: #60a5fa;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }

      .metric-tiles {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }

      .tile {
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border-subtle, #1e293b);
        border-radius: 6px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .tile.highlight {
        border-color: rgba(59, 130, 246, 0.5);
        background: rgba(59, 130, 246, 0.08);
      }

      .tile-label {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 600;
      }

      .tile-val {
        font-size: 16px;
        font-weight: 700;
      }

      .tile-val.gross {
        color: #f8fafc;
      }

      .tile-val.tax {
        color: #fbbf24;
      }

      .tile-val.total {
        color: #34d399;
      }

      .tile-sub {
        font-size: 10px;
        color: #64748b;
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
export class FeeCalculationSimulatorComponent {
  private adminService: RuleAdminService;

  readonly amount = signal<number>(1000);
  readonly currency = signal<any>('EUR');
  readonly transactionType = signal<any>('TRANSFER');
  readonly feeRuleCode = signal<string>('');
  readonly result = signal<FeePreviewResponse | null>(null);
  readonly simulating = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  @Input('preselectedRuleCode') set preselectedRule(code: string | undefined) {
    if (code) {
      this.feeRuleCode.set(code);
    }
  }

  readonly formattedEffectiveRate = computed<string>(() => {
    const res = this.result();
    if (!res || res.effectiveRate === undefined) return '0.00%';
    const pct = res.effectiveRate > 1 ? res.effectiveRate : res.effectiveRate * 100;
    return `${pct.toFixed(2)}%`;
  });

  constructor(service?: RuleAdminService) {
    if (service) {
      this.adminService = service;
    } else {
      this.adminService = inject(RuleAdminService);
    }
  }

  formatMoney(dto?: any): string {
    if (!dto) return '—';
    const curr = dto.currency || this.currency();
    const val = Number(dto.amount || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${curr} ${val}`;
  }

  async runSimulation(): Promise<void> {
    if (this.amount() <= 0) return;

    this.simulating.set(true);
    this.error.set(null);

    const req: PreviewFeeRequest = {
      transactionType: this.transactionType(),
      amount: Number(this.amount()),
      currency: this.currency(),
      feeRuleCode: this.feeRuleCode().trim().length > 0 ? this.feeRuleCode().trim() : undefined,
    };

    try {
      const res = await this.adminService.simulateFee(req);
      this.result.set(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Simulation failed';
      this.error.set(msg);
      this.result.set(null);
    } finally {
      this.simulating.set(false);
    }
  }
}
