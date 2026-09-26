import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EscalateCaseModalComponent } from './escalate-case-modal.component';
import type { ReconciliationCaseResponse } from '@ble-frontend/api-client';

describe('EscalateCaseModalComponent', () => {
  let component: EscalateCaseModalComponent;
  let mockReconService: any;

  const mockCase: ReconciliationCaseResponse = {
    id: 'case-esc-1',
    jobId: 'job-999',
    discrepancyType: 'MISSING_INTERNAL',
    status: 'OPEN',
    discrepancyAmount: 12500.0,
    currency: 'USD',
  };

  beforeEach(() => {
    mockReconService = {
      escalateCase: vi.fn(),
    };
    component = new EscalateCaseModalComponent(mockReconService);
  });

  it('should initialize closed and invalid until reason is populated', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.operator()).toBe('admin-operator');
    expect(component.reason()).toBe('');
    expect(component.isValid()).toBe(false);
  });

  it('should validate reason length >= 5 chars', () => {
    component.reason.set('no');
    expect(component.isValid()).toBe(false);

    component.reason.set('Material amount threshold exceeded');
    expect(component.isValid()).toBe(true);
  });

  it('should submit escalation request and emit escalated event', async () => {
    const escalatedResult: ReconciliationCaseResponse = {
      ...mockCase,
      status: 'ESCALATED',
    };
    mockReconService.escalateCase.mockResolvedValue(escalatedResult);
    const escalatedSpy = vi.spyOn(component.escalated, 'emit');

    component.open = true;
    component.caseItem = mockCase;
    component.operator.set('compliance-officer');
    component.reason.set('Requires supervisor approval for missing ledger booking');

    await component.handleSubmit();

    expect(mockReconService.escalateCase).toHaveBeenCalledWith('case-esc-1', {
      operator: 'compliance-officer',
      reason: 'Requires supervisor approval for missing ledger booking',
    });
    expect(escalatedSpy).toHaveBeenCalledWith(escalatedResult);
    expect(component.isOpen()).toBe(false);
  });

  it('should handle escalation error gracefully', async () => {
    mockReconService.escalateCase.mockRejectedValue(new Error('Case cannot be escalated'));

    component.open = true;
    component.caseItem = mockCase;
    component.reason.set('Material difference check');

    await component.handleSubmit();

    expect(component.error()).toBe('Case cannot be escalated');
    expect(component.submitting()).toBe(false);
    expect(component.isOpen()).toBe(true);
  });

  it('should emit cancelled and reset on handleCancel', () => {
    const cancelSpy = vi.spyOn(component.cancelled, 'emit');
    component.open = true;

    component.handleCancel();

    expect(cancelSpy).toHaveBeenCalled();
    expect(component.isOpen()).toBe(false);
  });
});
