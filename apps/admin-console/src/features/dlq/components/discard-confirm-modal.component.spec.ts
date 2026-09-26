import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscardConfirmModalComponent } from './discard-confirm-modal.component';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

describe('DiscardConfirmModalComponent', () => {
  let component: DiscardConfirmModalComponent;
  let mockDlqService: any;

  const mockEvent: DeadLetterEventResponse = {
    id: 'dlq-discard-1',
    topic: 'SETTLEMENT_EVENTS',
    errorMessage: 'Corrupt payload structure',
  };

  beforeEach(() => {
    mockDlqService = {
      discardEvent: vi.fn(),
    };
    component = new DiscardConfirmModalComponent(mockDlqService);
  });

  it('should initialize closed and null target event', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.targetEvent()).toBeNull();
    expect(component.submitting()).toBe(false);
  });

  it('should confirm discard and emit discarded event', async () => {
    const discardedResult = { ...mockEvent, status: 'DISCARDED' as const };
    mockDlqService.discardEvent.mockResolvedValue(discardedResult);
    const discardedSpy = vi.spyOn(component.discarded, 'emit');

    component.open = true;
    component.eventItem = mockEvent;

    await component.handleConfirm();

    expect(mockDlqService.discardEvent).toHaveBeenCalledWith('dlq-discard-1');
    expect(discardedSpy).toHaveBeenCalledWith(discardedResult);
    expect(component.isOpen()).toBe(false);
  });

  it('should capture error when discard fails', async () => {
    mockDlqService.discardEvent.mockRejectedValue(new Error('Permission denied'));

    component.open = true;
    component.eventItem = mockEvent;

    await component.handleConfirm();

    expect(component.error()).toBe('Permission denied');
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
