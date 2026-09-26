import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateBatchModalComponent } from './index';
import { SettlementAdminService } from '../services/settlement-admin.service';
import type { SettlementBatchResponse } from '@ble-frontend/api-client';

describe('CreateBatchModalComponent', () => {
  let component: CreateBatchModalComponent;
  let service: SettlementAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SettlementAdminService();
    component = new CreateBatchModalComponent(service);
  });

  it('should initialize with default rail SEPA and currency EUR', () => {
    expect(component.rail()).toBe('SEPA');
    expect(component.currency()).toBe('EUR');
    expect(component.submitting()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.isValid()).toBe(true);
  });

  it('should regenerate idempotency key with UUID v4', () => {
    const key1 = component.idempotencyKey();
    component.regenerateIdempotencyKey();
    const key2 = component.idempotencyKey();

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1).not.toBe(key2);
  });

  it('should submit valid batch creation payload and emit created batch', async () => {
    const mockCreated: SettlementBatchResponse = {
      id: 'batch-new-01',
      rail: 'SEPA',
      currency: 'EUR',
      businessDate: '2026-09-26',
      status: 'OPEN',
    };
    const createSpy = vi.spyOn(service, 'createBatch').mockResolvedValue(mockCreated);
    const createdSpy = vi.fn();
    component.onCreated.subscribe(createdSpy);

    component.rail.set('SEPA');
    component.currency.set('EUR');
    component.businessDate.set('2026-09-26');

    await component.handleSubmit();

    expect(createSpy).toHaveBeenCalledWith({
      rail: 'SEPA',
      currency: 'EUR',
      businessDate: '2026-09-26',
    });
    expect(createdSpy).toHaveBeenCalledWith(mockCreated);
    expect(component.isOpen()).toBe(false);
  });

  it('should handle creation failure and set error signal', async () => {
    vi.spyOn(service, 'createBatch').mockRejectedValue(new Error('Clearing rail unavailable'));

    await component.handleSubmit();

    expect(component.error()).toBe('Clearing rail unavailable');
    expect(component.submitting()).toBe(false);
  });
});
