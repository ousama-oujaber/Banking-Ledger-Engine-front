import { Injectable, signal, computed } from '@angular/core';
import {
  listFeeRules,
  createFeeRule,
  getFeeRuleByCode,
  getFeeRuleByCodeAndVersion,
  previewFee,
  listRules,
  createRule,
  getRuleByCode,
  previewInterest,
  accrueInterest,
  postInterest,
  type FeeRuleResponse,
  type InterestRuleResponse,
  type CreateFeeRuleRequest,
  type CreateInterestRuleRequest,
  type PreviewFeeRequest,
  type PreviewInterestRequest,
  type FeePreviewResponse,
  type InterestPreviewResponse,
  type AccrueInterestRequest,
  type PostInterestRequest,
  type InterestPostingResponse,
  type AccrueInterestResponse2,
} from '@ble-frontend/api-client';

/**
 * RuleAdminService
 *
 * Angular 19 signals-based reactive state service managing:
 * - Fee Rule Configurations (CRUD, Tier builders, Tax deductions)
 * - Interest Rate Rules (Credit/Debit, Day count bases, Ledger/Available balance basis)
 * - Dynamic Fee & Interest Simulations
 * - Administrative Interest Accrual and Posting Operations
 */
@Injectable({
  providedIn: 'root',
})
export class RuleAdminService {
  // Reactive Signals State
  readonly feeRules = signal<FeeRuleResponse[]>([]);
  readonly interestRules = signal<InterestRuleResponse[]>([]);
  readonly loading = signal<boolean>(false);
  readonly simulating = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Simulation Results Cache
  readonly lastFeeSimulation = signal<FeePreviewResponse | null>(null);
  readonly lastInterestSimulation = signal<InterestPreviewResponse | null>(null);

  // Active Workspace Tab
  readonly activeTab = signal<'fees' | 'interest' | 'simulator'>('fees');

  // Computed Metrics
  readonly activeFeeRulesCount = computed<number>(() => {
    return this.feeRules().filter((r) => r.active !== false).length;
  });

  readonly activeInterestRulesCount = computed<number>(() => {
    return this.interestRules().filter((r) => r.active !== false).length;
  });

  readonly feeRulesByCurrency = computed<Record<string, FeeRuleResponse[]>>(() => {
    const map: Record<string, FeeRuleResponse[]> = {};
    for (const rule of this.feeRules()) {
      const curr = rule.currency || 'OTHER';
      if (!map[curr]) map[curr] = [];
      map[curr].push(rule);
    }
    return map;
  });

  // State Mutators (Testing & Local updates)
  setFeeRules(rules: FeeRuleResponse[]): void {
    this.feeRules.set([...rules]);
  }

  setInterestRules(rules: InterestRuleResponse[]): void {
    this.interestRules.set([...rules]);
  }

  // --- Fee Rules API ---

  async loadFeeRules(activeOnly = false): Promise<FeeRuleResponse[]> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await listFeeRules({ activeOnly });
      this.feeRules.set(response || []);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load fee rules';
      this.error.set(message);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async createFeeRule(request: CreateFeeRuleRequest): Promise<FeeRuleResponse> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const created = await createFeeRule({ requestBody: request });
      this.feeRules.update((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create fee rule';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getFeeRule(code: string): Promise<FeeRuleResponse | null> {
    try {
      return await getFeeRuleByCode({ code });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to lookup fee rule';
      this.error.set(message);
      return null;
    }
  }

  async getFeeRuleVersion(code: string, version: number): Promise<FeeRuleResponse | null> {
    try {
      return await getFeeRuleByCodeAndVersion({ code, version });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to audit fee rule version';
      this.error.set(message);
      return null;
    }
  }

  async simulateFee(request: PreviewFeeRequest): Promise<FeePreviewResponse> {
    this.simulating.set(true);
    this.error.set(null);
    try {
      const preview = await previewFee({ requestBody: request });
      this.lastFeeSimulation.set(preview);
      return preview;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fee calculation simulation failed';
      this.error.set(message);
      throw err;
    } finally {
      this.simulating.set(false);
    }
  }

  // --- Interest Rules API ---

  async loadInterestRules(productCode?: string, activeOnly = false): Promise<InterestRuleResponse[]> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await listRules({ productCode, activeOnly });
      this.interestRules.set(response || []);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load interest rules';
      this.error.set(message);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  async createInterestRule(request: CreateInterestRuleRequest): Promise<InterestRuleResponse> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const created = await createRule({ requestBody: request });
      this.interestRules.update((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create interest rule';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getInterestRule(code: string): Promise<InterestRuleResponse | null> {
    try {
      return await getRuleByCode({ code });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to inspect interest rule';
      this.error.set(message);
      return null;
    }
  }

  async simulateInterest(request: PreviewInterestRequest): Promise<InterestPreviewResponse> {
    this.simulating.set(true);
    this.error.set(null);
    try {
      const forecast = await previewInterest({ requestBody: request });
      this.lastInterestSimulation.set(forecast);
      return forecast;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Interest simulation failed';
      this.error.set(message);
      throw err;
    } finally {
      this.simulating.set(false);
    }
  }

  // --- Operations Triggers ---

  async triggerDailyAccrual(request?: AccrueInterestRequest): Promise<AccrueInterestResponse2> {
    this.loading.set(true);
    this.error.set(null);
    try {
      return await accrueInterest({ requestBody: request });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Daily accrual trigger failed';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async triggerInterestPosting(
    request: PostInterestRequest,
    idempotencyKey?: string,
  ): Promise<InterestPostingResponse> {
    this.loading.set(true);
    this.error.set(null);
    const key =
      idempotencyKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `post-${Date.now()}`);

    try {
      return await postInterest({
        requestBody: request,
        idempotencyKey: key,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Interest posting trigger failed';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }
}
