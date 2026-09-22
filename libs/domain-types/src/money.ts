import { Decimal } from 'decimal.js';
import { Currency, formatCurrencyAmount, getCurrencyScale } from './currencies';
import { CurrencyMismatchException, InvalidAmountException } from './errors';

/**
 * Immutable, decimal-safe Money value object.
 * Strictly adheres to Business Rule BR-F01 (No native IEEE-754 floats in financial arithmetic).
 */
export class Money {
  private readonly _amount: Decimal;
  private readonly _currency: string;

  private constructor(amount: Decimal.Value, currency: Currency | string) {
    if (!currency || typeof currency !== 'string') {
      throw new CurrencyMismatchException('UNKNOWN', String(currency));
    }
    this._currency = currency.toUpperCase();

    try {
      const dec = new Decimal(amount);
      if (!dec.isFinite() || dec.isNaN()) {
        throw new InvalidAmountException(`Amount must be a finite number: ${amount}`);
      }
      this._amount = dec;
    } catch (err) {
      if (err instanceof InvalidAmountException) {
        throw err;
      }
      throw new InvalidAmountException(`Invalid numeric amount representation: ${amount}`);
    }
  }

  /**
   * Factory method to create a Money instance.
   */
  static from(amount: Decimal.Value, currency: Currency | string): Money {
    return new Money(amount, currency);
  }

  /**
   * Factory method to create a zero-value Money instance.
   */
  static zero(currency: Currency | string): Money {
    return new Money(0, currency);
  }

  /**
   * Factory method to instantiate Money from integer minor units (cents, fils, sen).
   * e.g., 1050 EUR minor units -> 10.50 EUR (scale 2)
   *        500 JPY minor units -> 500 JPY (scale 0)
   *       1250 BHD minor units -> 1.250 BHD (scale 3)
   */
  static fromMinorUnits(minorUnits: number | bigint | string, currency: Currency | string): Money {
    const scale = getCurrencyScale(currency);
    const divisor = new Decimal(10).pow(scale);
    const amount = new Decimal(minorUnits.toString()).dividedBy(divisor);
    return new Money(amount, currency);
  }

  /**
   * Underlying Decimal representation for precise calculation.
   */
  get amount(): Decimal {
    return this._amount;
  }

  /**
   * ISO 4217 Currency Code.
   */
  get currency(): string {
    return this._currency;
  }

  /**
   * Adds two Money instances.
   * Throws CurrencyMismatchException if currencies differ.
   */
  add(other: Money): Money {
    this.assertCurrencyMatch(other);
    return new Money(this._amount.plus(other._amount), this._currency);
  }

  /**
   * Subtracts another Money instance from this one.
   * Throws CurrencyMismatchException if currencies differ.
   */
  subtract(other: Money): Money {
    this.assertCurrencyMatch(other);
    return new Money(this._amount.minus(other._amount), this._currency);
  }

  /**
   * Multiplies the amount by a scalar factor.
   */
  multiply(factor: Decimal.Value): Money {
    const dec = new Decimal(factor);
    if (!dec.isFinite() || dec.isNaN()) {
      throw new InvalidAmountException(`Multiplication factor must be finite: ${factor}`);
    }
    return new Money(this._amount.times(dec), this._currency);
  }

  /**
   * Divides the amount by a scalar divisor.
   * Throws InvalidAmountException on division by zero.
   */
  divide(divisor: Decimal.Value): Money {
    const dec = new Decimal(divisor);
    if (dec.isZero()) {
      throw new InvalidAmountException('Division by zero is not permitted for Money');
    }
    if (!dec.isFinite() || dec.isNaN()) {
      throw new InvalidAmountException(`Division divisor must be finite: ${divisor}`);
    }
    return new Money(this._amount.dividedBy(dec), this._currency);
  }

  /**
   * Returns a new Money instance with the absolute amount.
   */
  abs(): Money {
    return new Money(this._amount.abs(), this._currency);
  }

  /**
   * Returns a new Money instance with negated amount.
   */
  negate(): Money {
    return new Money(this._amount.negated(), this._currency);
  }

  /**
   * Rounds the amount to the currency's official ISO scale (using ROUND_HALF_UP).
   */
  roundToScale(): Money {
    const scale = getCurrencyScale(this._currency);
    return new Money(this._amount.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP), this._currency);
  }

  /**
   * Converts the amount to integer minor units (e.g. cents).
   */
  toMinorUnits(): bigint {
    const scale = getCurrencyScale(this._currency);
    const multiplier = new Decimal(10).pow(scale);
    const minorVal = this._amount.times(multiplier).round().toFixed(0);
    return BigInt(minorVal);
  }

  /**
   * Returns true if both Money instances share the same currency and amount.
   */
  equals(other: Money): boolean {
    if (!other || !(other instanceof Money)) {
      return false;
    }
    return this._currency === other._currency && this._amount.equals(other._amount);
  }

  /**
   * Checks if this instance is strictly greater than another Money instance.
   */
  greaterThan(other: Money): boolean {
    this.assertCurrencyMatch(other);
    return this._amount.greaterThan(other._amount);
  }

  /**
   * Checks if this instance is greater than or equal to another Money instance.
   */
  greaterThanOrEqual(other: Money): boolean {
    this.assertCurrencyMatch(other);
    return this._amount.greaterThanOrEqualTo(other._amount);
  }

  /**
   * Checks if this instance is strictly less than another Money instance.
   */
  lessThan(other: Money): boolean {
    this.assertCurrencyMatch(other);
    return this._amount.lessThan(other._amount);
  }

  /**
   * Checks if this instance is less than or equal to another Money instance.
   */
  lessThanOrEqual(other: Money): boolean {
    this.assertCurrencyMatch(other);
    return this._amount.lessThanOrEqualTo(other._amount);
  }

  /**
   * Returns true if amount is 0.
   */
  isZero(): boolean {
    return this._amount.isZero();
  }

  /**
   * Returns true if amount is strictly greater than 0.
   */
  isPositive(): boolean {
    return this._amount.isPositive() && !this._amount.isZero();
  }

  /**
   * Returns true if amount is strictly less than 0.
   */
  isNegative(): boolean {
    return this._amount.isNegative() && !this._amount.isZero();
  }

  /**
   * Converts to native JavaScript number (safe for display/charts only, not ledger arithmetic).
   */
  toNumber(): number {
    return this._amount.toNumber();
  }

  /**
   * Formats the Money value with currency symbol and appropriate decimal places.
   */
  format(locale = 'en-US'): string {
    return formatCurrencyAmount(this._amount, this._currency, locale);
  }

  /**
   * Standard string representation (e.g., "10.50 EUR").
   */
  toString(): string {
    return `${this._amount.toFixed()} ${this._currency}`;
  }

  /**
   * JSON serialization for API request bodies and storage.
   */
  toJSON(): { amount: string; currency: string } {
    return {
      amount: this._amount.toFixed(),
      currency: this._currency,
    };
  }

  private assertCurrencyMatch(other: Money): void {
    if (this._currency !== other._currency) {
      throw new CurrencyMismatchException(this._currency, other._currency);
    }
  }
}
