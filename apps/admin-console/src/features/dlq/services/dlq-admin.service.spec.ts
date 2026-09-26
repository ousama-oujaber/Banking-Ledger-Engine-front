import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DlqAdminService } from './dlq-admin.service';
import * as apiClient from '@ble-frontend/api-client';

vi.mock('@ble-frontend/api-client', async () => {
  const actual = await vi.importActual<typeof apiClient>('@ble-frontend/api-client');
  return {
    ...actual,
    getDeadLetterEvents: vi.fn(),
    replayDeadLetterEvent: vi.fn(),
    discardDeadLetterEvent: vi.fn(),
    getObservabilityStats: vi.fn(),
  };
});

describe('DlqAdminService', () => {
  let service: DlqAdminService;

  const mockEvents: apiClient.DeadLetterEventResponse[] = [
    {
      id: 'dlq-001',
      originalEventId: 'evt-101',
      topic: 'TRANSACTION_EVENTS',
      partitionKey: 'acc-123',
      eventType: 'MoneyTransferredEvent',
      aggregateType: 'Account',
      aggregateId: 'acc-123',
      payload: '{"amount": 500, "currency": "EUR"}',
      errorMessage: 'Database timeout while committing transaction',
      stackTrace: 'java.sql.SQLException: Connection timeout\n\tat com.ble.Repo.save()',
      retryCount: 3,
      maxRetries: 3,
      status: 'PENDING',
      createdAt: '2026-09-26T12:00:00Z',
    },
    {
      id: 'dlq-002',
      originalEventId: 'evt-102',
      topic: 'ACCOUNT_EVENTS',
      partitionKey: 'acc-456',
      eventType: 'AccountFrozenEvent',
      aggregateType: 'Account',
      aggregateId: 'acc-456',
      payload: '{"reason": "AML Review"}',
      errorMessage: 'Serialization error in JSON reader',
      retryCount: 1,
      maxRetries: 3,
      status: 'REPLAYED',
      createdAt: '2026-09-26T11:00:00Z',
    },
    {
      id: 'dlq-003',
      originalEventId: 'evt-103',
      topic: 'SETTLEMENT_EVENTS',
      partitionKey: 'batch-789',
      eventType: 'BatchSettledEvent',
      aggregateType: 'SettlementBatch',
      aggregateId: 'batch-789',
      payload: '{"rail": "SEPA"}',
      errorMessage: 'Corrupt clearing network response payload',
      retryCount: 3,
      maxRetries: 3,
      status: 'DISCARDED',
      createdAt: '2026-09-26T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DlqAdminService();
  });

  it('should initialize with default states and empty collections', () => {
    expect(service.events()).toEqual([]);
    expect(service.selectedEvent()).toBeNull();
    expect(service.observabilityStats()).toBeNull();
    expect(service.statusFilter()).toBe('ALL');
    expect(service.topicFilter()).toBe('ALL');
    expect(service.searchQuery()).toBe('');
    expect(service.loading()).toBe(false);
    expect(service.mutating()).toBe(false);
    expect(service.error()).toBeNull();
  });

  describe('loadEvents', () => {
    it('should successfully fetch and set events', async () => {
      vi.mocked(apiClient.getDeadLetterEvents).mockResolvedValue(mockEvents);

      await service.loadEvents('PENDING', 'TRANSACTION_EVENTS');

      expect(apiClient.getDeadLetterEvents).toHaveBeenCalledWith({
        status: 'PENDING',
        topic: 'TRANSACTION_EVENTS',
        limit: 100,
      });
      expect(service.events()).toEqual(mockEvents);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(apiClient.getDeadLetterEvents).mockRejectedValue(new Error('Broker unreachable'));

      await service.loadEvents();

      expect(service.events()).toEqual([]);
      expect(service.error()).toBe('Broker unreachable');
      expect(service.loading()).toBe(false);
    });
  });

  describe('loadObservabilityStats', () => {
    it('should load broker stats and update signal', async () => {
      const stats: apiClient.ObservabilityStatsResponse = {
        outboxLag: 5,
        totalDeadLetterCount: 3,
        healthStatus: 'HEALTHY',
      };
      vi.mocked(apiClient.getObservabilityStats).mockResolvedValue(stats);

      await service.loadObservabilityStats();

      expect(service.observabilityStats()).toEqual(stats);
      expect(service.statsLoading()).toBe(false);
    });
  });

  describe('filteredEvents', () => {
    beforeEach(() => {
      service.events.set(mockEvents);
    });

    it('should filter events by status', () => {
      service.setStatusFilter('PENDING');
      expect(service.filteredEvents()).toEqual([mockEvents[0]]);
    });

    it('should filter events by topic', () => {
      service.setTopicFilter('ACCOUNT_EVENTS');
      expect(service.filteredEvents()).toEqual([mockEvents[1]]);
    });

    it('should filter events by search query across multiple fields', () => {
      service.setSearchQuery('acc-123');
      expect(service.filteredEvents()).toEqual([mockEvents[0]]);

      service.setSearchQuery('Serialization');
      expect(service.filteredEvents()).toEqual([mockEvents[1]]);
    });
  });

  describe('kpiSummary', () => {
    it('should calculate KPI counts and broker health accurately', () => {
      service.events.set(mockEvents);
      service.observabilityStats.set({
        outboxLag: 8,
        healthStatus: 'HEALTHY',
      });

      const kpis = service.kpiSummary();
      expect(kpis.totalEvents).toBe(3);
      expect(kpis.pendingCount).toBe(1);
      expect(kpis.replayedCount).toBe(1);
      expect(kpis.discardedCount).toBe(1);
      expect(kpis.outboxLag).toBe(8);
      expect(kpis.brokerHealth).toBe('HEALTHY');
    });

    it('should compute degraded health when pending dead letters or lag are elevated', () => {
      const manyPending = Array.from({ length: 15 }, (_, i) => ({
        id: `dlq-${i}`,
        status: 'PENDING' as const,
      }));
      service.events.set(manyPending);
      service.observabilityStats.set({ outboxLag: 25 });

      const kpis = service.kpiSummary();
      expect(kpis.brokerHealth).toBe('DEGRADED');
    });
  });

  describe('event mutations', () => {
    beforeEach(() => {
      service.events.set([...mockEvents]);
      service.selectedEvent.set(mockEvents[0]);
    });

    it('should replay an event and mark as REPLAYED', async () => {
      const replayedResult: apiClient.DeadLetterEventResponse = {
        ...mockEvents[0],
        status: 'REPLAYED',
      };
      vi.mocked(apiClient.replayDeadLetterEvent).mockResolvedValue(replayedResult);

      const res = await service.replayEvent('dlq-001');

      expect(apiClient.replayDeadLetterEvent).toHaveBeenCalledWith({ id: 'dlq-001' });
      expect(res.status).toBe('REPLAYED');
      expect(service.events().find((e) => e.id === 'dlq-001')?.status).toBe('REPLAYED');
      expect(service.selectedEvent()?.status).toBe('REPLAYED');
    });

    it('should discard an event and mark as DISCARDED', async () => {
      const discardedResult: apiClient.DeadLetterEventResponse = {
        ...mockEvents[0],
        status: 'DISCARDED',
      };
      vi.mocked(apiClient.discardDeadLetterEvent).mockResolvedValue(discardedResult);

      const res = await service.discardEvent('dlq-001');

      expect(apiClient.discardDeadLetterEvent).toHaveBeenCalledWith({ id: 'dlq-001' });
      expect(res.status).toBe('DISCARDED');
      expect(service.events().find((e) => e.id === 'dlq-001')?.status).toBe('DISCARDED');
      expect(service.selectedEvent()?.status).toBe('DISCARDED');
    });

    it('should replay all pending events and refresh list', async () => {
      vi.mocked(apiClient.replayDeadLetterEvent).mockResolvedValue(mockEvents[0]);
      vi.mocked(apiClient.getDeadLetterEvents).mockResolvedValue([]);

      const count = await service.replayAllPending();

      expect(count).toBe(1);
      expect(apiClient.replayDeadLetterEvent).toHaveBeenCalledWith({ id: 'dlq-001' });
      expect(apiClient.getDeadLetterEvents).toHaveBeenCalled();
    });
  });

  describe('selection management', () => {
    it('should set and clear selected event', () => {
      service.selectEvent(mockEvents[0]);
      expect(service.selectedEvent()).toEqual(mockEvents[0]);

      service.clearSelection();
      expect(service.selectedEvent()).toBeNull();
    });
  });
});
