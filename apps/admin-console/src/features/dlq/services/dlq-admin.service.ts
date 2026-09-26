import { Injectable, signal, computed } from '@angular/core';
import {
  getDeadLetterEvents,
  replayDeadLetterEvent,
  discardDeadLetterEvent,
  getObservabilityStats,
  type DeadLetterEventResponse,
  type ObservabilityStatsResponse,
  type GetDeadLetterEventsData,
} from '@ble-frontend/api-client';

/**
 * KPI aggregations for Dead-Letter Queue & Broker Diagnostics.
 */
export interface DlqKpiSummary {
  totalEvents: number;
  pendingCount: number;
  replayedCount: number;
  discardedCount: number;
  outboxLag: number;
  brokerHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

/**
 * DlqAdminService
 *
 * Angular 19 signals-based reactive state service managing:
 * - Dead-lettered outbox events and broker delivery failures (FR-OPS-AUDIT-02)
 * - Real-time filtering by status, topic, and message query
 * - Manual event replay into the broker distribution pipeline
 * - Permanent discard of poisoned or unroutable records
 * - Broker lag and health telemetry tracking
 */
@Injectable({
  providedIn: 'root',
})
export class DlqAdminService {
  // State Signals
  readonly events = signal<DeadLetterEventResponse[]>([]);
  readonly selectedEvent = signal<DeadLetterEventResponse | null>(null);
  readonly observabilityStats = signal<ObservabilityStatsResponse | null>(null);

  // Loading & Mutation State Signals
  readonly loading = signal<boolean>(false);
  readonly statsLoading = signal<boolean>(false);
  readonly mutating = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filter Signals
  readonly statusFilter = signal<string>('ALL');
  readonly topicFilter = signal<string>('ALL');
  readonly searchQuery = signal<string>('');

  /**
   * Filtered dead-letter events reactive computed signal.
   */
  readonly filteredEvents = computed<DeadLetterEventResponse[]>(() => {
    const status = this.statusFilter();
    const topic = this.topicFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.events().filter((e) => {
      // Filter by Status (PENDING, REPLAYED, DISCARDED)
      if (status !== 'ALL' && e.status?.toUpperCase() !== status.toUpperCase()) {
        return false;
      }
      // Filter by Topic
      if (topic !== 'ALL' && e.topic?.toUpperCase() !== topic.toUpperCase()) {
        return false;
      }
      // Filter by Search Query
      if (query.length > 0) {
        const idMatch = e.id?.toLowerCase().includes(query) ?? false;
        const origIdMatch = e.originalEventId?.toLowerCase().includes(query) ?? false;
        const aggIdMatch = e.aggregateId?.toLowerCase().includes(query) ?? false;
        const errMsgMatch = e.errorMessage?.toLowerCase().includes(query) ?? false;
        const topicMatch = e.topic?.toLowerCase().includes(query) ?? false;
        const eventTypeMatch = e.eventType?.toLowerCase().includes(query) ?? false;
        if (!idMatch && !origIdMatch && !aggIdMatch && !errMsgMatch && !topicMatch && !eventTypeMatch) {
          return false;
        }
      }
      return true;
    });
  });

  /**
   * Computed KPI summary statistics across all loaded dead-letter events and broker telemetry.
   */
  readonly kpiSummary = computed<DlqKpiSummary>(() => {
    const list = this.events();
    const stats = this.observabilityStats();

    let pendingCount = 0;
    let replayedCount = 0;
    let discardedCount = 0;

    for (const e of list) {
      const st = (e.status || 'PENDING').toUpperCase();
      if (st === 'PENDING') {
        pendingCount++;
      } else if (st === 'REPLAYED') {
        replayedCount++;
      } else if (st === 'DISCARDED') {
        discardedCount++;
      }
    }

    const outboxLag = stats?.outboxLag ?? 0;
    let brokerHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';

    if (stats?.healthStatus) {
      const hs = stats.healthStatus.toUpperCase();
      if (hs === 'CRITICAL' || hs === 'DOWN') {
        brokerHealth = 'CRITICAL';
      } else if (hs === 'DEGRADED' || hs === 'WARNING') {
        brokerHealth = 'DEGRADED';
      }
    } else {
      if (pendingCount > 50 || outboxLag > 100) {
        brokerHealth = 'CRITICAL';
      } else if (pendingCount > 10 || outboxLag > 20) {
        brokerHealth = 'DEGRADED';
      }
    }

    return {
      totalEvents: list.length,
      pendingCount,
      replayedCount,
      discardedCount,
      outboxLag,
      brokerHealth,
    };
  });

