import { Injectable, signal, computed } from '@angular/core';
import {
  listBatches,
  createBatch,
  getBatch,
  settleBatch,
  failBatch,
  closeBatch,
  listBatchRecords,
  retryRecord,
  enqueueRecord,
  type SettlementBatchResponse,
  type CreateSettlementBatchRequest,
  type SettleSettlementBatchRequest,
  type FailSettlementBatchRequest,
  type SettlementRecordResponse,
  type EnqueueSettlementRecordRequest,
} from '@ble-frontend/api-client';

/**
 * KPI Summary model aggregating settlement dashboard statistics.
 */
export interface SettlementKpiSummary {
  totalCount: number;
  openCount: number;
  settledCount: number;
  failedCount: number;
  totalSettledAmount: number;
}

/**
 * Summary breakdown of records within an inspected batch.
 */
export interface BatchRecordsSummary {
  recordCount: number;
  pendingCount: number;
  settledCount: number;
  failedCount: number;
  totalGrossDebit: number;
  totalGrossCredit: number;
  netDelta: number;
}

/**
 * SettlementAdminService
 *
 * Angular 19 signals-based reactive state service managing:
 * - Clearing and settlement batches retrieval, filtering, and pagination
 * - Batch lifecycle state transitions (CREATE -> SETTLE / FAIL / CLOSE)
 * - Item-level inspection of batch transactions and discrepancy triage
 * - Retrying failed settlement records
 */
@Injectable({
  providedIn: 'root',
})
export class SettlementAdminService {
  // State Signals
  readonly batches = signal<SettlementBatchResponse[]>([]);
  readonly selectedBatch = signal<SettlementBatchResponse | null>(null);
  readonly batchRecords = signal<SettlementRecordResponse[]>([]);
  readonly loading = signal<boolean>(false);
  readonly recordsLoading = signal<boolean>(false);
  readonly mutating = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter Signals
  readonly railFilter = signal<string>('ALL');
  readonly statusFilter = signal<string>('ALL');
  readonly searchQuery = signal<string>('');

  /**
   * Filtered batches reactive computed signal based on rail, status, and search query.
   */
  readonly filteredBatches = computed<SettlementBatchResponse[]>(() => {
    const rail = this.railFilter();
    const status = this.statusFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.batches().filter((batch) => {
      // Filter by Payment Rail
      if (rail !== 'ALL' && batch.rail?.toUpperCase() !== rail.toUpperCase()) {
        return false;
      }
      // Filter by Batch Status
      if (status !== 'ALL' && batch.status?.toUpperCase() !== status.toUpperCase()) {
        return false;
      }
      // Filter by Search Query (ID or External Reference)
      if (query.length > 0) {
        const idMatch = batch.id?.toLowerCase().includes(query) ?? false;
        const refMatch = batch.externalBatchReference?.toLowerCase().includes(query) ?? false;
        const railMatch = batch.rail?.toLowerCase().includes(query) ?? false;
        if (!idMatch && !refMatch && !railMatch) {
          return false;
        }
      }
      return true;
    });
  });

  /**
   * Computed KPI summary statistics across all loaded batches.
   */
  readonly kpiSummary = computed<SettlementKpiSummary>(() => {
    const list = this.batches();
    let openCount = 0;
    let settledCount = 0;
    let failedCount = 0;
    let totalSettledAmount = 0;

    for (const b of list) {
      const st = (b.status || '').toUpperCase();
      if (st === 'OPEN' || st === 'PENDING') {
        openCount++;
      } else if (st === 'SETTLED') {
        settledCount++;
        totalSettledAmount += Number(b.totalAmount?.amount || 0);
      } else if (st === 'FAILED') {
        failedCount++;
      }
    }

    return {
      totalCount: list.length,
      openCount,
      settledCount,
      failedCount,
      totalSettledAmount,
    };
  });

