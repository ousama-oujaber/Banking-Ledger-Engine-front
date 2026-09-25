import { useState, useId, useMemo } from 'react';
import { Money, Currency, parseBackendError, type AppError } from '@ble-frontend/domain-types';
import type { TransactionResponse } from '@ble-frontend/api-client';
import { useAccounts } from '../../accounts';
import { useTransferMutation } from '../hooks/use-transfers';
import { generateIdempotencyKey } from '../idempotency';
import { validateTransferCommand, type TransferCommand, type TransferState } from '../types';
import { TransferConfirmationModal } from './transfer-confirmation-modal';
import { DomainErrorBanner } from '../../errors';

export interface TransferFormProps {
  initialSourceAccountId?: string;
  initialDestinationAccountId?: string;
  initialCurrency?: Currency;
  onSuccess?: (tx: TransactionResponse) => void;
}

/**
 * Transfer Form component with client validation and client-side idempotency preservation (S3-T1, S3-T2).
 */
export function TransferForm({
  initialSourceAccountId,
  initialDestinationAccountId,
  initialCurrency,
  onSuccess,
}: TransferFormProps) {
  const { accounts } = useAccounts();
  const transferMutation = useTransferMutation();

  const [fromAccountId, setFromAccountId] = useState(
    initialSourceAccountId || (accounts.length > 0 ? accounts[0].id : ''),
  );
  const [toAccountId, setToAccountId] = useState(initialDestinationAccountId || '');
  const [amountStr, setAmountStr] = useState('');
  const [currency, setCurrency] = useState<Currency>(
    initialCurrency || (accounts.length > 0 ? (accounts[0].currency as Currency) : Currency.EUR),
  );
  const [reference, setReference] = useState(`TRF-${Date.now().toString().slice(-6)}`);
  const [description, setDescription] = useState('');

  // Persistent idempotency key per draft session
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());
  const [state, setState] = useState<TransferState>('DRAFT');
  const [clientErrors, setClientErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<AppError | null>(null);
  const [confirmedTx, setConfirmedTx] = useState<TransactionResponse | null>(null);

  const fromAccount = useMemo(
    () => accounts.find((a) => a.id === fromAccountId) || null,
    [accounts, fromAccountId],
  );

  const toAccount = useMemo(
    () => accounts.find((a) => a.id === toAccountId) || null,
    [accounts, toAccountId],
  );

  // Sync currency with selected source account if changed
  const handleSourceAccountChange = (id: string) => {
    setFromAccountId(id);
    const matched = accounts.find((a) => a.id === id);
    if (matched && matched.currency) {
      setCurrency(matched.currency as Currency);
    }
    setClientErrors((prev) => ({ ...prev, fromAccountId: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Build partial command
    let moneyAmount: Money | null = null;
    try {
      if (amountStr) {
        moneyAmount = Money.from(amountStr, currency);
      }
    } catch (parseErr) {
      setClientErrors((prev) => ({
        ...prev,
        amount: 'Invalid monetary amount format',
      }));
      return;
    }

    const command: Partial<TransferCommand> = {
      fromAccountId,
      toAccountId,
      amount: moneyAmount ?? undefined,
      reference,
      description,
    };

    setState('VALIDATING');
    const validation = validateTransferCommand(command, fromAccount, toAccount);

    if (!validation.isValid) {
      setClientErrors(validation.errors as Record<string, string>);
      setState('DRAFT');
      return;
    }

    setClientErrors({});
    setState('SUBMITTING');

    try {
      const response = await transferMutation.mutateAsync({
        command: command as TransferCommand,
        idempotencyKey,
      });

      setState('CONFIRMED');
      setConfirmedTx(response);
      onSuccess?.(response);

      // Generate a fresh idempotency key and reference for the NEXT transfer
      setIdempotencyKey(generateIdempotencyKey());
      setReference(`TRF-${Date.now().toString().slice(-6)}`);
      setAmountStr('');
      setDescription('');
    } catch (err) {
      const appErr = parseBackendError(err);
      setServerError(appErr);
      setState('REJECTED');
    }
  };

  const handleRetry = () => {
    // Retrying preserves the SAME idempotency key (BR-F03)!
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="transfer-form-container" data-testid="transfer-form-container">
      <form onSubmit={handleSubmit} className="transfer-form" data-testid="transfer-form">
        <header className="transfer-form__header">
          <h3 className="transfer-form__title">Intra-Bank Transfer</h3>
          <p className="transfer-form__subtitle">
            Transfer money between accounts with atomic double-entry postings.
          </p>
        </header>

        {/* Server Domain Error Banner */}
        {serverError && (
          <div className="transfer-form__error-wrapper" data-testid="transfer-error-banner">
            <DomainErrorBanner
              error={serverError}
              onDismiss={() => setServerError(null)}
              onRetry={handleRetry}
            />
            <button
              type="button"
              className="transfer-form__retry-btn"
              onClick={handleRetry}
              data-testid="transfer-retry-btn"
              style={{ marginTop: '0.5rem' }}
            >
              Retry Transfer (Preserves Idempotency Key)
            </button>
          </div>
        )}

        {/* Source Account Field */}
        <div className="transfer-form__field">
          <label htmlFor="fromAccountId" className="transfer-form__label">
            From Account:
          </label>
          <select
            id="fromAccountId"
            className="transfer-form__select"
            value={fromAccountId}
            onChange={(e) => handleSourceAccountChange(e.target.value)}
            data-testid="from-account-select"
            required
          >
            <option value="">Select source account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.label} ({acc.currency} - Available:{' '}
                {acc.availableBalance ? acc.availableBalance.format() : acc.derivedBalance.format()}
                )
              </option>
            ))}
          </select>
          {clientErrors.fromAccountId && (
            <span
              className="transfer-form__field-error"
              data-testid="error-fromAccountId"
              role="alert"
            >
              {clientErrors.fromAccountId}
            </span>
          )}
        </div>

        {/* Destination Account Field */}
        <div className="transfer-form__field">
          <label htmlFor="toAccountId" className="transfer-form__label">
            To Account ID:
          </label>
          <input
            id="toAccountId"
            type="text"
            className="transfer-form__input"
            value={toAccountId}
            onChange={(e) => {
              setToAccountId(e.target.value);
              setClientErrors((prev) => ({ ...prev, toAccountId: undefined }));
            }}
            placeholder="e.g. acc-destination-uuid"
            data-testid="to-account-input"
            required
          />
          {clientErrors.toAccountId && (
            <span
              className="transfer-form__field-error"
              data-testid="error-toAccountId"
              role="alert"
            >
              {clientErrors.toAccountId}
            </span>
          )}
        </div>

        {/* Amount & Currency Fields */}
        <div className="transfer-form__row">
          <div className="transfer-form__field transfer-form__field--amount">
            <label htmlFor="transfer-amount" className="transfer-form__label">
              Amount:
            </label>
            <input
              id="transfer-amount"
              type="text"
              inputMode="decimal"
              className="transfer-form__input"
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value);
                setClientErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              placeholder="0.00"
              data-testid="transfer-amount-input"
              required
            />
            {clientErrors.amount && (
              <span className="transfer-form__field-error" data-testid="error-amount" role="alert">
                {clientErrors.amount}
              </span>
            )}
          </div>

          <div className="transfer-form__field transfer-form__field--currency">
            <label htmlFor="transfer-currency" className="transfer-form__label">
              Currency:
            </label>
            <select
              id="transfer-currency"
              className="transfer-form__select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              data-testid="transfer-currency-select"
            >
              {Object.values(Currency).map((curr) => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {clientErrors.currency && (
          <div className="transfer-form__field-error" data-testid="error-currency" role="alert">
            {clientErrors.currency}
          </div>
        )}

        {/* Reference & Description */}
        <div className="transfer-form__field">
          <label htmlFor="transfer-reference" className="transfer-form__label">
            Reference / Idempotency Key:
          </label>
          <input
            id="transfer-reference"
            type="text"
            className="transfer-form__input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            data-testid="transfer-reference-input"
            required
          />
          <small className="transfer-form__hint">
            Client Idempotency UUID: <code>{idempotencyKey}</code>
          </small>
        </div>

        <div className="transfer-form__field">
          <label htmlFor="transfer-description" className="transfer-form__label">
            Description (Optional):
          </label>
          <input
            id="transfer-description"
            type="text"
            className="transfer-form__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Invoice payment, rent, gift"
            data-testid="transfer-description-input"
          />
        </div>

        {/* Submit Actions */}
        <footer className="transfer-form__actions">
          <button
            type="submit"
            className="transfer-form__submit-btn"
            disabled={state === 'SUBMITTING' || transferMutation.isPending}
            data-testid="transfer-submit-btn"
          >
            {state === 'SUBMITTING' || transferMutation.isPending
              ? 'Submitting Transfer...'
              : 'Submit Transfer'}
          </button>
        </footer>
      </form>

      {/* Confirmation Modal */}
      {confirmedTx && (
        <TransferConfirmationModal
          transaction={confirmedTx}
          isOpen={Boolean(confirmedTx)}
          onClose={() => setConfirmedTx(null)}
        />
      )}
    </div>
  );
}
