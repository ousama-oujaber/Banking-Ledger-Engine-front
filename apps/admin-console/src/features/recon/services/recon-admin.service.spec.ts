import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconAdminService } from './recon-admin.service';
import * as apiClient from '@ble-frontend/api-client';

vi.mock('@ble-frontend/api-client', async () => {
  const actual = await vi.importActual<typeof apiClient>('@ble-frontend/api-client');
  return {
    ...actual,
    listCases: vi.fn(),
    getCaseById: vi.fn(),
    resolveCase: vi.fn(),
    escalateCase: vi.fn(),
    assignCase: vi.fn(),
    listJobs: vi.fn(),
    runJob: vi.fn(),
    getJobById: vi.fn(),
    getJobItems: vi.fn(),
  };
});

describe('ReconAdminService', () => {
  let service: ReconAdminService;

  const mockCases: apiClient.ReconciliationCaseResponse[] = [
    {
      id: 'case-1',
      jobId: 'job-101',
      discrepancyType: 'AMOUNT_MISMATCH',
      status: 'OPEN',
      externalTransactionId: 'EXT-TX-1',
      internalTransactionId: 'INT-TX-1',
      discrepancyAmount: 150.5,
      currency: 'EUR',
      assignedTo: 'operator-1',
      notes: 'Discrepancy in clearing ledger',
    },
    {
      id: 'case-2',
      jobId: 'job-102',
      discrepancyType: 'MISSING_INTERNAL',
      status: 'ESCALATED',
      externalTransactionId: 'EXT-TX-2',
      discrepancyAmount: 5000.0,
      currency: 'USD',
      assignedTo: 'compliance-officer',
      notes: 'High value clearing missing',
    },
    {
      id: 'case-3',
      jobId: 'job-101',
      discrepancyType: 'AMOUNT_MISMATCH',
      status: 'RESOLVED',
      externalTransactionId: 'EXT-TX-3',
      internalTransactionId: 'INT-TX-3',
      discrepancyAmount: 20.0,
      currency: 'EUR',
      assignedTo: 'operator-2',
      notes: 'Resolved via compensating entry',
    },
  ];

  const mockJobs: apiClient.ReconciliationJobResponse[] = [
    {
      id: 'job-101',
      source: 'SEPA',
      statementReference: 'STMT-2026-09-01',
      businessDate: '2026-09-26',
      status: 'COMPLETED',
      totalExternalRecords: 50,
      matchedCount: 48,
      discrepancyCount: 2,
    },
    {
      id: 'job-102',
      source: 'FEDWIRE',
      statementReference: 'STMT-2026-09-02',
      businessDate: '2026-09-26',
      status: 'RUNNING',
      totalExternalRecords: 120,
      matchedCount: 110,
      discrepancyCount: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReconAdminService();
  });

  it('should initialize with default states and empty collections', () => {
    expect(service.cases()).toEqual([]);
    expect(service.jobs()).toEqual([]);
    expect(service.selectedCase()).toBeNull();
    expect(service.selectedJob()).toBeNull();
    expect(service.statusFilter()).toBe('ALL');
    expect(service.discrepancyFilter()).toBe('ALL');
    expect(service.searchQuery()).toBe('');
    expect(service.loading()).toBe(false);
    expect(service.mutating()).toBe(false);
    expect(service.error()).toBeNull();
  });

  describe('loadCases', () => {
    it('should successfully load and populate cases', async () => {
      vi.mocked(apiClient.listCases).mockResolvedValue(mockCases);

      await service.loadCases('OPEN', 'AMOUNT_MISMATCH');

      expect(apiClient.listCases).toHaveBeenCalledWith({
        status: 'OPEN',
        discrepancyType: 'AMOUNT_MISMATCH',
        jobId: undefined,
      });
      expect(service.cases()).toEqual(mockCases);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should handle loadCases failure gracefully', async () => {
      vi.mocked(apiClient.listCases).mockRejectedValue(new Error('Network error'));

      await service.loadCases();

      expect(service.cases()).toEqual([]);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('Network error');
    });
  });

  describe('loadJobs', () => {
    it('should load reconciliation jobs and update signal', async () => {
      vi.mocked(apiClient.listJobs).mockResolvedValue(mockJobs);

      await service.loadJobs('SEPA');

      expect(apiClient.listJobs).toHaveBeenCalledWith({
        source: 'SEPA',
        status: undefined,
      });
      expect(service.jobs()).toEqual(mockJobs);
      expect(service.jobsLoading()).toBe(false);
    });

    it('should handle loadJobs failure', async () => {
      vi.mocked(apiClient.listJobs).mockRejectedValue(new Error('Jobs unavailable'));

      await service.loadJobs();

      expect(service.jobs()).toEqual([]);
      expect(service.error()).toBe('Jobs unavailable');
    });
  });

  describe('filteredCases', () => {
    beforeEach(() => {
      service.cases.set(mockCases);
    });

    it('should filter cases by status', () => {
      service.setStatusFilter('ESCALATED');
      expect(service.filteredCases()).toEqual([mockCases[1]]);
    });

    it('should filter cases by discrepancy type', () => {
      service.setDiscrepancyFilter('MISSING_INTERNAL');
      expect(service.filteredCases()).toEqual([mockCases[1]]);
    });

    it('should search by case ID or transaction reference', () => {
      service.setSearchQuery('EXT-TX-1');
      expect(service.filteredCases()).toEqual([mockCases[0]]);

      service.setSearchQuery('compliance');
      expect(service.filteredCases()).toEqual([mockCases[1]]);
    });
  });

  describe('kpiSummary & selectedCaseComparison', () => {
    beforeEach(() => {
      service.cases.set(mockCases);
      service.jobs.set(mockJobs);
    });

    it('should calculate KPI aggregations accurately', () => {
      const kpis = service.kpiSummary();
      expect(kpis.totalCases).toBe(3);
      expect(kpis.openCases).toBe(1);
      expect(kpis.escalatedCases).toBe(1);
      expect(kpis.resolvedCases).toBe(1);
      expect(kpis.totalDiscrepancyAmount).toBe(5170.5);
      expect(kpis.totalJobs).toBe(2);
      expect(kpis.runningJobs).toBe(1);
    });

    it('should calculate comparison details for selectedCase', () => {
      expect(service.selectedCaseComparison()).toBeNull();

      service.selectedCase.set(mockCases[0]);
      const comp = service.selectedCaseComparison();
      expect(comp).not.toBeNull();
      expect(comp?.caseId).toBe('case-1');
      expect(comp?.externalAmount).toBe(150.5);
      expect(comp?.currency).toBe('EUR');
    });
  });

  describe('case mutations', () => {
    beforeEach(() => {
      service.cases.set([...mockCases]);
      service.selectedCase.set(mockCases[0]);
    });

    it('should resolve a case and update reactive state', async () => {
      const resolvedResponse: apiClient.ReconciliationCaseResponse = {
        ...mockCases[0],
        status: 'RESOLVED',
        resolutionAction: 'FORCE_ADJUST',
        notes: 'Adjustment posted',
      };
      vi.mocked(apiClient.resolveCase).mockResolvedValue(resolvedResponse);

      const res = await service.resolveCase('case-1', {
        resolutionAction: 'FORCE_ADJUST',
        notes: 'Adjustment posted',
        operator: 'admin',
      });

      expect(apiClient.resolveCase).toHaveBeenCalledWith({
        id: 'case-1',
        requestBody: {
          resolutionAction: 'FORCE_ADJUST',
          notes: 'Adjustment posted',
          operator: 'admin',
        },
      });
      expect(res.status).toBe('RESOLVED');
      expect(service.cases().find((c) => c.id === 'case-1')?.status).toBe('RESOLVED');
      expect(service.selectedCase()?.status).toBe('RESOLVED');
    });

    it('should escalate a case and update reactive state', async () => {
      const escalatedResponse: apiClient.ReconciliationCaseResponse = {
        ...mockCases[0],
        status: 'ESCALATED',
        notes: 'Requires director signoff',
      };
      vi.mocked(apiClient.escalateCase).mockResolvedValue(escalatedResponse);

      const res = await service.escalateCase('case-1', {
        reason: 'Requires director signoff',
        operator: 'admin',
      });

      expect(apiClient.escalateCase).toHaveBeenCalledWith({
        id: 'case-1',
        requestBody: {
          reason: 'Requires director signoff',
          operator: 'admin',
        },
      });
      expect(res.status).toBe('ESCALATED');
      expect(service.cases().find((c) => c.id === 'case-1')?.status).toBe('ESCALATED');
    });

    it('should assign a case to operator', async () => {
      const assignedResponse: apiClient.ReconciliationCaseResponse = {
        ...mockCases[0],
        status: 'ASSIGNED',
        assignedTo: 'senior-operator',
      };
      vi.mocked(apiClient.assignCase).mockResolvedValue(assignedResponse);

      const res = await service.assignCase('case-1', {
        assignedTo: 'senior-operator',
      });

      expect(res.assignedTo).toBe('senior-operator');
      expect(service.cases().find((c) => c.id === 'case-1')?.assignedTo).toBe('senior-operator');
    });
  });

  describe('reconciliation jobs & items', () => {
    it('should trigger a new reconciliation run and prepend to jobs list', async () => {
      const newJob: apiClient.ReconciliationJobResponse = {
        id: 'job-999',
        source: 'SWIFT',
        statementReference: 'STMT-999',
        businessDate: '2026-09-26',
        status: 'RUNNING',
      };
      vi.mocked(apiClient.runJob).mockResolvedValue(newJob);

      const res = await service.runReconJob({
        source: 'SWIFT',
        statementReference: 'STMT-999',
        businessDate: '2026-09-26',
        currency: 'EUR',
      });

      expect(res.id).toBe('job-999');
      expect(service.jobs()[0]).toEqual(newJob);
    });

    it('should load job details and item matches', async () => {
      const job: apiClient.ReconciliationJobResponse = mockJobs[0];
      const items: apiClient.ReconciliationItemResponse[] = [
        {
          id: 'item-1',
          jobId: 'job-101',
          matchStatus: 'MATCHED',
        },
        {
          id: 'item-2',
          jobId: 'job-101',
          matchStatus: 'DISCREPANCY',
        },
      ];
      vi.mocked(apiClient.getJobById).mockResolvedValue(job);
      vi.mocked(apiClient.getJobItems).mockResolvedValue(items);

      await service.loadJobDetails('job-101');

      expect(service.selectedJob()).toEqual(job);
      expect(service.jobItems()).toEqual(items);
      expect(service.itemsLoading()).toBe(false);
    });

    it('should clear selection cleanly', () => {
      service.selectedCase.set(mockCases[0]);
      service.selectedJob.set(mockJobs[0]);
      service.jobItems.set([{ id: 'item-1' }]);

      service.clearSelection();

      expect(service.selectedCase()).toBeNull();
      expect(service.selectedJob()).toBeNull();
      expect(service.jobItems()).toEqual([]);
    });
  });
});
