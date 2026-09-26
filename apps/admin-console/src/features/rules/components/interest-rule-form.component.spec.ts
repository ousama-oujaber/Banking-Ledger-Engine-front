import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterestRuleFormComponent } from './interest-rule-form.component';
import { RuleAdminService } from '../services/rule-admin.service';
import type { InterestRuleResponse } from '@ble-frontend/api-client';

describe('InterestRuleFormComponent', () => {
  let component: InterestRuleFormComponent;
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
    component = new InterestRuleFormComponent(service);
  });

  it('should initialize with default parameters and disabled submit', () => {
    expect(component.code()).toBe('');
    expect(component.productCode()).toBe('SAVINGS_CLASSIC');
    expect(component.interestType()).toBe('CREDIT');
    expect(component.accrualBasis()).toBe('ACT_365');
    expect(component.balanceBasis()).toBe('LEDGER_BALANCE');
    expect(component.isSubmitEnabled()).toBe(false);
  });

  it('should validate annual rate (strictly positive, <= 100)', () => {
    component.annualRate.set(-1);
    expect(component.isRateValid()).toBe(false);

    component.annualRate.set(105);
    expect(component.isRateValid()).toBe(false);

    component.annualRate.set(3.75);
    expect(component.isRateValid()).toBe(true);
  });

  it('should enable submit when all mandatory fields are valid', () => {
    component.code.set('SAV_EUR_HIGH');
    component.productCode.set('SAVINGS_CLASSIC');
    component.annualRate.set(3.5);

    expect(component.isSubmitEnabled()).toBe(true);
  });

  it('should call createInterestRule and emit onSuccess upon submit', async () => {
    const mockCreated: InterestRuleResponse = {
      id: 'int-200',
      code: 'SAV_EUR_HIGH',
      productCode: 'SAVINGS_CLASSIC',
      interestType: 'CREDIT',
      annualRate: 3.5,
      accrualBasis: 'ACT_365',
      balanceBasis: 'LEDGER_BALANCE',
      active: true,
      version: 1,
    };

    const createSpy = vi.spyOn(service, 'createInterestRule').mockResolvedValue(mockCreated);
    const successSpy = vi.fn();
    component.onSuccess.subscribe(successSpy);

    component.code.set('SAV_EUR_HIGH');
    component.annualRate.set(3.5);

    await component.submit();

    expect(createSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith(mockCreated);
  });
});
