import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RulesMatrixComponent } from './rules-matrix.component';
import { RuleAdminService } from './services/rule-admin.service';
import type { FeeRuleResponse, InterestRuleResponse } from '@ble-frontend/api-client';

const mockFeeRules: FeeRuleResponse[] = [
  {
    id: 'fee-001',
    code: 'TRF_EUR_STD',
    name: 'Standard EUR Transfer',
    transactionType: 'TRANSFER',
    currency: 'EUR',
    calculationType: 'TIERED',
    active: true,
    version: 1,
  },
  {
    id: 'fee-002',
    code: 'WTH_USD_FIX',
    name: 'Fixed USD Withdrawal',
    transactionType: 'WITHDRAWAL',
    currency: 'USD',
    calculationType: 'FIXED',
    fixedAmount: 5.0,
    active: true,
    version: 1,
  },
];

const mockInterestRules: InterestRuleResponse[] = [
  {
    id: 'int-001',
    code: 'SAV_EUR_HIGH',
    productCode: 'SAVINGS_CLASSIC',
    interestType: 'CREDIT',
    annualRate: 3.25,
    accrualBasis: 'ACT_365',
    balanceBasis: 'LEDGER_BALANCE',
    active: true,
    version: 1,
  },
];

describe('RulesMatrixComponent (S5-T1 Workspace)', () => {
  let component: RulesMatrixComponent;
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
    service.setFeeRules(mockFeeRules);
    service.setInterestRules(mockInterestRules);
    component = new RulesMatrixComponent(service);
  });

  it('should initialize with Fee Rules tab active and render rules metrics', () => {
    expect(component.activeTab()).toBe('fees');
    expect(component.feeRules().length).toBe(2);
    expect(component.interestRules().length).toBe(1);
    expect(component.activeFeeCount()).toBe(2);
    expect(component.activeInterestCount()).toBe(1);
  });

  it('should switch tabs between fees, interest, and simulator', () => {
    component.switchTab('interest');
    expect(component.activeTab()).toBe('interest');

    component.switchTab('simulator');
    expect(component.activeTab()).toBe('simulator');
  });

  it('should filter rules by text search query', () => {
    component.searchQuery.set('withdraw');
    expect(component.filteredFeeRules().length).toBe(1);
    expect(component.filteredFeeRules()[0].code).toBe('WTH_USD_FIX');

    component.searchQuery.set('SAV_EUR');
    expect(component.filteredInterestRules().length).toBe(1);
  });

  it('should open and close modals for fee creation and interest ops', () => {
    component.openFeeModal();
    expect(component.isFeeModalOpen()).toBe(true);

    component.closeFeeModal();
    expect(component.isFeeModalOpen()).toBe(false);

    component.openInterestModal();
    expect(component.isInterestModalOpen()).toBe(true);

    component.openInterestOpsModal('ACCRUE');
    expect(component.isOpsModalOpen()).toBe(true);
    expect(component.opsMode()).toBe('ACCRUE');
  });

  it('should handle fee rule creation success and display notification toast', () => {
    component.onFeeRuleCreated(mockFeeRules[0]);
    expect(component.successMessage()).toContain('TRF_EUR_STD');
  });

  it('should handle interest ops success and display notification toast', () => {
    component.onInterestOpsSuccess({ action: 'ACCRUE', count: 42 });
    expect(component.successMessage()).toContain('42 accounts');
  });
});
