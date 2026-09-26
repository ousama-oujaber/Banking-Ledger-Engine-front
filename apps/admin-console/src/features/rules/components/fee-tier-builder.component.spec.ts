import { describe, it, expect, beforeEach } from 'vitest';
import { FeeTierBuilderComponent } from './fee-tier-builder.component';
import type { FeeTierDto } from '@ble-frontend/api-client';

describe('FeeTierBuilderComponent', () => {
  let component: FeeTierBuilderComponent;

  beforeEach(() => {
    component = new FeeTierBuilderComponent();
  });

  it('should initialize with default empty tiers if none provided', () => {
    expect(component.tiers()).toEqual([]);
    expect(component.isValid()).toBe(true);
  });

  it('should add a new tier with sequential minAmount based on preceding tier', () => {
    const initialTiers: FeeTierDto[] = [
      { minAmount: 0, maxAmount: 1000, feeValue: 2.0, isPercentage: false },
    ];
    component.setTiers(initialTiers);
    component.addTier();

    const tiers = component.tiers();
    expect(tiers.length).toBe(2);
    expect(tiers[1].minAmount).toBe(1000);
    expect(tiers[1].feeValue).toBe(0);
  });

  it('should remove a tier by index and emit updated tiers', () => {
    const initialTiers: FeeTierDto[] = [
      { minAmount: 0, maxAmount: 1000, feeValue: 2.0, isPercentage: false },
      { minAmount: 1000, maxAmount: 5000, feeValue: 5.0, isPercentage: false },
    ];
    component.setTiers(initialTiers);
    component.removeTier(0);

    expect(component.tiers().length).toBe(1);
    expect(component.tiers()[0].minAmount).toBe(1000);
  });

  it('should validate tier intervals and detect invalid bounds (min >= max)', () => {
    const invalidTiers: FeeTierDto[] = [
      { minAmount: 500, maxAmount: 100, feeValue: 1.0, isPercentage: false },
    ];
    component.setTiers(invalidTiers);

    expect(component.isValid()).toBe(false);
    expect(component.validationErrors().length).toBeGreaterThan(0);
  });

  it('should toggle fee value between fixed amount and percentage rate', () => {
    const initialTiers: FeeTierDto[] = [
      { minAmount: 0, maxAmount: 1000, feeValue: 1.5, isPercentage: false },
    ];
    component.setTiers(initialTiers);
    component.togglePercentage(0, true);

    expect(component.tiers()[0].isPercentage).toBe(true);
  });
});
