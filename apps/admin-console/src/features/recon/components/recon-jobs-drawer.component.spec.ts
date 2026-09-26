import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconJobsDrawerComponent } from './recon-jobs-drawer.component';
import { signal } from '@angular/core';
import type { ReconciliationJobResponse } from '@ble-frontend/api-client';

describe('ReconJobsDrawerComponent', () => {
  let component: ReconJobsDrawerComponent;
  let mockReconService: any;

  const mockJobs: ReconciliationJobResponse[] = [
    {
      id: 'job-1',
      source: 'SEPA',
      statementReference: 'STMT-01',
      status: 'COMPLETED',
      totalExternalRecords: 10,
      matchedCount: 8,
      discrepancyCount: 2,
    },
  ];

  beforeEach(() => {
    mockReconService = {
      jobs: signal<ReconciliationJobResponse[]>(mockJobs),
      selectedJob: signal<ReconciliationJobResponse | null>(null),
      jobItems: signal<any[]>([]),
      jobsLoading: signal<boolean>(false),
      itemsLoading: signal<boolean>(false),
      loadJobs: vi.fn(),
      loadJobDetails: vi.fn(),
    };
    component = new ReconJobsDrawerComponent(mockReconService);
  });

  it('should initialize closed with default ALL filter', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.matchStatusFilter()).toBe('ALL');
  });

  it('should trigger loadJobs if empty when opened', () => {
    mockReconService.jobs.set([]);
    component.open = true;

    expect(component.isOpen()).toBe(true);
    expect(mockReconService.loadJobs).toHaveBeenCalled();
  });

  it('should call loadJobDetails when a job is clicked', () => {
    component.selectJob(mockJobs[0]);

    expect(mockReconService.loadJobDetails).toHaveBeenCalledWith('job-1', undefined);
  });

  it('should reload job details when match status filter changes', () => {
    mockReconService.selectedJob.set(mockJobs[0]);

    component.onFilterChange('DISCREPANCY');

    expect(component.matchStatusFilter()).toBe('DISCREPANCY');
    expect(mockReconService.loadJobDetails).toHaveBeenCalledWith('job-1', 'DISCREPANCY');
  });

  it('should emit caseSelected and close drawer when navigating to discrepancy case', () => {
    const caseSpy = vi.spyOn(component.caseSelected, 'emit');
    component.open = true;

    component.navigateToCase('case-555');

    expect(caseSpy).toHaveBeenCalledWith('case-555');
    expect(component.isOpen()).toBe(false);
  });

  it('should emit closed on handleClose', () => {
    const closedSpy = vi.spyOn(component.closed, 'emit');
    component.open = true;

    component.handleClose();

    expect(closedSpy).toHaveBeenCalled();
    expect(component.isOpen()).toBe(false);
  });
});
