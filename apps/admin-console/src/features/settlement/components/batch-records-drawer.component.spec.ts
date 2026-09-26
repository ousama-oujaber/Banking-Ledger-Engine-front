import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchRecordsDrawerComponent } from './index';
import { SettlementAdminService } from '../services/settlement-admin.service';
import type { SettlementBatchResponse, SettlementRecordResponse } from '@ble-frontend/api-client';

describe('BatchRecordsDrawerComponent', () => {
  let component: BatchRecordsDrawerComponent;
  let service: SettlementAdminService;

  const mockBatch: SettlementBatchResponse = {
    id: 'batch-001',
    rail: 'SEPA',
    currency: 'EUR',
    businessDate: '2026-09-26',
    status: 'OPEN',
    totalAmount: { amount: 3000, currency: 'EUR' },
    recordCount: 3,
  };

  const mockRecords: SettlementRecordResponse[] = [
    {
      id: 'rec-01',
      batchId: 'batch-001',
      transactionId: 'tx-01',
      amount: { amount: 1500, currency: 'EUR' },
      status: 'PENDING',
    },
    {
      id: 'rec-02',
      batchId: 'batch-001',
      transactionId: 'tx-02',
      amount: { amount: -500, currency: 'EUR' },
      status: 'SETTLED',
    },
    {
      id: 'rec-03',
      batchId: 'batch-001',
      transactionId: 'tx-03',
      amount: { amount: 2000, currency: 'EUR' },
      status: 'FAILED',
      failureReason: 'Account invalid',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SettlementAdminService();
    component = new BatchRecordsDrawerComponent(service);
  });

  it('should initialize and compute canSettle and canFail flags for OPEN batch', () => {
    component.batch = mockBatch;

    expect(component.canSettle()).toBe(true);
    expect(component.canFail()).toBe(true);
    expect(component.canClose()).toBe(false);
  });

  it('should compute canClose flag for SETTLED batch', () => {
    component.batch = { ...mockBatch, status: 'SETTLED' };

    expect(component.canSettle()).toBe(false);
    expect(component.canFail()).toBe(false);
    expect(component.canClose()).toBe(true);
  });

  it('should load records on open', async () => {
    const loadSpy = vi.spyOn(service, 'loadBatchDetails').mockResolvedValue();

    component.batch = mockBatch;
    component.open = true;

    expect(loadSpy).toHaveBeenCalledWith('batch-001');
    expect(component.isOpen()).toBe(true);
  });

  it('should trigger retry on failed record', async () => {
    component.batch = mockBatch;
    service.batchRecords.set(mockRecords);

    const retrySpy = vi.spyOn(service, 'retryRecord').mockResolvedValue({
      id: 'rec-03',
      status: 'PENDING',
    });

    await component.retryRecord(mockRecords[2]);

    expect(retrySpy).toHaveBeenCalledWith('rec-03', 'batch-001');
    expect(component.toastMessage()).toContain('queued for retry');
  });

  it('should emit action triggers for settle, fail, and close', () => {
    component.batch = mockBatch;

    const settleSpy = vi.fn();
    const failSpy = vi.fn();
    const closeSpy = vi.fn();

    component.onTriggerSettle.subscribe(settleSpy);
    component.onTriggerFail.subscribe(failSpy);
    component.onTriggerClose.subscribe(closeSpy);

    component.triggerSettle();
    expect(settleSpy).toHaveBeenCalledWith(mockBatch);

    component.triggerFail();
    expect(failSpy).toHaveBeenCalledWith(mockBatch);

    component.triggerClose();
    expect(closeSpy).toHaveBeenCalledWith(mockBatch);
  });
});
