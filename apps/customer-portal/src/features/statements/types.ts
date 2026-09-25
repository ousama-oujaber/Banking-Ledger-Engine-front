import { Currency, Money } from '@ble-frontend/domain-types';
import type { AccountStatementResponse, StatementEntryResponse } from '@ble-frontend/api-client';

export interface StatementEntry {
  entryId: string;
  transactionId: string;
  entryDate: string;
  valueDate: string;
  description: string;
  reference: string;
  debitAmount: Money;
  creditAmount: Money;
  runningBalance: Money;
}

export interface AccountStatement {
  id: string;
  accountId: string;
  fromDate: string;
  toDate: string;
  currency: Currency;
  openingBalance: Money;
  closingBalance: Money;
  totalCredits: Money;
  totalDebits: Money;
  entryCount: number;
  generatedAt: string;
  entries: StatementEntry[];
}

export interface GenerateStatementParams {
  accountId: string;
  fromDate: string;
  toDate: string;
}

export function mapStatementResponseToDomain(dto: AccountStatementResponse): AccountStatement {
  const currency = (dto.currency as Currency) || Currency.EUR;

  const entries: StatementEntry[] = (dto.entries || []).map((e: StatementEntryResponse) => ({
    entryId: e.entryId || '',
    transactionId: e.transactionId || '',
    entryDate: e.entryDate || '',
    valueDate: e.valueDate || '',
    description: e.description || '',
    reference: e.reference || '',
    debitAmount: Money.from(e.debitAmount ?? 0, currency),
    creditAmount: Money.from(e.creditAmount ?? 0, currency),
    runningBalance: Money.from(e.runningBalance ?? 0, currency),
  }));

  return {
    id: dto.id || '',
    accountId: dto.accountId || '',
    fromDate: dto.fromDate || '',
    toDate: dto.toDate || '',
    currency,
    openingBalance: Money.from(dto.openingBalance ?? 0, currency),
    closingBalance: Money.from(dto.closingBalance ?? 0, currency),
    totalCredits: Money.from(dto.totalCredits ?? 0, currency),
    totalDebits: Money.from(dto.totalDebits ?? 0, currency),
    entryCount: dto.entryCount ?? entries.length,
    generatedAt: dto.generatedAt || new Date().toISOString(),
    entries,
  };
}
