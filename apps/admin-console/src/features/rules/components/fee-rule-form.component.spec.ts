import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeeRuleFormComponent } from './fee-rule-form.component';
import { RuleAdminService } from '../services/rule-admin.service';
import type { FeeRuleResponse } from '@ble-frontend/api-client';

describe('FeeRuleFormComponent', () => {
  let component: FeeRuleFormComponent;
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
    component = new FeeRuleFormComponent(service);
  });

  it('should initialize with default blank form state and invalid submit', () => {
    expect(component.code()).toBe('');
    expect(component.name()).toBe('');
    expect(component.currency()).toBe('EUR');
    expect(component.calculationType()).toBe('FIXED');
    expect(component.isSubmitEnabled()).toBe(false);
  });

  it('should validate rule code format (alphanumeric uppercase with underscores, >= 3 chars)', () => {
    component.code.set('trf');
    expect(component.isCodeValid()).toBe(false);

    component.code.set('TRF_EUR_STD');
    expect(component.isCodeValid()).toBe(true);
  });

  it('should validate boundary caps (minFee <= maxFee)', () => {
    component.minFee.set(10);
    component.maxFee.set(5);
    expect(component.areBoundariesValid()).toBe(false);

    component.maxFee.set(20);
    expect(component.areBoundariesValid()).toBe(true);
  });

  it('should enable submit only when all mandatory fields are valid', () => {
    component.code.set('TRF_EUR_TEST');
    component.name.set('Test Fee Rule');
    component.feeIncomeAccountId.set('acc-fee-income-01');
    component.fixedAmount.set(2.5);

    expect(component.isSubmitEnabled()).toBe(true);
  });

  it('should call createFeeRule on submit and emit onSuccess event', async () => {
    const mockCreated: FeeRuleResponse = {
      id: 'fee-100',
      code: 'TRF_EUR_TEST',
      name: 'Test Fee Rule',
      transactionType: 'TRANSFER',
      currency: 'EUR',
      calculationType: 'FIXED',
      fixedAmount: 2.5,
      feeIncomeAccountId: 'acc-fee-income-01',
      active: true,
      version: 1,
    };

    const createSpy = vi.spyOn(service, 'createFeeRule').mockResolvedValue(mockCreated);
    const successSpy = vi.fn();
    component.onSuccess.subscribe(successSpy);

    component.code.set('TRF_EUR_TEST');
    component.name.set('Test Fee Rule');
    component.feeIncomeAccountId.set('acc-fee-income-01');
    component.fixedAmount.set(2.5);

    await component.submit();

    expect(createSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith(mockCreated);
  });
});
