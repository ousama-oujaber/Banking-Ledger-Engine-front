import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettlementBatchDashboardComponent } from './index';
import { SettlementAdminService } from './services/settlement-admin.service';
import type { SettlementBatchResponse } from '@ble-frontend/api-client';

describe('SettlementBatchDashboardComponent', () => {
  let component: SettlementBatchDashboardComponent;
  let service: SettlementAdminService;

  const mockBatches: SettlementBatchResponse[] = [
    {
      id: 'batch-001',
      rail: 'SEPA',
      currency: 'EUR',
      businessDate: '2026-09-26',
      status: 'OPEN',
      totalAmount: { amount: 15000, currency: 'EUR' },
      recordCount: 12,
    },
    {
      id: 'batch-002',
      rail: 'ACH',
      currency: 'USD',
      businessDate: '2026-09-26',
      status: 'SETTLED',
      totalAmount: { amount: 45000, currency: 'USD' },
      recordCount: 30,
    },
    {
      id: 'batch-003',
      rail: 'SWIFT',
      currency: 'USD',
      businessDate: '2026-09-25',
      status: 'FAILED',
      totalAmount: { amount: 20000, currency: 'USD' },
      recordCount: 5,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SettlementAdminService();
    component = new SettlementBatchDashboardComponent(service);
  });

  it('should initialize and load batches on ngOnInit', () => {
    const loadSpy = vi.spyOn(service, 'loadBatches').mockResolvedValue();

    component.ngOnInit();

    expect(loadSpy).toHaveBeenCalled();
  });

  it('should compute batches and KPI summary from service', () => {
    service.batches.set(mockBatches);

    expect(component.batches().length).toBe(3);
    const kpi = component.kpi();
    expect(kpi.totalCount).toBe(3);
    expect(kpi.openCount).toBe(1);
    expect(kpi.settledCount).toBe(1);
    expect(kpi.failedCount).toBe(1);
  });

  it('should evaluate action permissions based on batch status', () => {
    const openBatch = mockBatches[0];
    const settledBatch = mockBatches[1];
    const failedBatch = mockBatches[2];

    expect(component.canSettleBatch(openBatch)).toBe(true);
    expect(component.canFailBatch(openBatch)).toBe(true);
    expect(component.canCloseBatch(openBatch)).toBe(false);

    expect(component.canSettleBatch(settledBatch)).toBe(false);
    expect(component.canFailBatch(settledBatch)).toBe(false);
    expect(component.canCloseBatch(settledBatch)).toBe(true);

    expect(component.canSettleBatch(failedBatch)).toBe(false);
    expect(component.canFailBatch(failedBatch)).toBe(false);
    expect(component.canCloseBatch(failedBatch)).toBe(false);
  });

  it('should open create modal, settle modal, fail modal, and records drawer', () => {
    const batch = mockBatches[0];

    component.openCreateModal();
    expect(component.isCreateModalOpen()).toBe(true);

    component.openSettleModal(batch);
    expect(component.isSettleModalOpen()).toBe(true);
    expect(component.selectedBatchForAction()?.id).toBe('batch-001');

    component.openFailModal(batch);
    expect(component.isFailModalOpen()).toBe(true);

    component.openInspectionDrawer(batch);
    expect(component.isDrawerOpen()).toBe(true);
  });

  it('should execute closeBatch on settled batch and display toast feedback', async () => {
    const closeSpy = vi.spyOn(service, 'closeBatch').mockResolvedValue({
      ...mockBatches[1],
      status: 'CLOSED',
    });

    await component.closeBatch(mockBatches[1]);

    expect(closeSpy).toHaveBeenCalledWith('batch-002');
    expect(component.toastMessage()).toContain('Batch batch-002 marked as CLOSED');
  });

  it('should handle callback events from child modals with toast notification', () => {
    component.handleBatchCreated(mockBatches[0]);
    expect(component.toastMessage()).toContain('created successfully');

    component.handleBatchSettled(mockBatches[0]);
    expect(component.toastMessage()).toContain('settled successfully');

    component.handleBatchFailed(mockBatches[0]);
    expect(component.toastMessage()).toContain('marked as FAILED');
  });
});
