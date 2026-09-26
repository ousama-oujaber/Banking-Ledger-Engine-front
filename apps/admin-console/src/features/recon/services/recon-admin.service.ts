import { Injectable, signal, computed } from '@angular/core';
import {
  listCases,
  getCaseById,
  resolveCase,
  escalateCase,
  assignCase,
  listJobs,
  runJob,
  getJobById,
  getJobItems,
  type ReconciliationCaseResponse,
  type ReconciliationJobResponse,
  type ReconciliationItemResponse,
  type ResolveReconciliationCaseRequest,
  type EscalateReconciliationCaseRequest,
  type AssignReconciliationCaseRequest,
  type RunReconciliationJobRequest,
} from '@ble-frontend/api-client';

/**
 * High-level KPI aggregations for the Reconciliation Case Explorer.
 */
export interface ReconKpiSummary {
  totalCases: number;
  openCases: number;
  escalatedCases: number;
  resolvedCases: number;
  totalDiscrepancyAmount: number;
  totalJobs: number;
  runningJobs: number;
}

/**
 * Structured discrepancy comparison comparing external clearing records against internal ledger entries.
 */
export interface DiscrepancyComparison {
  caseId: string;
  externalTransactionId?: string;
  internalTransactionId?: string;
  externalAmount: number;
  internalAmount: number;
  varianceDelta: number;
  currency: string;
  discrepancyType: string;
}

/**
 * ReconAdminService
 *
 * Angular 19 signals-based reactive state service managing:
 * - External clearing file reconciliation jobs (list, trigger, inspect items)
 * - Discrepancy cases triage, filtering, and assignment
 * - Side-by-side ledger vs. clearing file comparison computations
 * - Operator resolution actions (RESOLVE, FORCE_ADJUST, WRITE_OFF, MANUAL_CLEAR)
 * - Supervisor escalation with audit justification
 */
@Injectable({
  providedIn: 'root',
})
export class ReconAdminService {
  // State Signals
  readonly cases = signal<ReconciliationCaseResponse[]>([]);
  readonly selectedCase = signal<ReconciliationCaseResponse | null>(null);
  readonly jobs = signal<ReconciliationJobResponse[]>([]);
  readonly selectedJob = signal<ReconciliationJobResponse | null>(null);
  readonly jobItems = signal<ReconciliationItemResponse[]>([]);

  // Loading & Error Signals
  readonly loading = signal<boolean>(false);
  readonly jobsLoading = signal<boolean>(false);
  readonly itemsLoading = signal<boolean>(false);
  readonly mutating = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter Signals
  readonly statusFilter = signal<string>('ALL');
  readonly discrepancyFilter = signal<string>('ALL');
  readonly searchQuery = signal<string>('');

  /**
   * Filtered discrepancy cases reactive computed signal.
   */
  readonly filteredCases = computed<ReconciliationCaseResponse[]>(() => {
    const status = this.statusFilter();
    const discrepancy = this.discrepancyFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.cases().filter((c) => {
      // Filter by Status
      if (status !== 'ALL' && c.status?.toUpperCase() !== status.toUpperCase()) {
        return false;
      }
      // Filter by Discrepancy Type
      if (discrepancy !== 'ALL' && c.discrepancyType?.toUpperCase() !== discrepancy.toUpperCase()) {
        return false;
      }
      // Filter by Query (Case ID, Ext Tx ID, Int Tx ID, Assigned To, Notes)
      if (query.length > 0) {
        const idMatch = c.id?.toLowerCase().includes(query) ?? false;
        const extMatch = c.externalTransactionId?.toLowerCase().includes(query) ?? false;
        const intMatch = c.internalTransactionId?.toLowerCase().includes(query) ?? false;
        const assigneeMatch = c.assignedTo?.toLowerCase().includes(query) ?? false;
        const notesMatch = c.notes?.toLowerCase().includes(query) ?? false;
        if (!idMatch && !extMatch && !intMatch && !assigneeMatch && !notesMatch) {
          return false;
        }
      }
      return true;
    });
  });

  /**
   * Computed KPI summary statistics across all loaded cases and jobs.
   */
  readonly kpiSummary = computed<ReconKpiSummary>(() => {
    const caseList = this.cases();
    const jobList = this.jobs();

    let openCases = 0;
    let escalatedCases = 0;
    let resolvedCases = 0;
    let totalDiscrepancyAmount = 0;

    for (const c of caseList) {
      const st = (c.status || '').toUpperCase();
      if (st === 'OPEN' || st === 'ASSIGNED') {
        openCases++;
      } else if (st === 'ESCALATED') {
        escalatedCases++;
      } else if (st === 'RESOLVED' || st === 'CLOSED') {
        resolvedCases++;
      }

      if (c.discrepancyAmount) {
        totalDiscrepancyAmount += Math.abs(Number(c.discrepancyAmount));
      }
    }

    let runningJobs = 0;
    for (const j of jobList) {
      const st = (j.status || '').toUpperCase();
      if (st === 'RUNNING' || st === 'PROCESSING' || st === 'IN_PROGRESS') {
        runningJobs++;
      }
    }

    return {
      totalCases: caseList.length,
      openCases,
      escalatedCases,
      resolvedCases,
      totalDiscrepancyAmount,
      totalJobs: jobList.length,
      runningJobs,
    };
  });

