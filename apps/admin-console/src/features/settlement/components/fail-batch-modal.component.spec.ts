import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FailBatchModalComponent } from './index';
import { SettlementAdminService } from '../services/settlement-admin.service';
import type { SettlementBatchResponse } from '@ble-frontend/api-client';

describe('FailBatchModalComponent', () => {
  let component: FailBatchModalComponent;
  let service: SettlementAdminService;

  const mockBatch: SettlementBatchResponse = {
    id: 'batch-001',
    rail: 'SWIFT',
    currency: 'USD',
    businessDate: '2026-09-26',
    status: 'OPEN',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SettlementAdminService();
    component = new FailBatchModalComponent(service);
  });

  it('should require minimum 5 characters reason for validation', () => {
    component.batch = mockBatch;
    component.reason.set('1234');
    expect(component.isValid()).toBe(false);

    component.reason.set('Network rejection from clearing house');
    expect(component.isValid()).toBe(true);
  });

  it('should execute batch fail mutation and emit result', async () => {
    component.batch = mockBatch;
    component.reason.set('Clearing participant node unavailable');

    const mockFailed: SettlementBatchResponse = {
      ...mockBatch,
      status: 'FAILED',
    };
    const failSpy = vi.spyOn(service, 'failBatch').mockResolvedValue(mockFailed);
    const failedSpy = vi.fn();
    component.onFailed.subscribe(failedSpy);

    await component.handleSubmit();

    expect(failSpy).toHaveBeenCalledWith('batch-001', 'Clearing participant node unavailable');
    expect(failedSpy).toHaveBeenCalledWith(mockFailed);
    expect(component.isOpen()).toBe(false);
  });

  it('should handle failure mutation error gracefully', async () => {
    component.batch = mockBatch;
    component.reason.set('Internal error reason');

    vi.spyOn(service, 'failBatch').mockRejectedValue(new Error('Database write conflict'));

    await component.handleSubmit();

    expect(component.error()).toBe('Database write conflict');
    expect(component.submitting()).toBe(false);
  });
});
