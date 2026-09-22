import { describe, expect, it } from 'vitest';
import {
  Currency,
  CURRENCIES,
  formatCurrencyAmount,
  getCurrencyScale,
  getCurrencySymbol,
  isValidCurrency,
  SUPPORTED_CURRENCY_CODES,
} from './currencies';

describe('currencies domain module', () => {
  it('should include all defined ISO currencies in SUPPORTED_CURRENCY_CODES', () => {
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.EUR);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.USD);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.GBP);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.JPY);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.KRW);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.BHD);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.KWD);
    expect(SUPPORTED_CURRENCY_CODES).toContain(Currency.MAD);
  });

  it('should have correct ISO 4217 minor unit scales', () => {
    expect(getCurrencyScale(Currency.EUR)).toBe(2);
    expect(getCurrencyScale(Currency.USD)).toBe(2);
    expect(getCurrencyScale(Currency.GBP)).toBe(2);
    expect(getCurrencyScale(Currency.JPY)).toBe(0);
    expect(getCurrencyScale(Currency.KRW)).toBe(0);
    expect(getCurrencyScale(Currency.BHD)).toBe(3);
    expect(getCurrencyScale(Currency.KWD)).toBe(3);
    expect(getCurrencyScale(Currency.MAD)).toBe(2);
  });

  it('should return default scale of 2 for unknown currency', () => {
    expect(getCurrencyScale('UNKNOWN')).toBe(2);
  });

  it('should correctly identify valid and invalid currency codes', () => {
    expect(isValidCurrency('EUR')).toBe(true);
    expect(isValidCurrency('eur')).toBe(true);
    expect(isValidCurrency('bhd')).toBe(true);
    expect(isValidCurrency('MAD')).toBe(true);

    expect(isValidCurrency('XYZ')).toBe(false);
    expect(isValidCurrency('')).toBe(false);
    expect(isValidCurrency(null)).toBe(false);
    expect(isValidCurrency(undefined)).toBe(false);
    expect(isValidCurrency(123)).toBe(false);
  });

  it('should return appropriate symbols', () => {
    expect(getCurrencySymbol(Currency.EUR)).toBe('€');
    expect(getCurrencySymbol(Currency.USD)).toBe('$');
    expect(getCurrencySymbol(Currency.GBP)).toBe('£');
    expect(getCurrencySymbol(Currency.JPY)).toBe('¥');
    expect(getCurrencySymbol(Currency.BHD)).toBe('BD');
    expect(getCurrencySymbol(Currency.MAD)).toBe('DH');
    expect(getCurrencySymbol('XYZ')).toBe('XYZ');
  });

  it('should format amounts according to currency scale', () => {
    const formattedEur = formatCurrencyAmount('10.5', Currency.EUR, 'en-US');
    expect(formattedEur).toContain('10.50');

    const formattedJpy = formatCurrencyAmount('1500', Currency.JPY, 'en-US');
    expect(formattedJpy).toContain('1,500');

    const formattedBhd = formatCurrencyAmount('1.25', Currency.BHD, 'en-US');
    expect(formattedBhd).toContain('1.250');
  });
});
