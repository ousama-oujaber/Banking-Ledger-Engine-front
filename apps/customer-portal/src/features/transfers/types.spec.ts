import { describe, it, expect } from 'vitest';
import { Currency, AccountStatus, AccountType, Money } from '@ble-frontend/domain-types';
import { validateTransferCommand, type TransferCommand } from './types';
import type { Account } from '../accounts/types';

describe('Transfer Validation (types.ts)', () => {
  const mockSourceAccount: Account = {
    id: 'acc-src-1',
    ownerId: 'cust-1',
    label: 'Checking Account',
    currency: Currency.EUR,
    type: AccountType.CLASSIC,
    status: AccountStatus.ACTIVE,
    derivedBalance: Money.from('500.00', Currency.EUR),
    availableBalance: Money.from('450.00', Currency.EUR),
    allowOverdraft: false,
    version: 1,
  };

  const mockDestAccount: Account = {
    id: 'acc-dst-2',
    ownerId: 'cust-2',
    label: 'Savings Account',
    currency: Currency.EUR,
    type: AccountType.SAVINGS,
    status: AccountStatus.ACTIVE,
    derivedBalance: Money.from('1000.00', Currency.EUR),
    availableBalance: Money.from('1000.00', Currency.EUR),
    allowOverdraft: false,
    version: 1,
  };

  it('validates a correct transfer command successfully', () => {
    const command: TransferCommand = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-dst-2',
      amount: Money.from('100.00', Currency.EUR),
      reference: 'TRF-123456',
    };

    const result = validateTransferCommand(command, mockSourceAccount, mockDestAccount);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects self-transfer (fromAccountId === toAccountId)', () => {
    const command: TransferCommand = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-src-1',
      amount: Money.from('50.00', Currency.EUR),
      reference: 'TRF-SELF',
    };

    const result = validateTransferCommand(command, mockSourceAccount, mockSourceAccount);
    expect(result.isValid).toBe(false);
    expect(result.errors.toAccountId).toMatch(/self-transfer prohibited/i);
  });

  it('rejects missing source or destination accounts', () => {
    const result = validateTransferCommand({}, null, null);
    expect(result.isValid).toBe(false);
    expect(result.errors.fromAccountId).toBe('Source account is required');
    expect(result.errors.toAccountId).toBe('Destination account is required');
    expect(result.errors.amount).toBe('Transfer amount is required');
  });

  it('rejects zero or negative transfer amounts', () => {
    const zeroCmd = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-dst-2',
      amount: Money.zero(Currency.EUR),
      reference: 'TRF-0',
    };
    const zeroResult = validateTransferCommand(zeroCmd, mockSourceAccount, mockDestAccount);
    expect(zeroResult.isValid).toBe(false);
    expect(zeroResult.errors.amount).toMatch(/strictly positive/i);

    const negCmd = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-dst-2',
      amount: Money.from('-10.00', Currency.EUR),
      reference: 'TRF-NEG',
    };
    const negResult = validateTransferCommand(negCmd, mockSourceAccount, mockDestAccount);
    expect(negResult.isValid).toBe(false);
    expect(negResult.errors.amount).toMatch(/strictly positive/i);
  });

  it('rejects transfer amount exceeding available balance', () => {
    const excessiveCmd = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-dst-2',
      amount: Money.from('600.00', Currency.EUR), // Available is 450.00
      reference: 'TRF-EXCESS',
    };

    const result = validateTransferCommand(excessiveCmd, mockSourceAccount, mockDestAccount);
    expect(result.isValid).toBe(false);
    expect(result.errors.amount).toMatch(/Insufficient available balance/i);
  });

  it('rejects transfer exceeding currency decimal scale', () => {
    const jpyAccount: Account = {
      ...mockSourceAccount,
      currency: Currency.JPY,
      derivedBalance: Money.from('5000', Currency.JPY),
      availableBalance: Money.from('5000', Currency.JPY),
    };

    // JPY has scale 0 (no fractional yen)
    const invalidJpyCmd = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-dst-2',
      amount: Money.from('100.5', Currency.JPY),
      reference: 'TRF-JPY-SCALE',
    };

    const result = validateTransferCommand(invalidJpyCmd, jpyAccount, jpyAccount);
    expect(result.isValid).toBe(false);
    expect(result.errors.amount).toMatch(/exceeds max decimal precision/i);
  });

  it('rejects cross-currency direct transfer (currency homogeneity violation)', () => {
    const usdDestAccount: Account = {
      ...mockDestAccount,
      currency: Currency.USD,
    };

    const command = {
      fromAccountId: 'acc-src-1',
      toAccountId: 'acc-dst-2',
      amount: Money.from('50.00', Currency.EUR),
      reference: 'TRF-FX-MISMATCH',
    };

    const result = validateTransferCommand(command, mockSourceAccount, usdDestAccount);
    expect(result.isValid).toBe(false);
    expect(result.errors.currency).toMatch(/matching currencies/i);
  });
});
