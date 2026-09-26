import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationCaseDrawerComponent } from './reconciliation-case-drawer.component';
import type { ReconciliationCaseResponse } from '@ble-frontend/api-client';

describe('ReconciliationCaseDrawerComponent', () => {
  let component: ReconciliationCaseDrawerComponent;
  let mockReconService: any;

  const mockCase: ReconciliationCaseResponse = {
    id: 'case-001',
    jobId: 'job-501',
    discrepancyType: 'AMOUNT_MISMATCH',
    status: 'OPEN',
    externalTransactionId: 'EXT-999',
    internalTransactionId: 'INT-888',
    discrepancyAmount: 450.0,
    currency: 'EUR',
    assignedTo: 'operator-1',
    notes: 'Ledger discrepancy detected during EOD run',
    auditHistory: [
      {
        id: 'hist-1',
        fromStatus: 'INITIAL',
        toStatus: 'OPEN',
        action: 'DETECTED',
        changedBy: 'system',
        timestamp: '2026-09-26T10:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    mockReconService = {
      error: vi.fn().mockReturnValue(null),
    };
    component = new ReconciliationCaseDrawerComponent(mockReconService);
  });

  it('should initialize with drawer closed and null target case', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.targetCase()).toBeNull();
  });

  it('should accept inputs and compute history items and action availability', () => {
    component.open = true;
    component.caseItem = mockCase;

    expect(component.isOpen()).toBe(true);
    expect(component.targetCase()).toEqual(mockCase);
    expect(component.historyItems().length).toBe(1);
    expect(component.canTakeAction()).toBe(true);
  });

  it('should not allow actions if case is already resolved', () => {
    component.open = true;
    component.caseItem = { ...mockCase, status: 'RESOLVED' };

    expect(component.canTakeAction()).toBe(false);
  });

  it('should emit closed event on handleClose and onEscape', () => {
    const closedSpy = vi.spyOn(component.closed, 'emit');
    component.open = true;

    component.handleClose();
    expect(component.isOpen()).toBe(false);
    expect(closedSpy).toHaveBeenCalled();

    component.open = true;
    component.onEscape();
    expect(component.isOpen()).toBe(false);
  });

  it('should emit resolveRequested with target case when onResolveClick is called', () => {
    const resolveSpy = vi.spyOn(component.resolveRequested, 'emit');
    component.caseItem = mockCase;

    component.onResolveClick();
    expect(resolveSpy).toHaveBeenCalledWith(mockCase);
  });

  it('should emit escalateRequested with target case when onEscalateClick is called', () => {
    const escalateSpy = vi.spyOn(component.escalateRequested, 'emit');
    component.caseItem = mockCase;

    component.onEscalateClick();
    expect(escalateSpy).toHaveBeenCalledWith(mockCase);
  });
});
