import { describe, it, expect } from 'vitest';
import { Currency } from '@ble-frontend/domain-types';
import { mapStatementResponseToDomain } from './types';

describe('Account Statement Domain Mapping', () => {
  it('maps AccountStatementResponse DTO to domain model with immutable Money objects', () => {
    const dto = {
      id: 'stmt-001',
      accountId: 'acc-123',
      fromDate: '2026-09-01',
      toDate: '2026-09-23',
      currency: 'EUR',
      openingBalance: 1000.5,
      closingBalance: 1250.75,
      totalCredits: 350.25,
      totalDebits: 100.0,
      entryCount: 2,
      generatedAt: '2026-09-23T16:00:00Z',
      entries: [
        {
          entryId: 'entry-1',
          transactionId: 'tx-1',
          entryDate: '2026-09-05T10:00:00Z',
          valueDate: '2026-09-05T10:00:00Z',
          description: 'Client transfer received',
          reference: 'REF-001',
          debitAmount: 0,
          creditAmount: 350.25,
          runningBalance: 1350.75,
        },
        {
          entryId: 'entry-2',
          transactionId: 'tx-2',
          entryDate: '2026-09-10T14:30:00Z',
          valueDate: '2026-09-10T14:30:00Z',
          description: 'Merchant payment',
          reference: 'REF-002',
          debitAmount: 100.0,
          creditAmount: 0,
          runningBalance: 1250.75,
        },
      ],
    };

    const domain = mapStatementResponseToDomain(dto);

    expect(domain.id).toBe('stmt-001');
    expect(domain.accountId).toBe('acc-123');
    expect(domain.currency).toBe(Currency.EUR);
    expect(domain.openingBalance.format()).toContain('1,000.50');
    expect(domain.closingBalance.format()).toContain('1,250.75');
    expect(domain.totalCredits.format()).toContain('350.25');
    expect(domain.totalDebits.format()).toContain('100.00');
    expect(domain.entries).toHaveLength(2);

    expect(domain.entries[0].creditAmount.format()).toContain('350.25');
    expect(domain.entries[1].debitAmount.format()).toContain('100.00');
    expect(domain.entries[1].runningBalance.format()).toContain('1,250.75');
  });

  it('handles empty entries and defaults missing values safely', () => {
    const dto = {};
    const domain = mapStatementResponseToDomain(dto);

    expect(domain.id).toBe('');
    expect(domain.currency).toBe(Currency.EUR);
    expect(domain.openingBalance.isZero()).toBe(true);
    expect(domain.closingBalance.isZero()).toBe(true);
    expect(domain.entries).toEqual([]);
    expect(domain.entryCount).toBe(0);
  });
});
