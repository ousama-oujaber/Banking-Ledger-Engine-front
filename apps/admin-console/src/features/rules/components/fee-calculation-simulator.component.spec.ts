import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeeCalculationSimulatorComponent } from './fee-calculation-simulator.component';
import { RuleAdminService } from '../services/rule-admin.service';
import type { FeePreviewResponse } from '@ble-frontend/api-client';

describe('FeeCalculationSimulatorComponent', () => {
  let component: FeeCalculationSimulatorComponent;
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
    component = new FeeCalculationSimulatorComponent(service);
  });

  it('should initialize with default parameters and empty result', () => {
    expect(component.amount()).toBe(1000);
    expect(component.currency()).toBe('EUR');
    expect(component.transactionType()).toBe('TRANSFER');
    expect(component.result()).toBeNull();
    expect(component.simulating()).toBe(false);
  });

  it('should run simulation and update result signal on success', async () => {
    const mockPreview: FeePreviewResponse = {
      feeAmount: { amount: 15.0, currency: 'EUR' },
      taxAmount: { amount: 3.0, currency: 'EUR' },
      grossAmount: { amount: 18.0, currency: 'EUR' },
      principalAmount: { amount: 5000, currency: 'EUR' },
    };

    const simSpy = vi.spyOn(service, 'simulateFee').mockResolvedValue(mockPreview);

    component.amount.set(5000);
    component.feeRuleCode.set('TRF_EUR_STD');

    await component.runSimulation();

    expect(simSpy).toHaveBeenCalledWith({
      transactionType: 'TRANSFER',
      amount: 5000,
      currency: 'EUR',
      feeRuleCode: 'TRF_EUR_STD',
    });
    expect(component.result()).toEqual(mockPreview);
    expect(component.error()).toBeNull();
  });

  it('should handle simulation error from service', async () => {
    vi.spyOn(service, 'simulateFee').mockRejectedValue(new Error('Rule not found'));

    component.amount.set(5000);
    await component.runSimulation();

    expect(component.result()).toBeNull();
    expect(component.error()).toContain('Rule not found');
  });

  it('should format effective percentage accurately', () => {
    component.amount.set(5000);
    component.result.set({
      feeAmount: { amount: 18.0, currency: 'EUR' },
      taxAmount: { amount: 3.0, currency: 'EUR' },
      grossAmount: { amount: 21.0, currency: 'EUR' },
      principalAmount: { amount: 5000, currency: 'EUR' },
    });

    expect(component.formattedEffectiveRate()).toBe('0.36%');
  });
});
