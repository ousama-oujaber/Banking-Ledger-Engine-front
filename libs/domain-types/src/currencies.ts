/**
 * ISO 4217 currency definitions.
 */
export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  scale: number;
  decimalDigits: number;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', scale: 2, decimalDigits: 2 },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', scale: 2, decimalDigits: 2 },
  GBP: { code: 'GBP', name: 'Pound Sterling', symbol: '£', scale: 2, decimalDigits: 2 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', scale: 0, decimalDigits: 0 },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', scale: 0, decimalDigits: 0 },
  BHD: { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', scale: 3, decimalDigits: 3 },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', scale: 3, decimalDigits: 3 },
};

export const SUPPORTED_CURRENCY_CODES = Object.keys(CURRENCIES);

export type CurrencyCode = keyof typeof CURRENCIES;

export function getCurrencyScale(code: string): number {
  return CURRENCIES[code]?.scale ?? 2;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES[code]?.symbol ?? code;
}
