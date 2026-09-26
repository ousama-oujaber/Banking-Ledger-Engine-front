import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleAdminService } from './rule-admin.service';
import type {
  FeeRuleResponse,
  InterestRuleResponse,
  CreateFeeRuleRequest,
  CreateInterestRuleRequest,
  PreviewFeeRequest,
  PreviewInterestRequest,
  FeePreviewResponse,
  InterestPreviewResponse,
} from '@ble-frontend/api-client';
import * as apiModule from '@ble-frontend/api-client';

const mockFeeRules: FeeRuleResponse[] = [
  {
    id: 'fee-001',
    code: 'TRF_EUR_STD',
    name: 'Standard EUR Transfer Fee',
    transactionType: 'TRANSFER',
    currency: 'EUR',
    calculationType: 'TIERED',
    tiers: [
      { minAmount: 0, maxAmount: 1000, feeValue: 1.5, isPercentage: false },
      { minAmount: 1000, maxAmount: 10000, feeValue: 0.15, isPercentage: true },
    ],
    minFee: 1.5,
    maxFee: 50.0,
    taxRate: 20.0,
    feeIncomeAccountId: 'acc-fee-income-01',
    active: true,
    version: 1,
    createdAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'fee-002',
    code: 'WTH_USD_FIXED',
    name: 'Fixed USD Withdrawal Fee',
    transactionType: 'WITHDRAWAL',
    currency: 'USD',
    calculationType: 'FIXED',
    fixedAmount: 5.0,
    feeIncomeAccountId: 'acc-fee-income-02',
    active: true,
    version: 1,
    createdAt: '2026-09-02T11:00:00Z',
  },
  {
    id: 'fee-003',
    code: 'DEP_GBP_PCT',
    name: 'Percentage GBP Deposit Fee',
    transactionType: 'DEPOSIT',
    currency: 'GBP',
    calculationType: 'PERCENTAGE',
    percentageRate: 0.5,
    feeIncomeAccountId: 'acc-fee-income-03',
    active: false,
    version: 2,
    createdAt: '2026-08-15T09:00:00Z',
  },
];

const mockInterestRules: InterestRuleResponse[] = [
  {
    id: 'int-001',
    code: 'SAV_EUR_HIGH_YIELD',
    productCode: 'SAVINGS_CLASSIC',
    interestType: 'CREDIT',
    annualRate: 3.25,
    accrualBasis: 'ACT_365',
    balanceBasis: 'LEDGER_BALANCE',
    minEligibleBalance: { amount: 100.0, currency: 'EUR' },
    active: true,
    version: 1,
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'int-002',
    code: 'OVD_USD_PENALTY',
    productCode: 'CLASSIC_CHECKING',
    interestType: 'DEBIT',
    annualRate: 12.0,
    accrualBasis: 'ACT_360',
    balanceBasis: 'AVAILABLE_BALANCE',
    active: false,
    version: 1,
    createdAt: '2026-09-03T14:00:00Z',
  },
];

