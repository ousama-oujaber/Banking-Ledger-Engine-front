import { Money, Currency, AccountStatus, AccountType } from '@ble-frontend/domain-types';
import type { AccountResponse, MoneyDto } from '@ble-frontend/api-client';

/**
 * Domain representation of a Customer Account in the Customer Portal UI.
 * Balances are strictly encapsulated as immutable Money value objects.
 */
export interface Account {
  id: string;
  ownerId: string;
  label: string;
  currency: Currency | string;
  type: AccountType | string;
  status: AccountStatus | string;
  derivedBalance: Money;
  availableBalance?: Money;
  heldAmount?: Money;
  ledgerBalance?: Money;
  allowOverdraft: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Helper to safely extract a Money instance from an optional MoneyDto.
 */
export function extractMoney(
  dto?: MoneyDto | null,
  fallbackCurrency: Currency | string = Currency.EUR,
): Money {
  if (!dto || dto.amount === undefined || dto.amount === null) {
    return Money.zero(fallbackCurrency);
  }
  const curr = dto.currency || fallbackCurrency;
  return Money.from(dto.amount, curr);
}

/**
 * Maps an OpenAPI AccountResponse DTO from the Spring Boot backend
 * into a rich, type-safe frontend Account domain model.
 */
export function mapAccountResponseToDomain(dto: AccountResponse): Account {
  const currency = (dto.currency as Currency) || Currency.EUR;

  // The engine calculates derivedBalance dynamically by summing ledger entries
  const derivedBalance = dto.derivedBalance
    ? extractMoney(dto.derivedBalance, currency)
    : dto.balance
      ? extractMoney(dto.balance, currency)
      : dto.ledgerBalance
        ? extractMoney(dto.ledgerBalance, currency)
        : Money.zero(currency);

  const availableBalance = dto.availableBalance
    ? extractMoney(dto.availableBalance, currency)
    : undefined;

  const heldAmount = dto.heldAmount ? extractMoney(dto.heldAmount, currency) : undefined;

  const ledgerBalance = dto.ledgerBalance ? extractMoney(dto.ledgerBalance, currency) : undefined;

  return {
    id: dto.id ?? '',
    ownerId: dto.ownerId ?? '',
    label: dto.label || `Account ${dto.id ? dto.id.slice(0, 8) : ''}`,
    currency,
    type: (dto.type as AccountType) || AccountType.CLASSIC,
    status: (dto.status as AccountStatus) || AccountStatus.ACTIVE,
    derivedBalance,
    availableBalance,
    heldAmount,
    ledgerBalance,
    allowOverdraft: Boolean(dto.allowOverdraft),
    version: dto.version ?? 0,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
