import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplayConfirmModalComponent } from './replay-confirm-modal.component';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

describe('ReplayConfirmModalComponent', () => {
  let component: ReplayConfirmModalComponent;
  let mockDlqService: any;

  const mockEvent: DeadLetterEventResponse = {
    id: 'dlq-replay-1',
    topic: 'TRANSACTION_EVENTS',
    retryCount: 2,
    maxRetries: 3,
  };

  beforeEach(() => {
    mockDlqService = {
      replayEvent: vi.fn(),
      replayAllPending: vi.fn(),
    };
    component = new ReplayConfirmModalComponent(mockDlqService);
  });

  it('should initialize closed with default states', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.isBulk()).toBe(false);
    expect(component.submitting()).toBe(false);
  });

  it('should confirm single event replay and emit replayed event', async () => {
    const replayedResult = { ...mockEvent, status: 'REPLAYED' as const };
    mockDlqService.replayEvent.mockResolvedValue(replayedResult);
    const replayedSpy = vi.spyOn(component.replayed, 'emit');

    component.open = true;
    component.eventItem = mockEvent;

    await component.handleConfirm();

    expect(mockDlqService.replayEvent).toHaveBeenCalledWith('dlq-replay-1');
    expect(replayedSpy).toHaveBeenCalledWith(replayedResult);
    expect(component.isOpen()).toBe(false);
  });

  it('should confirm bulk replay and emit replayed count', async () => {
    mockDlqService.replayAllPending.mockResolvedValue(5);
    const replayedSpy = vi.spyOn(component.replayed, 'emit');

    component.open = true;
    component.bulk = { active: true, count: 5 };

    await component.handleConfirm();

    expect(mockDlqService.replayAllPending).toHaveBeenCalled();
    expect(replayedSpy).toHaveBeenCalledWith(5);
    expect(component.isOpen()).toBe(false);
  });

  it('should capture error when replay fails', async () => {
    mockDlqService.replayEvent.mockRejectedValue(new Error('Broker channel closed'));

    component.open = true;
    component.eventItem = mockEvent;

    await component.handleConfirm();

    expect(component.error()).toBe('Broker channel closed');
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
