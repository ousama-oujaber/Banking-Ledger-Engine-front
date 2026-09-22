import { Decimal } from 'decimal.js';

/**
 * Supported ISO 4217 Currency Enumeration.
 * Aligned with backend ledger core and multi-currency exchange.
 */
export enum Currency {
  EUR = 'EUR',
  USD = 'USD',
  GBP = 'GBP',
  JPY = 'JPY',
  KRW = 'KRW',
  BHD = 'BHD',
  KWD = 'KWD',
  MAD = 'MAD',
}

export type CurrencyCode = Currency | `${Currency}`;

/**
 * Currency metadata according to ISO 4217 specifications.
 */
export interface CurrencyInfo {
  code: Currency;
  name: string;
  symbol: string;
  scale: number;
  decimalDigits: number;
}

export const CURRENCIES: Record<Currency, CurrencyInfo> = {
  [Currency.EUR]: { code: Currency.EUR, name: 'Euro', symbol: '€', scale: 2, decimalDigits: 2 },
  [Currency.USD]: {
    code: Currency.USD,
    name: 'US Dollar',
    symbol: '$',
    scale: 2,
    decimalDigits: 2,
  },
  [Currency.GBP]: {
    code: Currency.GBP,
    name: 'Pound Sterling',
    symbol: '£',
    scale: 2,
    decimalDigits: 2,
  },
  [Currency.JPY]: {
    code: Currency.JPY,
    name: 'Japanese Yen',
    symbol: '¥',
    scale: 0,
    decimalDigits: 0,
  },
  [Currency.KRW]: {
    code: Currency.KRW,
    name: 'South Korean Won',
    symbol: '₩',
    scale: 0,
    decimalDigits: 0,
  },
  [Currency.BHD]: {
    code: Currency.BHD,
    name: 'Bahraini Dinar',
    symbol: 'BD',
    scale: 3,
    decimalDigits: 3,
  },
  [Currency.KWD]: {
    code: Currency.KWD,
    name: 'Kuwaiti Dinar',
    symbol: 'KD',
    scale: 3,
    decimalDigits: 3,
  },
  [Currency.MAD]: {
    code: Currency.MAD,
    name: 'Moroccan Dirham',
    symbol: 'DH',
    scale: 2,
    decimalDigits: 2,
  },
};

export const SUPPORTED_CURRENCY_CODES: readonly Currency[] = Object.values(Currency);

/**
 * Type guard to check if an unknown string is a supported ISO currency.
 */
export function isValidCurrency(code: unknown): code is Currency {
  if (typeof code !== 'string') {
    return false;
  }
  return Object.values(Currency).includes(code.toUpperCase() as Currency);
}

/**
 * Returns the decimal minor-unit scale for a given currency (default: 2).
 * e.g., JPY: 0, EUR: 2, BHD: 3.
 */
export function getCurrencyScale(currency: Currency | string): number {
  const normalized = currency.toUpperCase() as Currency;
  return CURRENCIES[normalized]?.scale ?? 2;
}

/**
 * Returns the currency symbol or falls back to the currency code.
 */
export function getCurrencySymbol(currency: Currency | string): string {
  const normalized = currency.toUpperCase() as Currency;
  return CURRENCIES[normalized]?.symbol ?? currency;
}

/**
 * Formats a numeric or Decimal amount according to currency-specific scale and locale.
 */
export function formatCurrencyAmount(
  amount: Decimal.Value,
  currency: Currency | string,
  locale = 'en-US',
): string {
  const num = new Decimal(amount).toNumber();
  const scale = getCurrencyScale(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
    }).format(num);
  } catch {
    // Fallback for custom or unsupported currency formatting in Intl
    const symbol = getCurrencySymbol(currency);
    return `${symbol} ${num.toFixed(scale)}`;
  }
}
