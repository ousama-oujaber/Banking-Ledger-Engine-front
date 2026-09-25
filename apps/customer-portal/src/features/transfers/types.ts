import { Money, Currency, CURRENCIES } from '@ble-frontend/domain-types';
import type { Account } from '../accounts/types';

export interface TransferCommand {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  reference: string;
  description?: string;
  beneficiaryId?: string;
}

export interface DepositCommand {
  accountId: string;
  amount: Money;
  reference: string;
  description?: string;
}

export interface WithdrawCommand {
  accountId: string;
  amount: Money;
  reference: string;
  description?: string;
}

export type TransferState =
  | 'DRAFT'
  | 'VALIDATING'
  | 'SUBMITTING'
  | 'CONFIRMED'
  | 'RETRYING_LOCK'
  | 'REJECTED'
  | 'NETWORK_ERROR';

export interface TransferValidationResult {
  isValid: boolean;
  errors: {
    fromAccountId?: string;
    toAccountId?: string;
    amount?: string;
    currency?: string;
    reference?: string;
    general?: string;
  };
}

/**
 * Validates transfer input parameters against client domain rules (BR-F01, BR-F04).
 */
export function validateTransferCommand(
  command: Partial<TransferCommand>,
  sourceAccount?: Account | null,
  destinationAccount?: Account | null,
): TransferValidationResult {
  const errors: TransferValidationResult['errors'] = {};

  if (!command.fromAccountId) {
    errors.fromAccountId = 'Source account is required';
  }

  if (!command.toAccountId) {
    errors.toAccountId = 'Destination account is required';
  } else if (command.fromAccountId && command.toAccountId === command.fromAccountId) {
    errors.toAccountId = 'Cannot transfer to the same account (self-transfer prohibited)';
  }

  if (!command.amount) {
    errors.amount = 'Transfer amount is required';
  } else {
    if (command.amount.isZero() || command.amount.isNegative()) {
      errors.amount = 'Transfer amount must be strictly positive';
    }

    // Currency minor unit scale validation (BR-F01)
    const currencyInfo = CURRENCIES[command.amount.currency as Currency];
    if (currencyInfo) {
      const parts = command.amount.amount.toString().split('.');
      if (parts[1] && parts[1].length > currencyInfo.scale) {
        errors.amount = `Amount exceeds max decimal precision (${currencyInfo.scale} decimal places for ${command.amount.currency})`;
      }
    }

    // Balance pre-validation
    if (sourceAccount?.availableBalance) {
      if (command.amount.greaterThan(sourceAccount.availableBalance)) {
        errors.amount = `Insufficient available balance (${sourceAccount.availableBalance.format()})`;
      }
    } else if (sourceAccount?.derivedBalance) {
      if (command.amount.greaterThan(sourceAccount.derivedBalance)) {
        errors.amount = `Insufficient available balance (${sourceAccount.derivedBalance.format()})`;
      }
    }
  }

  // Currency homogeneity validation (BR-F04)
  if (sourceAccount && destinationAccount) {
    if (sourceAccount.currency !== destinationAccount.currency) {
      errors.currency = `Direct transfers require matching currencies (${sourceAccount.currency} vs ${destinationAccount.currency}). Please use Foreign Exchange transfer.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
