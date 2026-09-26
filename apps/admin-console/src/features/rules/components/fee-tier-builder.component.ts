import { Component, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { FeeTierDto } from '@ble-frontend/api-client';

/**
 * FeeTierBuilderComponent
 *
 * Interactive Angular 19 editor for multi-tier fee structures.
 * Allows administrators to construct non-overlapping amount brackets with fixed or percentage fee values.
 */
@Component({
  selector: 'ble-fee-tier-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tier-builder" data-testid="tier-builder">
      <div class="builder-header">
        <div class="header-titles">
          <span class="builder-title">Dynamic Fee Tiers</span>
          <span class="builder-subtitle"
            >Define volume-based brackets for progressive fee calculations</span
          >
        </div>
        <button type="button" class="btn-add-tier" (click)="addTier()" data-testid="add-tier-btn">
          + Add Bracket
        </button>
      </div>

      <!-- Validation Error Banner -->
      <div
        *ngIf="!isValid() && validationErrors().length > 0"
        class="tier-validation-alert"
        data-testid="tier-error-alert"
      >
        <span class="alert-icon">⚠</span>
        <ul class="error-list">
          <li *ngFor="let err of validationErrors()">{{ err }}</li>
        </ul>
      </div>

      <!-- Tiers Table / Rows -->
      <div *ngIf="tiers().length === 0" class="empty-tiers">
        <p>No tiers configured. Click "+ Add Bracket" to specify progressive rate tiers.</p>
      </div>

      <div *ngIf="tiers().length > 0" class="tiers-list">
        <div
          *ngFor="let tier of tiers(); let i = index"
          class="tier-row"
          [attr.data-testid]="'tier-row-' + i"
        >
          <div class="tier-index">Tier {{ i + 1 }}</div>

          <!-- Min Amount -->
          <div class="tier-col">
            <label class="col-label">From</label>
            <input
              type="number"
              min="0"
              step="0.01"
              class="tier-input"
              [(ngModel)]="tier.minAmount"
              (ngModelChange)="onTierModified()"
              [attr.data-testid]="'tier-min-' + i"
              placeholder="0.00"
            />
          </div>

          <!-- Max Amount -->
          <div class="tier-col">
            <label class="col-label">To (Optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              class="tier-input"
              [(ngModel)]="tier.maxAmount"
              (ngModelChange)="onTierModified()"
              [attr.data-testid]="'tier-max-' + i"
              placeholder="Unbounded (∞)"
            />
          </div>

          <!-- Value Type Toggle (Fixed vs Percentage) -->
          <div class="tier-col-type">
            <label class="col-label">Type</label>
            <div class="type-toggle-group">
              <button
                type="button"
                class="toggle-btn"
                [class.active]="!tier.isPercentage"
                (click)="togglePercentage(i, false)"
                title="Fixed Amount"
              >
                Fixed
              </button>
              <button
                type="button"
                class="toggle-btn"
                [class.active]="tier.isPercentage"
                (click)="togglePercentage(i, true)"
                title="Percentage Rate"
              >
                %
              </button>
            </div>
          </div>

          <!-- Fee Value -->
          <div class="tier-col">
            <label class="col-label">
              {{ tier.isPercentage ? 'Rate (%)' : 'Fee Amount' }}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              class="tier-input"
              [(ngModel)]="tier.feeValue"
              (ngModelChange)="onTierModified()"
              [attr.data-testid]="'tier-value-' + i"
              placeholder="0.00"
            />
          </div>

          <!-- Delete Action -->
          <div class="tier-col-action">
            <label class="col-label">&nbsp;</label>
            <button
              type="button"
              class="btn-remove-tier"
              (click)="removeTier(i)"
              [attr.data-testid]="'tier-remove-' + i"
              title="Remove bracket"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .tier-builder {
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--ble-color-border, #334155);
        border-radius: 8px;
        padding: 14px;
      }

      .builder-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .header-titles {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .builder-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--ble-color-text-primary, #f8fafc);
      }

      .builder-subtitle {
        font-size: 11px;
        color: var(--ble-color-text-muted, #64748b);
      }

      .btn-add-tier {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.4);
        color: #60a5fa;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-add-tier:hover {
        background: rgba(59, 130, 246, 0.25);
        border-color: #3b82f6;
      }

      .tier-validation-alert {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.35);
        border-radius: 6px;
        padding: 8px 12px;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: #f87171;
        font-size: 11px;
      }

      .error-list {
        margin: 0;
        padding-left: 16px;
      }

      .empty-tiers {
        text-align: center;
        padding: 16px;
        color: var(--ble-color-text-muted, #64748b);
        font-size: 12px;
        font-style: italic;
      }

      .tiers-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .tier-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--ble-color-surface, #1e293b);
        border: 1px solid var(--ble-color-border-subtle, #1e293b);
        border-radius: 6px;
        padding: 8px 10px;
      }

      .tier-index {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
        width: 48px;
      }

      .tier-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .tier-col-type {
        width: 80px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .tier-col-action {
        width: 32px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .col-label {
        font-size: 10px;
        color: var(--ble-color-text-secondary, #94a3b8);
        text-transform: uppercase;
        font-weight: 600;
      }

      .tier-input {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 4px;
        color: #f8fafc;
        padding: 5px 8px;
        font-size: 12px;
        font-family: var(--ble-font-family-mono, monospace);
        outline: none;
        width: 100%;
      }

      .tier-input:focus {
        border-color: #3b82f6;
      }

      .type-toggle-group {
        display: flex;
        border: 1px solid #334155;
        border-radius: 4px;
        overflow: hidden;
      }

      .toggle-btn {
        flex: 1;
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 11px;
        padding: 4px 6px;
        cursor: pointer;
        text-align: center;
      }

      .toggle-btn.active {
        background: #3b82f6;
        color: #ffffff;
        font-weight: 600;
      }

      .btn-remove-tier {
        background: transparent;
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
        border-radius: 4px;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-remove-tier:hover {
        background: rgba(239, 68, 68, 0.2);
      }
    `,
  ],
})
export class FeeTierBuilderComponent {
  readonly tiers = signal<FeeTierDto[]>([]);

  @Input('tiers') set tiersInput(val: FeeTierDto[] | undefined) {
    if (val) {
      this.tiers.set([...val]);
    }
  }

  @Output() readonly tiersChange = new EventEmitter<FeeTierDto[]>();

  // Validation Computeds
  readonly validationErrors = computed<string[]>(() => {
    const errors: string[] = [];
    const list = this.tiers();

    for (let i = 0; i < list.length; i++) {
      const tier = list[i];
      if (tier.minAmount < 0) {
        errors.push(`Tier ${i + 1}: Minimum amount cannot be negative.`);
      }
      if (tier.maxAmount !== undefined && tier.maxAmount !== null) {
        if (Number(tier.maxAmount) <= Number(tier.minAmount)) {
          errors.push(
            `Tier ${i + 1}: Upper bound (${tier.maxAmount}) must be strictly greater than lower bound (${tier.minAmount}).`,
          );
        }
      }
      if (tier.feeValue < 0) {
        errors.push(`Tier ${i + 1}: Fee value cannot be negative.`);
      }
      if (tier.isPercentage && tier.feeValue > 100) {
        errors.push(`Tier ${i + 1}: Percentage rate cannot exceed 100%.`);
      }
    }

    return errors;
  });

  readonly isValid = computed<boolean>(() => {
    return this.validationErrors().length === 0;
  });

  setTiers(t: FeeTierDto[]): void {
    this.tiers.set([...t]);
    this.tiersChange.emit(this.tiers());
  }

  addTier(): void {
    const list = this.tiers();
    let nextMin = 0;
    if (list.length > 0) {
      const last = list[list.length - 1];
      nextMin =
        last.maxAmount !== undefined && last.maxAmount !== null
          ? Number(last.maxAmount)
          : Number(last.minAmount) + 1000;
    }

    const newTier: FeeTierDto = {
      minAmount: nextMin,
      maxAmount: undefined,
      feeValue: 0,
      isPercentage: false,
    };

    this.tiers.update((prev) => [...prev, newTier]);
    this.tiersChange.emit(this.tiers());
  }

  removeTier(index: number): void {
    this.tiers.update((prev) => prev.filter((_, i) => i !== index));
    this.tiersChange.emit(this.tiers());
  }

  togglePercentage(index: number, isPct: boolean): void {
    this.tiers.update((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], isPercentage: isPct };
      }
      return copy;
    });
    this.tiersChange.emit(this.tiers());
  }

  onTierModified(): void {
    this.tiersChange.emit(this.tiers());
  }
}
