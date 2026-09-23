import { describe, it, expect } from 'vitest';
import { Currency, TransactionState, TransactionType, EntryType } from '@ble-frontend/domain-types';
import { mapEntryResponseToDomain, mapTransactionResponseToDomain } from './types';
import type { TransactionResponse, EntryResponse } from '@ble-frontend/api-client';

describe('Transaction Domain Mapping (types.ts)', () => {
  it('maps EntryResponse with explicit amount DTO', () => {
    const entryDto: EntryResponse = {
      id: 'entry-101',
      accountId: 'acc-1',
      type: 'DEBIT',
      amount: { amount: 150.25, currency: 'USD' },
      createdAt: '2026-09-22T10:00:00Z',
      holdCaptured: true,
    };

    const domain = mapEntryResponseToDomain(entryDto, Currency.EUR);

    expect(domain.id).toBe('entry-101');
    expect(domain.accountId).toBe('acc-1');
    expect(domain.type).toBe('DEBIT');
    expect(domain.amount.amount.toFixed()).toBe('150.25');
    expect(domain.amount.currency).toBe(Currency.USD);
    expect(domain.holdCaptured).toBe(true);
  });

  it('maps EntryResponse with legacy debit/credit float fields', () => {
    const debitEntry: EntryResponse = {
      id: 'entry-deb',
      accountId: 'acc-2',
      debit: 50.0,
    };
    const domainDeb = mapEntryResponseToDomain(debitEntry, Currency.EUR);
    expect(domainDeb.type).toBe(EntryType.DEBIT);
    expect(domainDeb.amount.format()).toBe('€50.00');

    const creditEntry: EntryResponse = {
      id: 'entry-cred',
      accountId: 'acc-3',
      credit: 50.0,
    };
    const domainCred = mapEntryResponseToDomain(creditEntry, Currency.GBP);
    expect(domainCred.type).toBe(EntryType.CREDIT);
    expect(domainCred.amount.currency).toBe('GBP');

    const emptyEntry: EntryResponse = {
      id: 'entry-empty',
      accountId: 'acc-4',
    };
    const domainEmpty = mapEntryResponseToDomain(emptyEntry, Currency.EUR);
    expect(domainEmpty.amount.isZero()).toBe(true);
  });

  it('maps full TransactionResponse to domain Transaction model', () => {
    const txDto: TransactionResponse = {
      id: 'tx-full',
      type: 'TRANSFER',
      amount: { amount: 1000, currency: 'EUR' },
      reference: 'REF-TX-FULL',
      description: 'Monthly Rent',
      state: 'SETTLED',
      sourceAccountId: 'acc-src',
      destinationAccountId: 'acc-dst',
      createdAt: '2026-09-22T08:00:00Z',
      postedAt: '2026-09-22T08:01:00Z',
      settledAt: '2026-09-22T08:02:00Z',
      feeAmount: { amount: 2.5, currency: 'EUR' },
      taxAmount: { amount: 0.5, currency: 'EUR' },
      exchangeRate: 1.0,
      sourceCurrency: 'EUR',
      targetCurrency: 'EUR',
      entries: [
        {
          id: 'e1',
          accountId: 'acc-src',
          type: 'DEBIT',
          amount: { amount: 1000, currency: 'EUR' },
        },
        {
          id: 'e2',
          accountId: 'acc-dst',
          type: 'CREDIT',
          amount: { amount: 1000, currency: 'EUR' },
        },
      ],
    };

    const domain = mapTransactionResponseToDomain(txDto);

    expect(domain.id).toBe('tx-full');
    expect(domain.type).toBe(TransactionType.TRANSFER);
    expect(domain.amount.format()).toBe('€1,000.00');
    expect(domain.reference).toBe('REF-TX-FULL');
    expect(domain.state).toBe(TransactionState.SETTLED);
    expect(domain.sourceAccountId).toBe('acc-src');
    expect(domain.destinationAccountId).toBe('acc-dst');
    expect(domain.feeAmount?.format()).toBe('€2.50');
    expect(domain.taxAmount?.format()).toBe('€0.50');
    expect(domain.entries).toHaveLength(2);
  });

  it('maps TransactionResponse with minimal / fallback fields', () => {
    const minimalDto: TransactionResponse = {
      id: 'tx-min',
      status: 'POSTED',
      ledgerEntries: [],
    };

    const domain = mapTransactionResponseToDomain(minimalDto);

    expect(domain.id).toBe('tx-min');
    expect(domain.amount.isZero()).toBe(true);
    expect(domain.state).toBe(TransactionState.POSTED);
    expect(domain.reference).toBe('tx-min');
    expect(domain.description).toBe('Transaction');
    expect(domain.entries).toEqual([]);
  });
});
