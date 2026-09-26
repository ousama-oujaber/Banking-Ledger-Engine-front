/**
 * Shared mock data sets for Playwright E2E Integration Suite.
 */

export const MOCK_ACCOUNTS = [
  {
    id: 'acc-eur-001',
    accountNumber: 'NL91BLEB0123456789',
    ownerId: 'cust-e2e-01',
    type: 'CHECKING',
    currency: 'EUR',
    balance: { amount: 15450.75, currency: 'EUR' },
    derivedBalance: { amount: 15450.75, currency: 'EUR' },
    availableBalance: { amount: 15450.75, currency: 'EUR' },
    status: 'ACTIVE',
    label: 'Primary Operating EUR',
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-09-26T12:00:00Z',
  },
  {
    id: 'acc-usd-002',
    accountNumber: 'US82BLEB9876543210',
    ownerId: 'cust-e2e-01',
    type: 'SAVINGS',
    currency: 'USD',
    balance: { amount: 28500.0, currency: 'USD' },
    derivedBalance: { amount: 28500.0, currency: 'USD' },
    availableBalance: { amount: 28500.0, currency: 'USD' },
    status: 'ACTIVE',
    label: 'Treasury Reserve USD',
    createdAt: '2026-02-10T14:30:00Z',
    updatedAt: '2026-09-26T12:00:00Z',
  },
  {
    id: 'acc-gbp-003',
    accountNumber: 'GB44BLEB1122334455',
    ownerId: 'cust-e2e-02',
    type: 'SETTLEMENT',
    currency: 'GBP',
    balance: { amount: 0.0, currency: 'GBP' },
    derivedBalance: { amount: 0.0, currency: 'GBP' },
    availableBalance: { amount: 0.0, currency: 'GBP' },
    status: 'ACTIVE',
    label: 'Clearing Escrow GBP',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-09-26T12:00:00Z',
  },
  {
    id: 'acc-eur-004',
    accountNumber: 'NL92BLEB9988776655',
    ownerId: 'cust-e2e-03',
    type: 'CHECKING',
    currency: 'EUR',
    balance: { amount: 3200.0, currency: 'EUR' },
    derivedBalance: { amount: 3200.0, currency: 'EUR' },
    availableBalance: { amount: 3200.0, currency: 'EUR' },
    status: 'ACTIVE',
    label: 'Destination Partner EUR',
    createdAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-09-26T12:00:00Z',
  },
];

export const MOCK_TRANSFER_SUCCESS = {
  id: 'tx-e2e-998811',
  reference: 'TRF-E2E-SUCCESS-01',
  fromAccountId: 'acc-eur-001',
  toAccountId: 'acc-usd-002',
  amount: 250.0,
  currency: 'EUR',
  status: 'COMPLETED',
  createdAt: new Date().toISOString(),
  description: 'Automated E2E Test Transfer',
};

export const MOCK_SETTLEMENT_BATCHES = [
  {
    id: 'batch-sepa-001',
    paymentRail: 'SEPA_INSTANT',
    status: 'OPEN',
    businessDate: '2026-09-26',
    grossDebit: 45000.0,
    grossCredit: 38000.0,
    netVolume: 7000.0,
    currency: 'EUR',
    recordCount: 142,
    externalBatchReference: 'EXT-SEPA-20260926-01',
    createdAt: '2026-09-26T08:00:00Z',
    updatedAt: '2026-09-26T12:00:00Z',
  },
  {
    id: 'batch-target2-002',
    paymentRail: 'TARGET2',
    status: 'SETTLED',
    businessDate: '2026-09-25',
    grossDebit: 120000.0,
    grossCredit: 120000.0,
    netVolume: 0.0,
    currency: 'EUR',
    recordCount: 35,
    externalBatchReference: 'EXT-T2-20260925-09',
    createdAt: '2026-09-25T07:00:00Z',
    updatedAt: '2026-09-25T17:00:00Z',
  },
];

export const MOCK_BATCH_RECORDS = [
  {
    id: 'rec-001',
    batchId: 'batch-sepa-001',
    entryType: 'DEBIT',
    amount: 1500.0,
    currency: 'EUR',
    sourceAccount: 'acc-eur-001',
    targetAccount: 'NL99INGB000111222',
    status: 'PENDING',
    createdAt: '2026-09-26T08:15:00Z',
  },
];

export const MOCK_RECON_CASES = [
  {
    id: 'case-discrepancy-001',
    batchId: 'batch-sepa-001',
    reconciliationId: 'recon-run-20260926-01',
    internalReference: 'TX-REF-1092',
    externalReference: 'CAMT053-EXT-8871',
    differenceAmount: 50.25,
    currency: 'EUR',
    discrepancyType: 'TIMING_DIFFERENCE',
    status: 'OPEN',
    detectedAt: '2026-09-26T09:30:00Z',
    assignedTo: 'bob_operator',
    notes: 'Awaiting end-of-day bank statement reconciliation',
  },
];

export const MOCK_DLQ_EVENTS = [
  {
    id: 'dlq-evt-001',
    topic: 'ledger.transaction.posted',
    partition: 2,
    offset: 104928,
    error: 'OptimisticLockingFailureException: Object of class Transaction has been modified',
    stackTrace:
      'org.springframework.orm.ObjectOptimisticLockingFailureException: Transaction modified\n\tat com.ble.ledger.service.PostingService.post(PostingService.java:182)\n\tat com.ble.ledger.kafka.TransactionListener.onMessage(TransactionListener.java:64)',
    status: 'PENDING',
    retryCount: 3,
    maxRetries: 3,
    createdAt: '2026-09-26T14:15:00Z',
    payload: JSON.stringify(
      {
        transactionId: 'tx-fail-991',
        fromAccount: 'acc-eur-001',
        toAccount: 'acc-usd-002',
        amount: 150.0,
        currency: 'EUR',
      },
      null,
      2,
    ),
    headers: {
      traceId: 'trc-dlq-001-9988',
      correlationId: 'corr-tx-fail-991',
      eventType: 'ledger.transaction.posted',
    },
  },
];

export const MOCK_OBSERVABILITY_STATS = {
  activeBrokers: 3,
  outboxLag: 0,
  unprocessedEvents: 1,
  deadLetterCount: 1,
  replayedCount: 12,
  discardedCount: 2,
  uptimeSeconds: 864000,
};
