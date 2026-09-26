import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterestOpsModalComponent } from './interest-ops-modal.component';
import { RuleAdminService } from '../services/rule-admin.service';

describe('InterestOpsModalComponent', () => {
  let component: InterestOpsModalComponent;
  let service: RuleAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new RuleAdminService();
    component = new InterestOpsModalComponent(service);
  });

  it('should initialize with default mode ACCRUE and idle state', () => {
    expect(component.mode()).toBe('ACCRUE');
    expect(component.submitting()).toBe(false);
    expect(component.error()).toBeNull();
  });

  it('should trigger daily accrual sweep and emit success', async () => {
    const sweepSpy = vi.spyOn(service, 'triggerDailyAccrual').mockResolvedValue({
      processedAccounts: 42,
      totalAccruedAmount: { amount: 1250, currency: 'EUR' },
    } as any);

    const successSpy = vi.fn();
    component.onSuccess.subscribe(successSpy);

    component.mode.set('ACCRUE');
    await component.executeAction();

    expect(sweepSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACCRUE', count: 42 })
    );
  });

  it('should trigger interest posting and emit success', async () => {
    const postSpy = vi.spyOn(service, 'triggerInterestPosting').mockResolvedValue({
      transactionId: 'tx-post-99',
      accountId: 'acc-101',
      postedAmount: { amount: 45.2, currency: 'EUR' },
      accrualCount: 30,
    } as any);

    const successSpy = vi.fn();
    component.onSuccess.subscribe(successSpy);

    component.mode.set('POST');
    component.targetAccountId.set('acc-101');
    await component.executeAction();

    expect(postSpy).toHaveBeenCalled();
    expect(successSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'POST', count: 30 })
    );
  });
});
