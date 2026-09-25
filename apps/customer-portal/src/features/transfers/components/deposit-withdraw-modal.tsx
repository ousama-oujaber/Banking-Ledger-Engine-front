import { useState, useId } from 'react';
import { Money, parseBackendError, type AppError } from '@ble-frontend/domain-types';
import type { Account } from '../../accounts/types';
import { useDepositMutation, useWithdrawMutation } from '../hooks/use-transfers';
import { generateIdempotencyKey } from '../idempotency';
import { DomainErrorBanner } from '../../errors';

export interface DepositWithdrawModalProps {
  account: Account | null;
  mode: 'DEPOSIT' | 'WITHDRAW';
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal dialog for submitting simulated deposit or withdrawal operations (FR-CUST-TX-02).
 */
export function DepositWithdrawModal({
  account,
  mode,
  isOpen,
  onClose,
  onSuccess,
}: DepositWithdrawModalProps) {
  const titleId = useId();
  const depositMutation = useDepositMutation();
  const withdrawMutation = useWithdrawMutation();

  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  if (!isOpen || !account) return null;

  const isDeposit = mode === 'DEPOSIT';
  const isPending = depositMutation.isPending || withdrawMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setServerError(null);

    let amount: Money;
    try {
      amount = Money.from(amountStr, account.currency);
      if (amount.isZero() || amount.isNegative()) {
        setError('Amount must be strictly positive');
        return;
      }
    } catch {
      setError('Invalid monetary format');
      return;
    }

    if (!isDeposit) {
      // Withdrawal client pre-check
      const available = account.availableBalance || account.derivedBalance;
      if (amount.greaterThan(available)) {
        setError(`Amount exceeds available balance (${available.format()})`);
        return;
      }
    }

    const reference = `${isDeposit ? 'DEP' : 'WTH'}-${Date.now().toString().slice(-6)}`;

    try {
      if (isDeposit) {
        await depositMutation.mutateAsync({
          command: {
            accountId: account.id,
            amount,
            reference,
            description: description || 'Simulated Deposit',
          },
          idempotencyKey,
        });
      } else {
        await withdrawMutation.mutateAsync({
          command: {
            accountId: account.id,
            amount,
            reference,
            description: description || 'Simulated Withdrawal',
          },
          idempotencyKey,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setServerError(parseBackendError(err));
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog deposit-withdraw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="deposit-withdraw-modal"
      >
        <header className="deposit-withdraw-modal__header">
          <h3 id={titleId} className="deposit-withdraw-modal__title">
            {isDeposit ? 'Deposit Funds' : 'Withdraw Funds'}
          </h3>
          <button
            type="button"
            className="deposit-withdraw-modal__close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="dw-close-btn"
          >
            ✕
          </button>
        </header>

        <div className="deposit-withdraw-modal__meta">
          <p>
            <strong>Account:</strong> {account.label} (<code>{account.id}</code>)
          </p>
          <p>
            <strong>Current Balance:</strong>{' '}
            {(account.derivedBalance || account.availableBalance)?.format() || '—'}
          </p>
        </div>

        {serverError && (
          <div className="deposit-withdraw-modal__alert" data-testid="dw-server-error">
            <DomainErrorBanner error={serverError} onDismiss={() => setServerError(null)} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="deposit-withdraw-modal__form">
          <div className="deposit-withdraw-modal__field">
            <label htmlFor="dw-amount" className="deposit-withdraw-modal__label">
              Amount ({account.currency}):
            </label>
            <input
              id="dw-amount"
              type="text"
              inputMode="decimal"
              className="deposit-withdraw-modal__input"
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value);
                setError(null);
              }}
              placeholder="0.00"
              required
              data-testid="dw-amount-input"
            />
            {error && (
              <span className="deposit-withdraw-modal__error" role="alert" data-testid="dw-error">
                {error}
              </span>
            )}
          </div>

          <div className="deposit-withdraw-modal__field">
            <label htmlFor="dw-description" className="deposit-withdraw-modal__label">
              Description:
            </label>
            <input
              id="dw-description"
              type="text"
              className="deposit-withdraw-modal__input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Branch deposit, ATM cash"
              data-testid="dw-desc-input"
            />
          </div>

          <footer className="deposit-withdraw-modal__footer">
            <button
              type="button"
              className="deposit-withdraw-modal__cancel-btn"
              onClick={onClose}
              data-testid="dw-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="deposit-withdraw-modal__submit-btn"
              disabled={isPending || !amountStr}
              data-testid="dw-submit-btn"
            >
              {isPending ? 'Processing...' : isDeposit ? 'Confirm Deposit' : 'Confirm Withdrawal'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
