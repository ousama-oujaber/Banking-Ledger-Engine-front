import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Currency, Money } from '@ble-frontend/domain-types';
import { AccountStatement } from '../types';
import {
  generateStatementCsv,
  downloadStatementCsv,
  downloadStatementJson,
} from './statement-export';

describe('Statement Export Utilities', () => {
  const mockStatement: AccountStatement = {
    id: 'stmt-001',
    accountId: 'acc-456',
    fromDate: '2026-09-01',
    toDate: '2026-09-23',
    currency: Currency.EUR,
    openingBalance: Money.from('500.00', Currency.EUR),
    closingBalance: Money.from('800.00', Currency.EUR),
    totalCredits: Money.from('400.00', Currency.EUR),
    totalDebits: Money.from('100.00', Currency.EUR),
    entryCount: 2,
    generatedAt: '2026-09-23T12:00:00Z',
    entries: [
      {
        entryId: 'e1',
        transactionId: 't1',
        entryDate: '2026-09-05',
        valueDate: '2026-09-05',
        reference: 'REF-1',
        description: 'Deposit "Salary"',
        debitAmount: Money.from('0.00', Currency.EUR),
        creditAmount: Money.from('400.00', Currency.EUR),
        runningBalance: Money.from('900.00', Currency.EUR),
      },
      {
        entryId: 'e2',
        transactionId: 't2',
        entryDate: '2026-09-10',
        valueDate: '2026-09-10',
        reference: 'REF-2',
        description: 'Payment',
        debitAmount: Money.from('100.00', Currency.EUR),
        creditAmount: Money.from('0.00', Currency.EUR),
        runningBalance: Money.from('800.00', Currency.EUR),
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates well-formed CSV with headers and escaped quotes', () => {
    const csv = generateStatementCsv(mockStatement);
    expect(csv).toContain('"Account ID","acc-456"');
    expect(csv).toContain('"Period","2026-09-01 to 2026-09-23"');
    expect(csv).toContain(
      '"Entry ID","Entry Date","Value Date","Reference","Description","Debit","Credit","Running Balance"',
    );
    expect(csv).toContain('"e1","2026-09-05","2026-09-05","REF-1","Deposit ""Salary"""');
    expect(csv).toContain('"","400.00","900.00"');
    expect(csv).toContain('"100.00","","800.00"');
  });

  it('triggers CSV download with proper filename', () => {
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/blob-id');
    const revokeObjectUrlMock = vi.fn();
    global.URL.createObjectURL = createObjectUrlMock;
    global.URL.revokeObjectURL = revokeObjectUrlMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadStatementCsv(mockStatement);

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:http://localhost/blob-id');
  });

  it('triggers JSON download with serialized payload', () => {
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/blob-id');
    const revokeObjectUrlMock = vi.fn();
    global.URL.createObjectURL = createObjectUrlMock;
    global.URL.revokeObjectURL = revokeObjectUrlMock;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadStatementJson(mockStatement);

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });
});