  /**
   * Computed side-by-side ledger vs. clearing record comparison for the selected case.
   */
  readonly selectedCaseComparison = computed<DiscrepancyComparison | null>(() => {
    const sc = this.selectedCase();
    if (!sc) return null;

    const discrepancyAmt = Number(sc.discrepancyAmount || 0);
    // Extracted delta or difference
    return {
      caseId: sc.id || 'N/A',
      externalTransactionId: sc.externalTransactionId,
      internalTransactionId: sc.internalTransactionId,
      externalAmount: Math.abs(discrepancyAmt),
      internalAmount: 0,
      varianceDelta: discrepancyAmt,
      currency: sc.currency || 'EUR',
      discrepancyType: sc.discrepancyType || 'AMOUNT_MISMATCH',
    };
  });

  /**
   * Load reconciliation cases matching filters.
   */
  async loadCases(status?: string, discrepancyType?: string, jobId?: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const queryStatus = status && status !== 'ALL' ? status : undefined;
      const queryDisc = discrepancyType && discrepancyType !== 'ALL' ? discrepancyType : undefined;
      const data = await listCases({
        status: queryStatus,
        discrepancyType: queryDisc,
        jobId: jobId || undefined,
      });
      this.cases.set(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve reconciliation cases';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load reconciliation batch clearing jobs.
   */
  async loadJobs(source?: string, status?: string): Promise<void> {
    this.jobsLoading.set(true);
    this.error.set(null);

    try {
      const querySource = source && source !== 'ALL' ? source : undefined;
      const queryStatus = status && status !== 'ALL' ? status : undefined;
      const data = await listJobs({ source: querySource, status: queryStatus });
      this.jobs.set(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve reconciliation jobs';
      this.error.set(msg);
    } finally {
      this.jobsLoading.set(false);
    }
  }

  /**
   * Select a case and fetch its latest detail and audit history.
   */
  async selectCase(caseItem: ReconciliationCaseResponse | null): Promise<void> {
    if (!caseItem || !caseItem.id) {
      this.selectedCase.set(null);
      return;
    }

    this.selectedCase.set(caseItem);
    try {
      const detailed = await getCaseById({ id: caseItem.id });
      this.selectedCase.set(detailed);
    } catch {
      // Retain optimistic case state if detailed call fails
    }
  }

  /**
   * Execute administrative resolution on a discrepancy case.
   */
  async resolveCase(
    caseId: string,
    req: ResolveReconciliationCaseRequest,
  ): Promise<ReconciliationCaseResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const resolved = await resolveCase({
        id: caseId,
        requestBody: req,
      });

      // Update in cases collection
      this.cases.update((items) =>
        items.map((item) =>
          item.id === caseId ? { ...item, ...resolved, status: 'RESOLVED' } : item,
        ),
      );

      if (this.selectedCase()?.id === caseId) {
        this.selectedCase.set({ ...this.selectedCase(), ...resolved, status: 'RESOLVED' });
      }

      return resolved;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to resolve case ${caseId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Escalate an open discrepancy case to compliance or senior operations.
   */
  async escalateCase(
    caseId: string,
    req: EscalateReconciliationCaseRequest,
  ): Promise<ReconciliationCaseResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const escalated = await escalateCase({
        id: caseId,
        requestBody: req,
      });

      this.cases.update((items) =>
        items.map((item) =>
          item.id === caseId ? { ...item, ...escalated, status: 'ESCALATED' } : item,
        ),
      );

      if (this.selectedCase()?.id === caseId) {
        this.selectedCase.set({ ...this.selectedCase(), ...escalated, status: 'ESCALATED' });
      }

      return escalated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to escalate case ${caseId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Assign a discrepancy case to an operator queue.
   */
  async assignCase(
    caseId: string,
    req: AssignReconciliationCaseRequest,
  ): Promise<ReconciliationCaseResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const assigned = await assignCase({
        id: caseId,
        requestBody: req,
      });

      this.cases.update((items) =>
        items.map((item) =>
          item.id === caseId ? { ...item, ...assigned, status: 'ASSIGNED' } : item,
        ),
      );

      if (this.selectedCase()?.id === caseId) {
        this.selectedCase.set({ ...this.selectedCase(), ...assigned, status: 'ASSIGNED' });
      }

      return assigned;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to assign case ${caseId}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Trigger an on-demand clearing reconciliation run.
   */
  async runReconJob(req: RunReconciliationJobRequest): Promise<ReconciliationJobResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const job = await runJob({ requestBody: req });
      this.jobs.update((list) => [job, ...list]);
      return job;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger reconciliation job';
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Load details and item matches for a reconciliation job.
   */
  async loadJobDetails(jobId: string, matchStatus?: string): Promise<void> {
    this.itemsLoading.set(true);
    this.error.set(null);

    try {
      const [job, items] = await Promise.all([
        getJobById({ id: jobId }),
        getJobItems({ id: jobId, matchStatus }),
      ]);
      this.selectedJob.set(job);
      this.jobItems.set(Array.isArray(items) ? items : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to load items for job ${jobId}`;
      this.error.set(msg);
    } finally {
      this.itemsLoading.set(false);
    }
  }

  /**
   * Select a job without fetching items.
   */
  selectJob(job: ReconciliationJobResponse | null): void {
    this.selectedJob.set(job);
    if (!job) {
      this.jobItems.set([]);
    }
  }

  /**
   * Clear active selection drawers.
   */
  clearSelection(): void {
    this.selectedCase.set(null);
    this.selectedJob.set(null);
    this.jobItems.set([]);
  }

  /**
   * Filter modifiers.
   */
  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  setDiscrepancyFilter(discrepancyType: string): void {
    this.discrepancyFilter.set(discrepancyType);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }
}