describe('RuleAdminService (S5-T1 State Management)', () => {
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
  });

  describe('Fee Rules Management', () => {
    it('should initialize with empty fee rules and idle state', () => {
      expect(service.feeRules()).toEqual([]);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should load fee rules successfully and update signal state', async () => {
      vi.spyOn(apiModule, 'listFeeRules').mockReturnValue({
        then: (resolve: (data: FeeRuleResponse[]) => void) => {
          resolve(mockFeeRules);
          return { catch: vi.fn() };
        },
      } as any);

      await service.loadFeeRules();

      expect(service.feeRules()).toEqual(mockFeeRules);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
      expect(service.activeFeeRulesCount()).toBe(2);
    });

    it('should handle fee rules loading error', async () => {
      vi.spyOn(apiModule, 'listFeeRules').mockReturnValue({
        then: (_resolve: any, reject: (err: any) => void) => {
          reject(new Error('Network error loading fee rules'));
          return { catch: (cb: any) => cb(new Error('Network error loading fee rules')) };
        },
      } as any);

      await service.loadFeeRules();

      expect(service.feeRules()).toEqual([]);
      expect(service.error()).toContain('Network error loading fee rules');
      expect(service.loading()).toBe(false);
    });

    it('should create fee rule and prepend to signals collection', async () => {
      const newRequest: CreateFeeRuleRequest = {
        code: 'FX_EUR_USD',
        name: 'EUR to USD FX Conversion Fee',
        transactionType: 'FX_TRANSFER',
        currency: 'EUR',
        calculationType: 'FIXED',
        fixedAmount: 2.5,
        feeIncomeAccountId: 'acc-fee-income-01',
      };

      const createdResponse: FeeRuleResponse = {
        id: 'fee-004',
        ...newRequest,
        active: true,
        version: 1,
        createdAt: '2026-09-26T12:00:00Z',
      };

      vi.spyOn(apiModule, 'createFeeRule').mockReturnValue({
        then: (resolve: (data: FeeRuleResponse) => void) => {
          resolve(createdResponse);
          return { catch: vi.fn() };
        },
      } as any);

      service.setFeeRules(mockFeeRules);
      const res = await service.createFeeRule(newRequest);

      expect(res.id).toBe('fee-004');
      expect(service.feeRules()[0].code).toBe('FX_EUR_USD');
      expect(service.feeRules().length).toBe(4);
    });

    it('should simulate fee deduction and update lastFeeSimulation signal', async () => {
      const simRequest: PreviewFeeRequest = {
        transactionType: 'TRANSFER',
        amount: 2500,
        currency: 'EUR',
        feeRuleCode: 'TRF_EUR_STD',
      };

      const mockPreviewResult: FeePreviewResponse = {
        grossFee: { amount: 3.75, currency: 'EUR' },
        taxAmount: { amount: 0.75, currency: 'EUR' },
        netFee: { amount: 4.5, currency: 'EUR' },
        effectiveRate: 0.18,
      } as any;

      vi.spyOn(apiModule, 'previewFee').mockReturnValue({
        then: (resolve: (data: any) => void) => {
          resolve(mockPreviewResult);
          return { catch: vi.fn() };
        },
      } as any);

      const result = await service.simulateFee(simRequest);

      expect(result).toEqual(mockPreviewResult);
      expect(service.lastFeeSimulation()).toEqual(mockPreviewResult);
    });
  });

  describe('Interest Rules Management', () => {
    it('should load interest rules successfully and update signal state', async () => {
      vi.spyOn(apiModule, 'listRules').mockReturnValue({
        then: (resolve: (data: InterestRuleResponse[]) => void) => {
          resolve(mockInterestRules);
          return { catch: vi.fn() };
        },
      } as any);

      await service.loadInterestRules();

      expect(service.interestRules()).toEqual(mockInterestRules);
      expect(service.activeInterestRulesCount()).toBe(1);
    });

    it('should create interest rule and update signals collection', async () => {
      const newInterestReq: CreateInterestRuleRequest = {
        code: 'SAV_EUR_CORP',
        productCode: 'CORP_ESCROW',
        interestType: 'CREDIT',
        annualRate: 4.5,
        accrualBasis: 'ACT_ACT',
        balanceBasis: 'LEDGER_BALANCE',
      };

      const createdInterest: InterestRuleResponse = {
        id: 'int-003',
        ...newInterestReq,
        active: true,
        version: 1,
        createdAt: '2026-09-26T14:00:00Z',
      };

      vi.spyOn(apiModule, 'createRule').mockReturnValue({
        then: (resolve: (data: InterestRuleResponse) => void) => {
          resolve(createdInterest);
          return { catch: vi.fn() };
        },
      } as any);

      service.setInterestRules(mockInterestRules);
      const res = await service.createInterestRule(newInterestReq);

      expect(res.id).toBe('int-003');
      expect(service.interestRules()[0].code).toBe('SAV_EUR_CORP');
    });

    it('should simulate interest calculation forecast', async () => {
      const simInterestReq: PreviewInterestRequest = {
        accountId: 'acc-101',
        fromDate: '2026-09-01',
        toDate: '2026-09-30',
      };

      const mockInterestForecast: InterestPreviewResponse = {
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

      vi.spyOn(apiModule, 'previewInterest').mockReturnValue({
        then: (resolve: (data: any) => void) => {
          resolve(mockInterestForecast);
          return { catch: vi.fn() };
        },
      } as any);

      const forecast = await service.simulateInterest(simInterestReq);

      expect(forecast).toEqual(mockInterestForecast);
      expect(service.lastInterestSimulation()).toEqual(mockInterestForecast);
    });

    it('should trigger administrative daily accrual sweep', async () => {
      const accrueSpy = vi.spyOn(apiModule, 'accrueInterest').mockReturnValue({
        then: (resolve: (data: any) => void) => {
          resolve({
            accrualCount: 42,
          });
          return { catch: vi.fn() };
        },
      } as any);

      const res = await service.triggerDailyAccrual();

      expect(accrueSpy).toHaveBeenCalled();
      expect(res.accrualCount).toBe(42);
    });

    it('should trigger period interest posting run with idempotency key', async () => {
      const postSpy = vi.spyOn(apiModule, 'postInterest').mockReturnValue({
        then: (resolve: (data: any) => void) => {
          resolve({
            accrualCount: 38,
            postedAmount: { amount: 1100.0, currency: 'EUR' },
          });
          return { catch: vi.fn() };
        },
      } as any);

      const res = await service.triggerInterestPosting({
        accountId: 'acc-101',
      });

      expect(postSpy).toHaveBeenCalled();
      expect(res.accrualCount).toBe(38);
    });
  });
});
