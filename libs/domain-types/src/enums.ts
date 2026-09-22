/**
 * Domain status and type enumerations matching backend DDD aggregates.
 */
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

export enum AccountType {
  CLASSIC = 'CLASSIC',
  SAVINGS = 'SAVINGS',
  ESCROW = 'ESCROW',
  SETTLEMENT = 'SETTLEMENT',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  FX_TRANSFER = 'FX_TRANSFER',
  HOLD_CAPTURE = 'HOLD_CAPTURE',
  HOLD_RELEASE = 'HOLD_RELEASE',
  INTEREST_ACCRUAL = 'INTEREST_ACCRUAL',
  INTEREST_POSTING = 'INTEREST_POSTING',
  FEE_CHARGED = 'FEE_CHARGED',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL',
}

export enum EntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMMITTED = 'COMMITTED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

export enum HoldStatus {
  PLACED = 'PLACED',
  CAPTURED = 'CAPTURED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  OPERATOR = 'OPERATOR',
  AUDITOR = 'AUDITOR',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}
