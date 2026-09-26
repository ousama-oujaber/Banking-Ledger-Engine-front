import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterestPreviewModalComponent } from './index';
import { RuleAdminService } from '../services/rule-admin.service';
import type { InterestPreviewResponse } from '@ble-frontend/api-client';

describe('InterestPreviewModalComponent', () => {
  let component: InterestPreviewModalComponent;
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
    component = new InterestPreviewModalComponent(service);
  });

  it('should initialize with empty state and disabled simulate button', () => {
    expect(component.accountId()).toBe('');
    expect(component.isSubmitEnabled()).toBe(false);
  });

  it('should validate account ID and date range', () => {
    component.accountId.set('acc-101');
    component.fromDate.set('2026-09-01');
    component.toDate.set('2026-09-30');

    expect(component.isSubmitEnabled()).toBe(true);
  });

  it('should run simulation and render projected interest breakdown', async () => {
    const mockForecast: InterestPreviewResponse = {
      accountId: 'acc-101',
      ruleCode: 'SAV_EUR_HIGH_YIELD',
      totalEstimatedInterest: { amount: 35.42, currency: 'EUR' },
      dailyAccruals: [
        {
          businessDate: '2026-09-01',
          eligibleBalance: { amount: 10000, currency: 'EUR' },
          accruedAmount: { amount: 1.18, currency: 'EUR' },
          status: 'ACCRUED',
        },
      ],
    };

    const simSpy = vi.spyOn(service, 'simulateInterest').mockResolvedValue(mockForecast);

    component.accountId.set('acc-101');
    component.fromDate.set('2026-09-01');
    component.toDate.set('2026-09-30');

    await component.runSimulation();

    expect(simSpy).toHaveBeenCalledWith({
      accountId: 'acc-101',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
    });
    expect(component.forecast()).toEqual(mockForecast);
    expect(component.dailyAccruals().length).toBe(1);
  });
});
