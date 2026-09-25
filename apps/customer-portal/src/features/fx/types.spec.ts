import { describe, it, expect } from 'vitest';
import { Currency } from '@ble-frontend/domain-types';
import { mapFxRateResponseToDomain, mapFxQuoteResponseToDomain } from './types';
import type { FxRateResponse, FxQuoteResponse } from '@ble-frontend/api-client';

describe('FX Domain Mappings (types.ts)', () => {
  it('maps FxRateResponse to domain FxRate', () => {
    const dto: FxRateResponse = {
      id: 'rate-eur-usd',
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      rate: 1.085,
      spread: 0.002,
      effectiveRate: 1.083,
      provider: 'ECB',
      expiresAt: '2026-09-22T12:00:00Z',
    };

    const domain = mapFxRateResponseToDomain(dto);
    expect(domain.id).toBe('rate-eur-usd');
    expect(domain.sourceCurrency).toBe('EUR');
    expect(domain.targetCurrency).toBe('USD');
    expect(domain.rate).toBe(1.085);
    expect(domain.spread).toBe(0.002);
    expect(domain.effectiveRate).toBe(1.083);
  });

  it('maps FxQuoteResponse to domain FxQuote with active status', () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const dto: FxQuoteResponse = {
      id: 'quote-101',
      quoteReference: 'Q-REF-101',
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      sourceAmount: { amount: 500, currency: 'EUR' },
      targetAmount: { amount: 542.5, currency: 'USD' },
      exchangeRate: 1.085,
      expiresAt: futureDate,
    };

    const domain = mapFxQuoteResponseToDomain(dto);
    expect(domain.id).toBe('quote-101');
    expect(domain.quoteReference).toBe('Q-REF-101');
    expect(domain.sourceAmount.format()).toBe('€500.00');
    expect(domain.targetAmount.currency).toBe(Currency.USD);
    expect(domain.exchangeRate).toBe(1.085);
    expect(domain.status).toBe('ACTIVE');
  });

  it('maps expired quote to EXPIRED status', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const dto: FxQuoteResponse = {
      quoteReference: 'Q-EXPIRED',
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      expiresAt: pastDate,
    };

    const domain = mapFxQuoteResponseToDomain(dto);
    expect(domain.status).toBe('EXPIRED');
  });
});
