import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettlementAdminService } from './index';
import * as api from '@ble-frontend/api-client';
import type { SettlementBatchResponse, SettlementRecordResponse } from '@ble-frontend/api-client';

describe('SettlementAdminService', () => {
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
      externalBatchReference: 'SEPA-20260926-01',
    },
    {
      id: 'batch-002',
      rail: 'ACH',
      currency: 'USD',
      businessDate: '2026-09-26',
      status: 'SETTLED',
      totalAmount: { amount: 45000, currency: 'USD' },
      recordCount: 30,
      externalBatchReference: 'ACH-20260926-02',
    },
    {
      id: 'batch-003',
      rail: 'SWIFT',
      currency: 'USD',
      businessDate: '2026-09-25',
      status: 'FAILED',
      totalAmount: { amount: 20000, currency: 'USD' },
      recordCount: 5,
      externalBatchReference: 'SWIFT-20260925-01',
    },
  ];

  const mockRecords: SettlementRecordResponse[] = [
    {
      id: 'rec-101',
      batchId: 'batch-001',
      transactionId: 'tx-101',
      rail: 'SEPA',
      amount: { amount: 500, currency: 'EUR' },
      status: 'PENDING',
      retryCount: 0,
    },
    {
      id: 'rec-102',
      batchId: 'batch-001',
      transactionId: 'tx-102',
      rail: 'SEPA',
      amount: { amount: -200, currency: 'EUR' },
      status: 'SETTLED',
      retryCount: 0,
    },
    {
      id: 'rec-103',
      batchId: 'batch-001',
      transactionId: 'tx-103',
      rail: 'SEPA',
      amount: { amount: 1000, currency: 'EUR' },
      status: 'FAILED',
      failureReason: 'Account closed at recipient bank',
      retryCount: 1,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SettlementAdminService();
  });

  it('should initialize with default empty state and filter parameters', () => {
    expect(service.batches()).toEqual([]);
    expect(service.selectedBatch()).toBeNull();
    expect(service.batchRecords()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.recordsLoading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.railFilter()).toBe('ALL');
    expect(service.statusFilter()).toBe('ALL');
    expect(service.searchQuery()).toBe('');
  });

  it('should load batches and update reactive state on success', async () => {
    vi.spyOn(api, 'listBatches').mockResolvedValue(mockBatches as any);

    await service.loadBatches('SEPA', 'OPEN');

    expect(api.listBatches).toHaveBeenCalledWith({ rail: 'SEPA', status: 'OPEN' });
    expect(service.batches().length).toBe(3);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('should handle error when loading batches fails', async () => {
    vi.spyOn(api, 'listBatches').mockRejectedValue(new Error('Network error'));

    await service.loadBatches();

    expect(service.batches()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('Network error');
  });

  it('should filter batches by rail, status, and query correctly', () => {
    service.batches.set(mockBatches);

    // Initial unfiltered
    expect(service.filteredBatches().length).toBe(3);

    // Filter by Rail
    service.railFilter.set('SEPA');
    expect(service.filteredBatches().length).toBe(1);
    expect(service.filteredBatches()[0].id).toBe('batch-001');

    // Filter by Status
    service.railFilter.set('ALL');
    service.statusFilter.set('SETTLED');
    expect(service.filteredBatches().length).toBe(1);
    expect(service.filteredBatches()[0].id).toBe('batch-002');

    // Filter by Query
    service.statusFilter.set('ALL');
    service.searchQuery.set('swift');
    expect(service.filteredBatches().length).toBe(1);
    expect(service.filteredBatches()[0].id).toBe('batch-003');
  });

  it('should compute KPI summary statistics accurately', () => {
    service.batches.set(mockBatches);

    const kpi = service.kpiSummary();
    expect(kpi.totalCount).toBe(3);
    expect(kpi.openCount).toBe(1);
    expect(kpi.settledCount).toBe(1);
    expect(kpi.failedCount).toBe(1);
    expect(kpi.totalSettledAmount).toBe(45000);
  });

  it('should compute selected batch records summary accurately', () => {
    service.batchRecords.set(mockRecords);

    const summary = service.selectedBatchRecordsSummary();
    expect(summary.recordCount).toBe(3);
    expect(summary.pendingCount).toBe(1);
    expect(summary.settledCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.totalGrossDebit).toBe(200);
    expect(summary.totalGrossCredit).toBe(1500);
    expect(summary.netDelta).toBe(1300);
  });

  it('should load batch details and records', async () => {
    vi.spyOn(api, 'getBatch').mockResolvedValue(mockBatches[0] as any);
    vi.spyOn(api, 'listBatchRecords').mockResolvedValue(mockRecords as any);

    await service.loadBatchDetails('batch-001');

    expect(api.getBatch).toHaveBeenCalledWith({ batchId: 'batch-001' });
    expect(api.listBatchRecords).toHaveBeenCalledWith({ batchId: 'batch-001' });
    expect(service.selectedBatch()?.id).toBe('batch-001');
    expect(service.batchRecords().length).toBe(3);
    expect(service.recordsLoading()).toBe(false);
  });

  it('should create batch and prepend to collections', async () => {
    const newBatch: SettlementBatchResponse = {
      id: 'batch-new',
      rail: 'FEDWIRE',
      currency: 'USD',
      businessDate: '2026-09-26',
      status: 'OPEN',
    };
    vi.spyOn(api, 'createBatch').mockResolvedValue(newBatch as any);

    const result = await service.createBatch({
      rail: 'FEDWIRE',
      currency: 'USD',
      businessDate: '2026-09-26',
    });

    expect(result.id).toBe('batch-new');
    expect(service.batches()[0].id).toBe('batch-new');
  });

  it('should settle batch and update state', async () => {
    service.batches.set(mockBatches);
    service.selectedBatch.set(mockBatches[0]);

    const settledBatch: SettlementBatchResponse = {
      ...mockBatches[0],
      status: 'SETTLED',
      settledAt: '2026-09-26T18:00:00Z',
    };
    vi.spyOn(api, 'settleBatch').mockResolvedValue(settledBatch as any);

    const result = await service.settleBatch('batch-001', {
      externalBatchReference: 'EXT-REF-100',
    });

    expect(result.status).toBe('SETTLED');
    expect(service.batches().find((b) => b.id === 'batch-001')?.status).toBe('SETTLED');
    expect(service.selectedBatch()?.status).toBe('SETTLED');
  });

  it('should fail batch and update state', async () => {
    service.batches.set(mockBatches);
    const failedBatch: SettlementBatchResponse = {
      ...mockBatches[0],
      status: 'FAILED',
    };
    vi.spyOn(api, 'failBatch').mockResolvedValue(failedBatch as any);

    const result = await service.failBatch('batch-001', 'Network timeout');

    expect(result.status).toBe('FAILED');
    expect(service.batches().find((b) => b.id === 'batch-001')?.status).toBe('FAILED');
  });

  it('should close batch and update state', async () => {
    service.batches.set(mockBatches);
    const closedBatch: SettlementBatchResponse = {
      ...mockBatches[1],
      status: 'CLOSED',
    };
    vi.spyOn(api, 'closeBatch').mockResolvedValue(closedBatch as any);

    const result = await service.closeBatch('batch-002');

    expect(result.status).toBe('CLOSED');
    expect(service.batches().find((b) => b.id === 'batch-002')?.status).toBe('CLOSED');
  });

  it('should retry failed record and update record in state', async () => {
    service.batchRecords.set(mockRecords);
    const retriedRecord: SettlementRecordResponse = {
      ...mockRecords[2],
      status: 'PENDING',
      retryCount: 2,
    };
    vi.spyOn(api, 'retryRecord').mockResolvedValue(retriedRecord as any);

    const result = await service.retryRecord('rec-103', 'batch-001');

    expect(result.status).toBe('PENDING');
    expect(result.retryCount).toBe(2);
    expect(service.batchRecords().find((r) => r.id === 'rec-103')?.retryCount).toBe(2);
  });

  it('should clear selection cleanly', () => {
    service.selectedBatch.set(mockBatches[0]);
    service.batchRecords.set(mockRecords);

    service.clearSelection();

    expect(service.selectedBatch()).toBeNull();
    expect(service.batchRecords()).toEqual([]);
  });
});