  /**
   * Load dead-letter events from backend.
   */
  async loadEvents(status?: string, topic?: string, limit?: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const queryStatus =
        status && status !== 'ALL' ? (status as GetDeadLetterEventsData['status']) : undefined;
      const queryTopic =
        topic && topic !== 'ALL' ? (topic as GetDeadLetterEventsData['topic']) : undefined;

      const data = await getDeadLetterEvents({
        status: queryStatus,
        topic: queryTopic,
        limit: limit || 100,
      });

      this.events.set(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve dead-letter events';
      this.error.set(msg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load observability and broker outbox statistics.
   */
  async loadObservabilityStats(): Promise<void> {
    this.statsLoading.set(true);
    try {
      const stats = await getObservabilityStats();
      this.observabilityStats.set(stats);
    } catch {
      // Retain optimistic stats if telemetry endpoint is unavailable
    } finally {
      this.statsLoading.set(false);
    }
  }

  /**
   * Replay a failed event back into the message broker pipeline.
   */
  async replayEvent(id: string): Promise<DeadLetterEventResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const replayed = await replayDeadLetterEvent({ id });

      this.events.update((items) =>
        items.map((item) =>
          item.id === id ? { ...item, ...replayed, status: 'REPLAYED' } : item
        )
      );

      if (this.selectedEvent()?.id === id) {
        this.selectedEvent.set({ ...this.selectedEvent(), ...replayed, status: 'REPLAYED' });
      }

      return replayed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to replay event ${id}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Discard an unrecoverable event permanently.
   */
  async discardEvent(id: string): Promise<DeadLetterEventResponse> {
    this.mutating.set(true);
    this.error.set(null);

    try {
      const discarded = await discardDeadLetterEvent({ id });

      this.events.update((items) =>
        items.map((item) =>
          item.id === id ? { ...item, ...discarded, status: 'DISCARDED' } : item
        )
      );

      if (this.selectedEvent()?.id === id) {
        this.selectedEvent.set({ ...this.selectedEvent(), ...discarded, status: 'DISCARDED' });
      }

      return discarded;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to discard event ${id}`;
      this.error.set(msg);
      throw err;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Replay all pending events currently visible in the active filtered view.
   */
  async replayAllPending(): Promise<number> {
    const pending = this.filteredEvents().filter((e) => (e.status || 'PENDING') === 'PENDING');
    if (pending.length === 0) return 0;

    this.mutating.set(true);
    this.error.set(null);

    let successCount = 0;
    try {
      for (const e of pending) {
        if (e.id) {
          try {
            await replayDeadLetterEvent({ id: e.id });
            successCount++;
          } catch {
            // Continue best-effort for remaining events
          }
        }
      }
      // Refresh event list to reflect updated states
      await this.loadEvents(this.statusFilter(), this.topicFilter());
      return successCount;
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Select an event for drawer inspection.
   */
  selectEvent(event: DeadLetterEventResponse | null): void {
    this.selectedEvent.set(event);
  }

  /**
   * Clear active selection.
   */
  clearSelection(): void {
    this.selectedEvent.set(null);
  }

  /**
   * Filter modifiers.
   */
  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  setTopicFilter(topic: string): void {
    this.topicFilter.set(topic);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }
}