  /**
   * Computed breakdown summary for the currently selected batch's records.
   */
  readonly selectedBatchRecordsSummary = computed<BatchRecordsSummary>(() => {
    const records = this.batchRecords();
    let pendingCount = 0;
    let settledCount = 0;
    let failedCount = 0;
    let totalGrossDebit = 0;
    let totalGrossCredit = 0;

    for (const r of records) {
      const st = (r.status || '').toUpperCase();
      if (st === 'PENDING' || st === 'QUEUED') {
        pendingCount++;
      } else if (st === 'SETTLED') {
        settledCount++;
      } else if (st === 'FAILED') {
        failedCount++;
      }

      const amt = Number(r.amount?.amount || 0);
      if (amt < 0) {
        totalGrossDebit += Math.abs(amt);
      } else {
        totalGrossCredit += amt;
      }
    }

    return {
      recordCount: records.length,
      pendingCount,
      settledCount,
      failedCount,
      totalGrossDebit,
      totalGrossCredit,
      netDelta: totalGrossCredit - totalGrossDebit,
    };
  });

  /**
   * Load settlement batches matching query criteria.
   */
  async loadBatches(rail?: string, status?: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const queryRail = rail && rail !== 'ALL' ? rail : undefined;
      const queryStatus = status && status !== 'ALL' ? status : undefined;
      const data = await listBatches({ rail: queryRail, status: queryStatus });
      this.batches.set(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve settlement batches';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Select a batch and load its header details along with individual itemized records.
   */
  async loadBatchDetails(batchId: string): Promise<void> {
    this.recordsLoading.set(true);
    this.error.set(null);

    try {
      const [batch, records] = await Promise.all([
        getBatch({ batchId }),
        listBatchRecords({ batchId }),
      ]);
      this.selectedBatch.set(batch);
      this.batchRecords.set(Array.isArray(records) ? records : []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : `Failed to load details for batch ${batchId}`;
      this.error.set(msg);
    } finally {
      this.recordsLoading.set(false);
    }
  }

  /**
   * Create a new clearing and settlement batch.
   */
  async createBatch(request: CreateSettlementBatchRequest): Promise<SettlementBatchResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const created = await createBatch({ requestBody: request });
      this.batches.update((prev) => [created, ...prev]);
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create settlement batch';
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Execute atomic batch settlement with clearing reference.
   */
  async settleBatch(
    batchId: string,
    request: SettleSettlementBatchRequest,
  ): Promise<SettlementBatchResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const updated = await settleBatch({ batchId, requestBody: request });
      this.updateBatchInState(updated);
      if (this.selectedBatch()?.id === batchId) {
        this.selectedBatch.set(updated);
      }
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to settle batch ${batchId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Mark a batch as failed with audit reason.
   */
  async failBatch(batchId: string, reason: string): Promise<SettlementBatchResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const updated = await failBatch({ batchId, requestBody: { reason } });
      this.updateBatchInState(updated);
      if (this.selectedBatch()?.id === batchId) {
        this.selectedBatch.set(updated);
      }
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to fail batch ${batchId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Close a settled batch.
   */
  async closeBatch(batchId: string): Promise<SettlementBatchResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const updated = await closeBatch({ batchId });
      this.updateBatchInState(updated);
      if (this.selectedBatch()?.id === batchId) {
        this.selectedBatch.set(updated);
      }
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to close batch ${batchId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Retry a failed settlement record.
   */
  async retryRecord(recordId: string, batchId?: string): Promise<SettlementRecordResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const updated = await retryRecord({ recordId });
      // Update record in batchRecords signal
      this.batchRecords.update((records) =>
        records.map((r) => (r.id === recordId ? { ...r, ...updated } : r)),
      );
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to retry record ${recordId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Enqueue a new record into the settlement pipeline.
   */
  async enqueueRecord(request: EnqueueSettlementRecordRequest): Promise<SettlementRecordResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const created = await enqueueRecord({ requestBody: request });
      if (request.batchId && this.selectedBatch()?.id === request.batchId) {
        this.batchRecords.update((records) => [created, ...records]);
      }
      return created;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enqueue settlement record';
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Clear selected batch and record list.
   */
  clearSelection(): void {
    this.selectedBatch.set(null);
    this.batchRecords.set([]);
  }

  /**
   * Helper updating a batch in the local batches collection.
   */
  private updateBatchInState(updated: SettlementBatchResponse): void {
    this.batches.update((prev) =>
      prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)),
    );
  }
}
