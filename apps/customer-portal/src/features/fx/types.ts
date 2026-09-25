import { Money, Currency } from '@ble-frontend/domain-types';
import type { FxRateResponse, FxQuoteResponse } from '@ble-frontend/api-client';

export interface FxRate {
  id: string;
  sourceCurrency: Currency | string;
  targetCurrency: Currency | string;
  rate: number;
  spread?: number;
  effectiveRate?: number;
  provider?: string;
  expiresAt?: string;
}

export type FxQuoteStatus = 'ACTIVE' | 'EXPIRED' | 'EXECUTED';

export interface FxQuote {
  id: string;
  quoteReference: string;
  sourceCurrency: Currency | string;
  targetCurrency: Currency | string;
  sourceAmount: Money;
  targetAmount: Money;
  exchangeRate: number;
  spread?: number;
  provider?: string;
  status: FxQuoteStatus;
  expiresAt: string;
  createdAt: string;
}

export interface ExecuteFxTransferCommand {
  quoteReference: string;
  sourceAccountId: string;
  destinationAccountId: string;
  reference: string;
  description?: string;
}

export function mapFxRateResponseToDomain(dto: FxRateResponse): FxRate {
  return {
    id: dto.id || `${dto.sourceCurrency}-${dto.targetCurrency}`,
    sourceCurrency: dto.sourceCurrency || Currency.EUR,
    targetCurrency: dto.targetCurrency || Currency.USD,
    rate: dto.rate ?? 1.0,
    spread: dto.spread,
    effectiveRate: dto.effectiveRate ?? dto.rate ?? 1.0,
    provider: dto.provider,
    expiresAt: dto.expiresAt,
  };
}

export function mapFxQuoteResponseToDomain(dto: FxQuoteResponse): FxQuote {
  const srcCurr = dto.sourceCurrency || Currency.EUR;
  const tgtCurr = dto.targetCurrency || Currency.USD;

  const srcAmount =
    dto.sourceAmount?.amount !== undefined
      ? Money.from(dto.sourceAmount.amount, srcCurr)
      : Money.zero(srcCurr);

  const tgtAmount =
    dto.targetAmount?.amount !== undefined
      ? Money.from(dto.targetAmount.amount, tgtCurr)
      : Money.zero(tgtCurr);

  const isExpired = dto.expiresAt ? new Date(dto.expiresAt).getTime() <= Date.now() : false;
  const status: FxQuoteStatus =
    dto.status === 'EXECUTED'
      ? 'EXECUTED'
      : isExpired || dto.status === 'EXPIRED'
        ? 'EXPIRED'
        : 'ACTIVE';

  return {
    id: dto.id || dto.quoteReference || '',
    quoteReference: dto.quoteReference || dto.id || '',
    sourceCurrency: srcCurr,
    targetCurrency: tgtCurr,
    sourceAmount: srcAmount,
    targetAmount: tgtAmount,
    exchangeRate: dto.exchangeRate ?? 1.0,
    spread: dto.spread,
    provider: dto.provider,
    status,
    expiresAt: dto.expiresAt || new Date(Date.now() + 60000).toISOString(),
    createdAt: dto.createdAt || new Date().toISOString(),
  };
}
