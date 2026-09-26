import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DlqOpsComponent } from './dlq-ops.component';
import { signal } from '@angular/core';
import type { DeadLetterEventResponse } from '@ble-frontend/api-client';

describe('DlqOpsComponent', () => {
  let component: DlqOpsComponent;
  let mockDlqService: any;

  const mockEvents: DeadLetterEventResponse[] = [
    {
      id: 'dlq-1',
      topic: 'TRANSACTION_EVENTS',
      eventType: 'MoneyTransferredEvent',
      status: 'PENDING',
      errorMessage: 'Database timeout',
      retryCount: 3,
      maxRetries: 3,
    },
    {
      id: 'dlq-2',
      topic: 'ACCOUNT_EVENTS',
      eventType: 'AccountCreatedEvent',
      status: 'REPLAYED',
      errorMessage: 'Network glitch',
    },
  ];

  beforeEach(() => {
    mockDlqService = {
      events: signal<DeadLetterEventResponse[]>(mockEvents),
      filteredEvents: signal<DeadLetterEventResponse[]>(mockEvents),
      loading: signal<boolean>(false),
      error: signal<string | null>(null),
      statusFilter: signal<string>('ALL'),
      topicFilter: signal<string>('ALL'),
      searchQuery: signal<string>(''),
      kpiSummary: vi.fn().mockReturnValue({
        totalEvents: 2,
        pendingCount: 1,
        replayedCount: 1,
        discardedCount: 0,
        outboxLag: 4,
        brokerHealth: 'HEALTHY',
      }),
      loadEvents: vi.fn(),
      loadObservabilityStats: vi.fn(),
      selectEvent: vi.fn(),
      setStatusFilter: vi.fn(),
      setTopicFilter: vi.fn(),
      setSearchQuery: vi.fn(),
    };
    component = new DlqOpsComponent(mockDlqService);
  });

  it('should initialize and load events and stats on ngOnInit', () => {
    component.ngOnInit();

    expect(mockDlqService.loadEvents).toHaveBeenCalled();
    expect(mockDlqService.loadObservabilityStats).toHaveBeenCalled();
    expect(component.kpi().pendingCount).toBe(1);
    expect(component.kpi().brokerHealth).toBe('HEALTHY');
  });

  it('should delegate filter changes to dlqService', () => {
    component.onSearchChange('dlq-1');
    expect(mockDlqService.setSearchQuery).toHaveBeenCalledWith('dlq-1');

    component.onStatusChange('PENDING');
    expect(mockDlqService.setStatusFilter).toHaveBeenCalledWith('PENDING');

    component.onTopicChange('TRANSACTION_EVENTS');
    expect(mockDlqService.setTopicFilter).toHaveBeenCalledWith('TRANSACTION_EVENTS');

    mockDlqService.statusFilter.set('PENDING');
    expect(component.hasActiveFilters()).toBe(true);

    component.resetFilters();
    expect(mockDlqService.setStatusFilter).toHaveBeenCalledWith('ALL');
    expect(mockDlqService.setTopicFilter).toHaveBeenCalledWith('ALL');
    expect(mockDlqService.setSearchQuery).toHaveBeenCalledWith('');
  });

  it('should open and close event drawer and select event in service', () => {
    component.openEventDrawer(mockEvents[0]);

    expect(component.isDrawerOpen()).toBe(true);
    expect(component.selectedEventForDrawer()).toEqual(mockEvents[0]);
    expect(mockDlqService.selectEvent).toHaveBeenCalledWith(mockEvents[0]);

    component.closeEventDrawer();
    expect(component.isDrawerOpen()).toBe(false);
    expect(component.selectedEventForDrawer()).toBeNull();
  });

  it('should handle single event replay workflow', () => {
    component.openReplayModal(mockEvents[0]);

    expect(component.isReplayModalOpen()).toBe(true);
    expect(component.selectedEventForAction()).toEqual(mockEvents[0]);
    expect(component.bulkReplayConfig().active).toBe(false);

    component.onEventReplayed(mockEvents[0]);

    expect(component.isReplayModalOpen()).toBe(false);
    expect(component.toastMessage()).toContain('Event dlq-1 successfully submitted for replay');
  });

  it('should handle bulk replay workflow', () => {
    component.openBulkReplayModal();

    expect(component.isReplayModalOpen()).toBe(true);
    expect(component.bulkReplayConfig().active).toBe(true);
    expect(component.bulkReplayConfig().count).toBe(1);

    component.onEventReplayed(3);

    expect(component.isReplayModalOpen()).toBe(false);
    expect(component.toastMessage()).toContain('Bulk recovery executed: 3 pending events');
  });

  it('should handle event discard workflow', () => {
    component.openDiscardModal(mockEvents[0]);

    expect(component.isDiscardModalOpen()).toBe(true);
    expect(component.selectedEventForAction()).toEqual(mockEvents[0]);

    component.onEventDiscarded(mockEvents[0]);

    expect(component.isDiscardModalOpen()).toBe(false);
    expect(component.toastMessage()).toContain('Event dlq-1 permanently discarded');
  });

  it('should allow replay and discard only on PENDING events', () => {
    expect(component.canReplay(mockEvents[0])).toBe(true);
    expect(component.canDiscard(mockEvents[0])).toBe(true);

    expect(component.canReplay(mockEvents[1])).toBe(false);
    expect(component.canDiscard(mockEvents[1])).toBe(false);
  });
});
