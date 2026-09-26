import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettleBatchModalComponent } from './index';
import { SettlementAdminService } from '../services/settlement-admin.service';
import type { SettlementBatchResponse } from '@ble-frontend/api-client';

describe('SettleBatchModalComponent', () => {
  let component: SettleBatchModalComponent;
  let service: SettlementAdminService;

  const mockBatch: SettlementBatchResponse = {
    id: 'batch-001',
    rail: 'SEPA',
    currency: 'EUR',
    businessDate: '2026-09-26',
    status: 'OPEN',
    totalAmount: { amount: 25000, currency: 'EUR' },
    recordCount: 15,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SettlementAdminService();
    component = new SettleBatchModalComponent(service);
  });

  it('should initialize with idle state and invalid submission without reference', () => {
    component.batch = mockBatch;
    expect(component.isValid()).toBe(false);
    expect(component.submitting()).toBe(false);
  });

  it('should validate external reference and enable submission', () => {
    component.batch = mockBatch;
    component.externalBatchReference.set('EXT-REF-001');

    expect(component.isValid()).toBe(true);
  });

  it('should execute batch settlement and emit result', async () => {
    component.batch = mockBatch;
    component.externalBatchReference.set('EXT-REF-001');
    component.settledAt.set('2026-09-26T18:00');

    const mockSettled: SettlementBatchResponse = {
      ...mockBatch,
      status: 'SETTLED',
      settledAt: '2026-09-26T18:00:00.000Z',
    };

    const settleSpy = vi.spyOn(service, 'settleBatch').mockResolvedValue(mockSettled);
    const settledSpy = vi.fn();
    component.onSettled.subscribe(settledSpy);

    await component.handleSubmit();

    expect(settleSpy).toHaveBeenCalledWith('batch-001', {
      externalBatchReference: 'EXT-REF-001',
      settledAt: expect.any(String),
    });
    expect(settledSpy).toHaveBeenCalledWith(mockSettled);
    expect(component.isOpen()).toBe(false);
  });

  it('should handle settlement error gracefully', async () => {
    component.batch = mockBatch;
    component.externalBatchReference.set('EXT-REF-FAIL');

    vi.spyOn(service, 'settleBatch').mockRejectedValue(new Error('Settlement window closed'));

    await component.handleSubmit();

    expect(component.error()).toBe('Settlement window closed');
    expect(component.submitting()).toBe(false);
  });
});
