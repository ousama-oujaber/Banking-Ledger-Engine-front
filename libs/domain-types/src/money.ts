import Decimal from 'decimal.js';

/**
 * Immutable, decimal-safe Money value object.
 * Never use JavaScript native Number for financial arithmetic.
 */
export class Money {
  private readonly _amount: Decimal;
  private readonly _currency: string;

  private constructor(amount: Decimal.Value, currency: string) {
    this._currency = currency.toUpperCase();
    this._amount = new Decimal(amount);
  }

  static from(amount: Decimal.Value, currency: string): Money {
    return new Money(amount, currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  get amount(): Decimal {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  add(other: Money): Money {
    this.assertCurrencyMatch(other);
    return new Money(this._amount.plus(other._amount), this._currency);
  }

  subtract(other: Money): Money {
    this.assertCurrencyMatch(other);
    return new Money(this._amount.minus(other._amount), this._currency);
  }

  multiply(factor: number): Money {
    return new Money(this._amount.times(factor), this._currency);
  }

  divide(divisor: number): Money {
    return new Money(this._amount.dividedBy(divisor), this._currency);
  }

  isZero(): boolean {
    return this._amount.isZero();
  }

  isPositive(): boolean {
    return this._amount.isPositive() && !this._amount.isZero();
  }

  isNegative(): boolean {
    return this._amount.isNegative();
  }

  format(locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this._currency,
    }).format(this._amount.toNumber());
  }

  toJSON(): { amount: string; currency: string } {
    return {
      amount: this._amount.toFixed(),
      currency: this._currency,
    };
  }

  private assertCurrencyMatch(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(
        `Currency mismatch: cannot operate on ${this._currency} and ${other._currency}`,
      );
    }
  }
}
