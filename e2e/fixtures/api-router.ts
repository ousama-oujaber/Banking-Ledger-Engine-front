import type { Page, Route } from '@playwright/test';
import {
  MOCK_ACCOUNTS,
  MOCK_TRANSFER_SUCCESS,
  MOCK_SETTLEMENT_BATCHES,
  MOCK_BATCH_RECORDS,
  MOCK_RECON_CASES,
  MOCK_DLQ_EVENTS,
  MOCK_OBSERVABILITY_STATS,
} from './mock-data';
import { MOCK_TOKENS } from './jwt-tokens';

export interface SetupApiRoutesOptions {
  authRole?: 'CUSTOMER' | 'OPERATOR' | 'ADMIN';
  transferStatus?: number;
  transferErrorResponse?: Record<string, unknown>;
  onTransferRequest?: (payload: Record<string, unknown>) => void;
}

/**
 * Intercepts all backend API calls (/api/v1/*) with high-fidelity mock responses.
 * Guarantees tests run deterministically and fast without relying on live backend services.
 */
export async function setupMockApiRoutes(page: Page, options: SetupApiRoutesOptions = {}) {
  const currentAccounts = JSON.parse(JSON.stringify(MOCK_ACCOUNTS));
  const currentBatches = JSON.parse(JSON.stringify(MOCK_SETTLEMENT_BATCHES));
  const currentCases = JSON.parse(JSON.stringify(MOCK_RECON_CASES));
  const currentDlqEvents = JSON.parse(JSON.stringify(MOCK_DLQ_EVENTS));

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    // 1. Auth Endpoint
    if (url.includes('/api/v1/auth/token') && method === 'POST') {
      const token =
        options.authRole === 'OPERATOR'
          ? MOCK_TOKENS.operator
          : options.authRole === 'ADMIN'
            ? MOCK_TOKENS.admin
            : MOCK_TOKENS.customer;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token }),
      });
    }

    // 2. Transfer Mutation
    if (url.includes('/api/v1/transfers') && method === 'POST') {
      const postData = request.postDataJSON() || {};
      options.onTransferRequest?.(postData);

      if (options.transferStatus && options.transferStatus >= 400) {
        return route.fulfill({
          status: options.transferStatus,
          contentType: 'application/json',
          body: JSON.stringify(
            options.transferErrorResponse || {
              type: 'https://ble.bank/errors/OPTIMISTIC_LOCK_CONFLICT',
              title: 'Conflict',
              status: options.transferStatus,
              detail: 'Concurrent transaction in progress. Please retry.',
              code: 'ERR_OPTIMISTIC_LOCK',
            },
          ),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_TRANSFER_SUCCESS,
          reference: postData.reference || MOCK_TRANSFER_SUCCESS.reference,
          amount: postData.amount?.amount ?? postData.amount ?? 250,
          fromAccountId: postData.fromAccountId || MOCK_TRANSFER_SUCCESS.fromAccountId,
          toAccountId: postData.toAccountId || MOCK_TRANSFER_SUCCESS.toAccountId,
        }),
      });
    }

    // 3. Deposit / Withdraw Cash Operations
    if (url.includes('/deposit') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'dep-e2e-101', status: 'COMPLETED' }),
      });
    }

    if (url.includes('/withdraw') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'wdr-e2e-101', status: 'COMPLETED' }),
      });
    }

    // 4. Accounts Endpoints (both /api/v1/accounts and /api/v1/customers/{id}/accounts)
    if (url.includes('/accounts') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentAccounts),
      });
    }

    // Account Freeze
    if (url.match(/\/api\/v1\/accounts\/[^/]+\/freeze/) && method === 'POST') {
      const match = url.match(/\/api\/v1\/accounts\/([^/]+)\/freeze/);
      const accId = match ? match[1] : '';
      const target = currentAccounts.find((a: { id: string }) => a.id === accId);
      if (target) {
        target.status = 'FROZEN';
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target || { id: accId, status: 'FROZEN' }),
      });
    }

    // Account Unfreeze
    if (url.match(/\/api\/v1\/accounts\/[^/]+\/unfreeze/) && method === 'POST') {
      const match = url.match(/\/api\/v1\/accounts\/([^/]+)\/unfreeze/);
      const accId = match ? match[1] : '';
      const target = currentAccounts.find((a: { id: string }) => a.id === accId);
      if (target) {
        target.status = 'ACTIVE';
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target || { id: accId, status: 'ACTIVE' }),
      });
    }

    // 5. Settlement Endpoints (/api/v1/settlements/batches*)
    if (url.includes('/batches') && method === 'GET') {
      if (url.includes('/records')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_BATCH_RECORDS),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentBatches),
      });
    }

    if (url.includes('/batches') && method === 'POST') {
      if (url.includes('/settle')) {
        const match = url.match(/\/batches\/([^/]+)\/settle/);
        const bId = match ? match[1] : '';
        const b = currentBatches.find((item: { id: string }) => item.id === bId);
        if (b) b.status = 'SETTLED';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(b || { id: bId, status: 'SETTLED' }),
        });
      }

      // Create new batch
      const postData = request.postDataJSON() || {};
      const newBatch = {
        id: `batch-${Date.now().toString().slice(-4)}`,
        paymentRail: postData.paymentRail || 'SEPA_INSTANT',
        businessDate: postData.businessDate || new Date().toISOString().slice(0, 10),
        status: 'OPEN',
        grossDebit: 0,
        grossCredit: 0,
        netVolume: 0,
        currency: 'EUR',
        recordCount: 0,
        externalBatchReference: postData.externalBatchReference || 'EXT-NEW-BATCH',
        createdAt: new Date().toISOString(),
      };
      currentBatches.unshift(newBatch);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newBatch),
      });
    }

    // 6. Reconciliation Endpoints (/api/v1/reconciliation/cases*)
    if (url.includes('/reconciliation/cases') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentCases),
      });
    }

    if (url.includes('/reconciliation/cases') && url.includes('/resolve') && method === 'POST') {
      const match = url.match(/\/reconciliation\/cases\/([^/]+)\/resolve/);
      const cId = match ? match[1] : '';
      const c = currentCases.find((item: { id: string }) => item.id === cId);
      if (c) c.status = 'RESOLVED';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(c || { id: cId, status: 'RESOLVED' }),
      });
    }

    if (url.includes('/reconciliation/jobs')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    // 7. DLQ & Observability Endpoints
    if (url.includes('/observability/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OBSERVABILITY_STATS),
      });
    }

    if (url.includes('/dead-letter-events') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentDlqEvents),
      });
    }

    if (url.includes('/dead-letter-events') && url.includes('/retry') && method === 'POST') {
      const match = url.match(/\/dead-letter-events\/([^/]+)\/retry/);
      const eventId = match ? match[1] : 'dlq-evt-001';
      const evt = currentDlqEvents.find((e: { id: string }) => e.id === eventId);
      if (evt) evt.status = 'REPLAYED';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(evt || { id: eventId, status: 'REPLAYED' }),
      });
    }

    if (url.includes('/dead-letter-events') && method === 'DELETE') {
      const match = url.match(/\/dead-letter-events\/([^/?]+)/);
      const eventId = match ? match[1] : '';
      const idx = currentDlqEvents.findIndex((e: { id: string }) => e.id === eventId);
      let removed = { id: eventId, status: 'DISCARDED' };
      if (idx !== -1) {
        removed = { ...currentDlqEvents[idx], status: 'DISCARDED' };
        currentDlqEvents.splice(idx, 1);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(removed),
      });
    }

    // Default fallback
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}
