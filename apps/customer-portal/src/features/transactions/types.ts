import {
  Money,
  Currency,
  TransactionState,
  TransactionType,
  EntryType,
} from '@ble-frontend/domain-types';
import type { TransactionResponse, EntryResponse, MoneyDto } from '@ble-frontend/api-client';

export interface LedgerEntry {
  id: string;
  accountId: string;
  type: EntryType | 'DEBIT' | 'CREDIT';
  amount: Money;
  createdAt?: string;
  holdCaptured?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType | string;
  amount: Money;
  currency: Currency | string;
  reference: string;
  description: string;
  state: TransactionState | string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  entries: LedgerEntry[];
  createdAt: string;
  postedAt?: string;
  settledAt?: string;
  failedAt?: string;
  failureReason?: string;
  feeAmount?: Money;
  taxAmount?: Money;
  exchangeRate?: number;
  sourceCurrency?: string;
  targetCurrency?: string;
}

function extractMoneyFromDto(
  dto?: MoneyDto | null,
  fallbackCurrency: Currency | string = Currency.EUR,
): Money {
  if (!dto || dto.amount === undefined || dto.amount === null) {
    return Money.zero(fallbackCurrency);
  }
  return Money.from(dto.amount, dto.currency || fallbackCurrency);
}

export function mapEntryResponseToDomain(
  dto: EntryResponse,
  fallbackCurrency: Currency | string = Currency.EUR,
): LedgerEntry {
  const currency = dto.amount?.currency || fallbackCurrency;
  const money = dto.amount
    ? extractMoneyFromDto(dto.amount, currency)
    : dto.debit !== undefined && dto.debit > 0
      ? Money.from(dto.debit, currency)
      : dto.credit !== undefined && dto.credit > 0
        ? Money.from(dto.credit, currency)
        : Money.zero(currency);

  const direction = (dto.type || (dto.debit && dto.debit > 0 ? 'DEBIT' : 'CREDIT')) as
    EntryType | 'DEBIT' | 'CREDIT';

  return {
    id: dto.id || '',
    accountId: dto.accountId || '',
    type: direction,
    amount: money,
    createdAt: dto.createdAt,
    holdCaptured: Boolean(dto.holdCaptured),
  };
}

export function mapTransactionResponseToDomain(dto: TransactionResponse): Transaction {
  const currency = dto.amount?.currency || dto.sourceCurrency || Currency.EUR;
  const amount = extractMoneyFromDto(dto.amount, currency);

  const rawEntries = dto.entries || dto.ledgerEntries || [];
  const entries = rawEntries.map((e) => mapEntryResponseToDomain(e, currency));

  return {
    id: dto.id || '',
    type: (dto.type as TransactionType) || TransactionType.TRANSFER,
    amount,
    currency,
    reference: dto.reference || dto.externalReference || dto.id || '',
    description: dto.description || `${dto.type || 'Transaction'}`,
    state:
      (dto.state as TransactionState) ||
      (dto.status as TransactionState) ||
      TransactionState.SETTLED,
    sourceAccountId: dto.sourceAccountId || dto.fromAccountId,
    destinationAccountId: dto.destinationAccountId || dto.toAccountId,
    entries,
    createdAt: dto.createdAt || dto.initiatedAt || new Date().toISOString(),
    postedAt: dto.postedAt,
    settledAt: dto.settledAt,
    failedAt: dto.failedAt,
    failureReason: dto.failureReason,
    feeAmount: dto.feeAmount ? extractMoneyFromDto(dto.feeAmount, currency) : undefined,
    taxAmount: dto.taxAmount ? extractMoneyFromDto(dto.taxAmount, currency) : undefined,
    exchangeRate: dto.exchangeRate,
    sourceCurrency: dto.sourceCurrency,
    targetCurrency: dto.targetCurrency,
  };
}
