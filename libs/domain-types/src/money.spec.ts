import { describe, expect, it } from 'vitest';
import { Currency } from './currencies';
import { CurrencyMismatchException, InvalidAmountException } from './errors';
import { Money } from './money';

describe('Money value object', () => {
  describe('creation & validation', () => {
    it('should create an immutable Money instance', () => {
      const money = Money.from(100.5, Currency.EUR);
      expect(money.currency).toBe('EUR');
      expect(money.amount.toNumber()).toBe(100.5);
    });

    it('should create zero-valued Money', () => {
      const zero = Money.zero(Currency.USD);
      expect(zero.isZero()).toBe(true);
      expect(zero.amount.toNumber()).toBe(0);
      expect(zero.currency).toBe('USD');
    });

    it('should instantiate from minor units correctly per currency scale', () => {
      // EUR scale = 2 -> 1050 cents = 10.50 EUR
      const eur = Money.fromMinorUnits(1050, Currency.EUR);
      expect(eur.amount.toFixed(2)).toBe('10.50');

      // BHD scale = 3 -> 1250 fils = 1.250 BHD
      const bhd = Money.fromMinorUnits(1250, Currency.BHD);
      expect(bhd.amount.toFixed(3)).toBe('1.250');

      // JPY scale = 0 -> 500 yen = 500 JPY
      const jpy = Money.fromMinorUnits(500, Currency.JPY);
      expect(jpy.amount.toFixed(0)).toBe('500');
    });

    it('should reject invalid or non-finite amounts', () => {
      expect(() => Money.from(NaN, Currency.EUR)).toThrow(InvalidAmountException);
      expect(() => Money.from(Infinity, Currency.EUR)).toThrow(InvalidAmountException);
      expect(() => Money.from('not-a-number', Currency.EUR)).toThrow(InvalidAmountException);
    });

    it('should normalize lowercase currency codes to uppercase', () => {
      const money = Money.from(50, 'usd');
      expect(money.currency).toBe('USD');
    });
  });

  describe('decimal precision & arithmetic (BR-F01)', () => {
    it('should perform exact arithmetic without IEEE-754 floating-point errors', () => {
      // In JS floats: 0.1 + 0.2 = 0.30000000000000004
      const a = Money.from('0.1', Currency.EUR);
      const b = Money.from('0.2', Currency.EUR);
      const sum = a.add(b);

      expect(sum.amount.toFixed(1)).toBe('0.3');
      expect(sum.equals(Money.from('0.3', Currency.EUR))).toBe(true);
    });

    it('should preserve immutability on operations', () => {
      const original = Money.from(100, Currency.EUR);
      const added = original.add(Money.from(50, Currency.EUR));

      expect(original.amount.toNumber()).toBe(100);
      expect(added.amount.toNumber()).toBe(150);
    });

    it('should throw CurrencyMismatchException when operating on different currencies', () => {
      const eur = Money.from(100, Currency.EUR);
      const usd = Money.from(100, Currency.USD);

      expect(() => eur.add(usd)).toThrow(CurrencyMismatchException);
      expect(() => eur.subtract(usd)).toThrow(CurrencyMismatchException);
    });

    it('should correctly multiply and divide by scalars', () => {
      const money = Money.from(100, Currency.USD);
      const doubled = money.multiply(2);
      expect(doubled.amount.toNumber()).toBe(200);

      const halved = money.divide(2);
      expect(halved.amount.toNumber()).toBe(50);
    });

    it('should throw InvalidAmountException on division by zero', () => {
      const money = Money.from(100, Currency.USD);
      expect(() => money.divide(0)).toThrow(InvalidAmountException);
    });

    it('should handle abs and negate', () => {
      const negative = Money.from(-75, Currency.EUR);
      expect(negative.isNegative()).toBe(true);
      expect(negative.abs().amount.toNumber()).toBe(75);
      expect(negative.negate().amount.toNumber()).toBe(75);

      const positive = Money.from(75, Currency.EUR);
      expect(positive.negate().amount.toNumber()).toBe(-75);
    });

    it('should round to currency official scale', () => {
      // EUR scale = 2
      const eur = Money.from('10.5555', Currency.EUR).roundToScale();
      expect(eur.amount.toFixed(2)).toBe('10.56');

      // BHD scale = 3
      const bhd = Money.from('1.23456', Currency.BHD).roundToScale();
      expect(bhd.amount.toFixed(3)).toBe('1.235');

      // JPY scale = 0
      const jpy = Money.from('100.8', Currency.JPY).roundToScale();
      expect(jpy.amount.toFixed(0)).toBe('101');
    });
  });

  describe('minor units conversion', () => {
    it('should convert standard 2-decimal currency to minor units bigint', () => {
      const eur = Money.from('12.34', Currency.EUR);
      expect(eur.toMinorUnits()).toBe(1234n);
    });

    it('should convert 3-decimal currency (BHD) to minor units bigint', () => {
      const bhd = Money.from('1.250', Currency.BHD);
      expect(bhd.toMinorUnits()).toBe(1250n);
    });

    it('should convert 0-decimal currency (JPY) to minor units bigint', () => {
      const jpy = Money.from('500', Currency.JPY);
      expect(jpy.toMinorUnits()).toBe(500n);
    });

    it('should handle negative values in minor units conversion', () => {
      const negative = Money.from('-10.50', Currency.EUR);
      expect(negative.toMinorUnits()).toBe(-1050n);
    });
  });

  describe('comparisons & predicates', () => {
    const a = Money.from(100, Currency.EUR);
    const b = Money.from(200, Currency.EUR);
    const aCopy = Money.from(100, Currency.EUR);
    const usd = Money.from(100, Currency.USD);

    it('should correctly test equality', () => {
      expect(a.equals(aCopy)).toBe(true);
      expect(a.equals(b)).toBe(false);
      expect(a.equals(usd)).toBe(false);
    });

    it('should correctly evaluate ordering predicates', () => {
      expect(b.greaterThan(a)).toBe(true);
      expect(a.greaterThan(b)).toBe(false);
      expect(a.greaterThanOrEqual(aCopy)).toBe(true);

      expect(a.lessThan(b)).toBe(true);
      expect(b.lessThan(a)).toBe(false);
      expect(a.lessThanOrEqual(aCopy)).toBe(true);
    });

    it('should throw on comparison between differing currencies', () => {
      expect(() => a.greaterThan(usd)).toThrow(CurrencyMismatchException);
      expect(() => a.lessThan(usd)).toThrow(CurrencyMismatchException);
    });

    it('should correctly evaluate sign predicates', () => {
      expect(Money.from(10, Currency.EUR).isPositive()).toBe(true);
      expect(Money.from(0, Currency.EUR).isPositive()).toBe(false);
      expect(Money.from(-10, Currency.EUR).isPositive()).toBe(false);

      expect(Money.from(-10, Currency.EUR).isNegative()).toBe(true);
      expect(Money.from(0, Currency.EUR).isNegative()).toBe(false);
      expect(Money.from(10, Currency.EUR).isNegative()).toBe(false);

      expect(Money.from(0, Currency.EUR).isZero()).toBe(true);
      expect(Money.from(10, Currency.EUR).isZero()).toBe(false);
    });
  });

  describe('serialization & formatting', () => {
    it('should serialize to JSON cleanly', () => {
      const money = Money.from('250.75', Currency.EUR);
      expect(money.toJSON()).toEqual({
        amount: '250.75',
        currency: 'EUR',
      });
    });

    it('should produce standard string representation', () => {
      const money = Money.from('250.75', Currency.USD);
      expect(money.toString()).toBe('250.75 USD');
    });

    it('should convert to number safely for charts', () => {
      const money = Money.from('99.99', Currency.GBP);
      expect(money.toNumber()).toBe(99.99);
    });

    it('should format localized display strings', () => {
      const money = Money.from('1234.50', Currency.EUR);
      const formatted = money.format('en-US');
      expect(formatted).toContain('1,234.50');
    });
  });
});
