import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResolveCaseModalComponent } from './resolve-case-modal.component';
import type { ReconciliationCaseResponse } from '@ble-frontend/api-client';

describe('ResolveCaseModalComponent', () => {
  let component: ResolveCaseModalComponent;
  let mockReconService: any;

  const mockCase: ReconciliationCaseResponse = {
    id: 'case-909',
    jobId: 'job-101',
    discrepancyType: 'AMOUNT_MISMATCH',
    status: 'OPEN',
    discrepancyAmount: 75.0,
    currency: 'EUR',
  };

  beforeEach(() => {
    mockReconService = {
      resolveCase: vi.fn(),
    };
    component = new ResolveCaseModalComponent(mockReconService);
  });

  it('should initialize closed with default form states', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.resolutionAction()).toBe('RESOLVE');
    expect(component.operator()).toBe('admin-operator');
    expect(component.notes()).toBe('');
    expect(component.isValid()).toBe(false);
  });

  it('should validate form based on action, operator, and notes length', () => {
    component.notes.set('abc');
    expect(component.isValid()).toBe(false);

    component.notes.set('Valid justification for ledger match');
    expect(component.isValid()).toBe(true);

    component.operator.set('');
    expect(component.isValid()).toBe(false);
  });

  it('should successfully submit resolution and emit resolved event', async () => {
    const resolvedResult: ReconciliationCaseResponse = {
      ...mockCase,
      status: 'RESOLVED',
      resolutionAction: 'FORCE_ADJUST',
    };
    mockReconService.resolveCase.mockResolvedValue(resolvedResult);
    const resolvedSpy = vi.spyOn(component.resolved, 'emit');

    component.open = true;
    component.caseItem = mockCase;
    component.resolutionAction.set('FORCE_ADJUST');
    component.compensatingTransactionId.set('TX-ADJ-001');
    component.operator.set('admin-test');
    component.notes.set('Resolved with compensating posting');

    await component.handleSubmit();

    expect(mockReconService.resolveCase).toHaveBeenCalledWith('case-909', {
      resolutionAction: 'FORCE_ADJUST',
      compensatingTransactionId: 'TX-ADJ-001',
      operator: 'admin-test',
      notes: 'Resolved with compensating posting',
    });
    expect(resolvedSpy).toHaveBeenCalledWith(resolvedResult);
    expect(component.isOpen()).toBe(false);
    expect(component.submitting()).toBe(false);
  });

  it('should capture and display errors if resolution fails', async () => {
    mockReconService.resolveCase.mockRejectedValue(new Error('Validation invariant violated'));

    component.open = true;
    component.caseItem = mockCase;
    component.notes.set('Proper notes for resolution');

    await component.handleSubmit();

    expect(component.error()).toBe('Validation invariant violated');
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
