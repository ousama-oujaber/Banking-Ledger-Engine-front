import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationCasesDashboardComponent } from './reconciliation-cases-dashboard.component';
import { signal } from '@angular/core';
import type { ReconciliationCaseResponse } from '@ble-frontend/api-client';

describe('ReconciliationCasesDashboardComponent', () => {
  let component: ReconciliationCasesDashboardComponent;
  let mockReconService: any;

  const mockCases: ReconciliationCaseResponse[] = [
    {
      id: 'case-100',
      jobId: 'job-1',
      discrepancyType: 'AMOUNT_MISMATCH',
      status: 'OPEN',
      externalTransactionId: 'EXT-100',
      internalTransactionId: 'INT-100',
      discrepancyAmount: 50.0,
      currency: 'EUR',
      assignedTo: 'operator-1',
    },
    {
      id: 'case-200',
      jobId: 'job-2',
      discrepancyType: 'MISSING_INTERNAL',
      status: 'RESOLVED',
      externalTransactionId: 'EXT-200',
      discrepancyAmount: 200.0,
      currency: 'EUR',
    },
  ];

  beforeEach(() => {
    mockReconService = {
      cases: signal<ReconciliationCaseResponse[]>(mockCases),
      filteredCases: signal<ReconciliationCaseResponse[]>(mockCases),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      statusFilter: signal<string>('ALL'),
      discrepancyFilter: signal<string>('ALL'),
      searchQuery: signal<string>(''),
      kpiSummary: vi.fn().mockReturnValue({
        totalCases: 2,
        openCases: 1,
        escalatedCases: 0,
        resolvedCases: 1,
        totalDiscrepancyAmount: 250.0,
        totalJobs: 2,
        runningJobs: 0,
      }),
      loadCases: vi.fn(),
      loadJobs: vi.fn(),
      selectCase: vi.fn(),
      setStatusFilter: vi.fn(),
      setDiscrepancyFilter: vi.fn(),
      setSearchQuery: vi.fn(),
    };
    component = new ReconciliationCasesDashboardComponent(mockReconService);
  });

  it('should initialize and load cases and jobs on ngOnInit', () => {
    component.ngOnInit();

    expect(mockReconService.loadCases).toHaveBeenCalled();
    expect(mockReconService.loadJobs).toHaveBeenCalled();
    expect(component.kpi().openCases).toBe(1);
    expect(component.kpi().totalDiscrepancyAmount).toBe(250.0);
  });

  it('should route filter modifications to service methods', () => {
    component.onSearchChange('query-text');
    expect(mockReconService.setSearchQuery).toHaveBeenCalledWith('query-text');

    component.onStatusChange('OPEN');
    expect(mockReconService.setStatusFilter).toHaveBeenCalledWith('OPEN');

    component.onDiscrepancyChange('AMOUNT_MISMATCH');
    expect(mockReconService.setDiscrepancyFilter).toHaveBeenCalledWith('AMOUNT_MISMATCH');

    mockReconService.statusFilter.set('OPEN');
    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();
    expect(mockReconService.setStatusFilter).toHaveBeenCalledWith('ALL');
    expect(mockReconService.setDiscrepancyFilter).toHaveBeenCalledWith('ALL');
    expect(mockReconService.setSearchQuery).toHaveBeenCalledWith('');
  });

  it('should toggle case drawer on openCaseDrawer and select case in service', () => {
    component.openCaseDrawer(mockCases[0]);

    expect(component.isDrawerOpen()).toBe(true);
    expect(component.selectedCaseForDrawer()).toEqual(mockCases[0]);
    expect(mockReconService.selectCase).toHaveBeenCalledWith(mockCases[0]);

    component.closeCaseDrawer();
    expect(component.isDrawerOpen()).toBe(false);
    expect(component.selectedCaseForDrawer()).toBeNull();
  });

  it('should open and handle case resolution workflow', () => {
    component.openResolveModal(mockCases[0]);

    expect(component.isResolveModalOpen()).toBe(true);
    expect(component.selectedCaseForAction()).toEqual(mockCases[0]);

    const resolvedResult: ReconciliationCaseResponse = {
      ...mockCases[0],
      status: 'RESOLVED',
      resolutionAction: 'FORCE_ADJUST',
    };
    component.onCaseResolved(resolvedResult);

    expect(component.isResolveModalOpen()).toBe(false);
    expect(component.toastMessage()).toContain('Case case-100 successfully resolved');
  });

  it('should open and handle case escalation workflow', () => {
    component.openEscalateModal(mockCases[0]);

    expect(component.isEscalateModalOpen()).toBe(true);
    expect(component.selectedCaseForAction()).toEqual(mockCases[0]);

    const escalatedResult: ReconciliationCaseResponse = {
      ...mockCases[0],
      status: 'ESCALATED',
    };
    component.onCaseEscalated(escalatedResult);

    expect(component.isEscalateModalOpen()).toBe(false);
    expect(component.toastMessage()).toContain('escalated to supervisor review');
  });

  it('should toggle run job modal and display toast on completion', () => {
    component.openRunJobModal();
    expect(component.isRunJobModalOpen()).toBe(true);

    component.onJobStarted({ id: 'job-999', statementReference: 'STMT-999' });
    expect(component.isRunJobModalOpen()).toBe(false);
    expect(component.toastMessage()).toContain('job-999 initiated');
  });

  it('should toggle jobs drawer and handle navigating to case from drawer', () => {
    component.openJobsDrawer();
    expect(component.isJobsDrawerOpen()).toBe(true);

    component.onJobDrawerCaseSelected('case-100');
    expect(component.isDrawerOpen()).toBe(true);
    expect(component.selectedCaseForDrawer()?.id).toBe('case-100');
  });
});
