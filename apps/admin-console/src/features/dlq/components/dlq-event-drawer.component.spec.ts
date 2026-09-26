import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DlqEventDrawerComponent } from './dlq-event-drawer.component';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

describe('DlqEventDrawerComponent', () => {
  let component: DlqEventDrawerComponent;
  let mockDlqService: any;

  const mockEvent: DeadLetterEventResponse = {
    id: 'dlq-test-1',
    originalEventId: 'evt-test-1',
    topic: 'TRANSACTION_EVENTS',
    eventType: 'TransferCompletedEvent',
    aggregateType: 'Transfer',
    aggregateId: 'tx-100',
    payload: '{"amount": 100, "currency": "EUR"}',
    headers: {
      traceparent: '00-trace123-01',
      'content-type': 'application/json',
    },
    errorMessage: 'Simulated network failure on outbox delivery',
    stackTrace: 'java.net.ConnectException: Connection refused',
    retryCount: 3,
    maxRetries: 3,
    status: 'PENDING',
  };

  beforeEach(() => {
    mockDlqService = {};
    component = new DlqEventDrawerComponent(mockDlqService);
  });

  it('should initialize closed and null target event', () => {
    expect(component.isOpen()).toBe(false);
    expect(component.targetEvent()).toBeNull();
  });

  it('should populate target event, format JSON payload, and compute headers', () => {
    component.open = true;
    component.eventItem = mockEvent;

    expect(component.isOpen()).toBe(true);
    expect(component.targetEvent()).toEqual(mockEvent);
    expect(component.formattedPayload()).toContain('"amount": 100');
    expect(component.headerEntries().length).toBe(2);
    expect(component.isMaxRetries()).toBe(true);
    expect(component.canTakeAction()).toBe(true);
  });

  it('should disable actions if event is not PENDING', () => {
    component.eventItem = { ...mockEvent, status: 'REPLAYED' };
    expect(component.canTakeAction()).toBe(false);

    component.eventItem = { ...mockEvent, status: 'DISCARDED' };
    expect(component.canTakeAction()).toBe(false);
  });

  it('should emit closed on handleClose and onEscape', () => {
    const closeSpy = vi.spyOn(component.closed, 'emit');
    component.open = true;

    component.handleClose();
    expect(component.isOpen()).toBe(false);
    expect(closeSpy).toHaveBeenCalled();

    component.open = true;
    component.onEscape();
    expect(component.isOpen()).toBe(false);
  });

  it('should emit replayRequested with target event on onReplayClick', () => {
    const replaySpy = vi.spyOn(component.replayRequested, 'emit');
    component.eventItem = mockEvent;

    component.onReplayClick();
    expect(replaySpy).toHaveBeenCalledWith(mockEvent);
  });

  it('should emit discardRequested with target event on onDiscardClick', () => {
    const discardSpy = vi.spyOn(component.discardRequested, 'emit');
    component.eventItem = mockEvent;

    component.onDiscardClick();
    expect(discardSpy).toHaveBeenCalledWith(mockEvent);
  });

  it('should set copy feedback on copyToClipboard', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    component.copyToClipboard('sample-text', 'Copied text');
    expect(component.copyFeedback()).toBe('Copied text');
  });
});
