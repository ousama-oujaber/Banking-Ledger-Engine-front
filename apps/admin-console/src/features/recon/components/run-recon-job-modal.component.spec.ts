import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunReconJobModalComponent } from './run-recon-job-modal.component';
import type { ReconciliationJobResponse } from '@ble-frontend/api-client';

describe('RunReconJobModalComponent', () => {
  let component: RunReconJobModalComponent;
  let mockReconService: any;

  beforeEach(() => {
    mockReconService = {
      runReconJob: vi.fn(),
    };
    component = new RunReconJobModalComponent(mockReconService);
  });

  it('should initialize closed with default form states', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.source()).toBe('SEPA');
    expect(component.currency()).toBe('EUR');
  });

  it('should reset form with generated reference when open is set to true', () => {
    component.open = true;

    expect(component.isOpen()).toBe(true);
    expect(component.statementReference()).toContain('STMT-');
    expect(component.isValid()).toBe(true);
  });

  it('should validate statement reference and business date presence', () => {
    component.open = true;
    component.statementReference.set('');
    expect(component.isValid()).toBe(false);

    component.statementReference.set('STMT-2026-TEST');
    expect(component.isValid()).toBe(true);

    component.businessDate.set('');
    expect(component.isValid()).toBe(false);
  });

  it('should trigger reconciliation job and emit jobStarted event', async () => {
    const jobResult: ReconciliationJobResponse = {
      id: 'job-777',
      source: 'ACH',
      statementReference: 'STMT-ACH-01',
      businessDate: '2026-09-26',
      status: 'RUNNING',
    };
    mockReconService.runReconJob.mockResolvedValue(jobResult);
    const startSpy = vi.spyOn(component.jobStarted, 'emit');

    component.open = true;
    component.source.set('ACH');
    component.statementReference.set('STMT-ACH-01');
    component.currency.set('USD');

    await component.handleSubmit();

    expect(mockReconService.runReconJob).toHaveBeenCalledWith({
      source: 'ACH',
      statementReference: 'STMT-ACH-01',
      businessDate: component.businessDate(),
      currency: 'USD',
    });
    expect(startSpy).toHaveBeenCalledWith(jobResult);
    expect(component.isOpen()).toBe(false);
  });

  it('should display error message on job execution rejection', async () => {
    mockReconService.runReconJob.mockRejectedValue(new Error('Clearing engine offline'));

    component.open = true;
    component.statementReference.set('STMT-FAIL-01');

    await component.handleSubmit();

    expect(component.error()).toBe('Clearing engine offline');
    expect(component.submitting()).toBe(false);
    expect(component.isOpen()).toBe(true);
  });

  it('should emit cancelled event on handleCancel', () => {
    const cancelSpy = vi.spyOn(component.cancelled, 'emit');
    component.open = true;

    component.handleCancel();

    expect(cancelSpy).toHaveBeenCalled();
    expect(component.isOpen()).toBe(false);
  });
});
