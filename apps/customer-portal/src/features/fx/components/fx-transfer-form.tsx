import { useState, useMemo } from 'react';
import { Currency, Money } from '@ble-frontend/domain-types';
import { useAccounts } from '../../accounts';
import { useRequestQuoteMutation } from '../hooks/use-fx';
import { FxQuoteDialog } from './fx-quote-dialog';
import type { FxQuote } from '../types';
import { DomainErrorBanner } from '../../errors';

export function FxTransferForm() {
  const { accounts } = useAccounts();
  const requestQuoteMutation = useRequestQuoteMutation();

  const [sourceAccountId, setSourceAccountId] = useState(accounts.length > 0 ? accounts[0].id : '');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [targetCurrency, setTargetCurrency] = useState<Currency>(Currency.USD);
  const [amountStr, setAmountStr] = useState('');
  const [activeQuote, setActiveQuote] = useState<FxQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceAccount = useMemo(
    () => accounts.find((a) => a.id === sourceAccountId) || null,
    [accounts, sourceAccountId],
  );

  const sourceCurrency = (sourceAccount?.currency as Currency) || Currency.EUR;

  const handleRequestQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let parsedAmount: number;
    try {
      const money = Money.from(amountStr, sourceCurrency);
      if (money.isZero() || money.isNegative()) {
        setError('Amount must be strictly positive');
        return;
      }
      parsedAmount = money.amount.toNumber();
    } catch {
      setError('Invalid amount format');
      return;
    }

    if (!sourceAccountId) {
      setError('Please select a source account');
      return;
    }

    if (!destinationAccountId) {
      setError('Please enter a destination account');
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      setError('Cannot transfer between identical accounts');
      return;
    }

    try {
      const quote = await requestQuoteMutation.mutateAsync({
        sourceCurrency,
        targetCurrency,
        sourceAmount: parsedAmount,
      });
      setActiveQuote(quote);
    } catch (err: any) {
      setError(err?.data?.message || err?.message || 'Failed to request quote from FX provider');
    }
  };

  const handleRefreshQuote = () => {
    handleRequestQuote({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="fx-transfer-form-container" data-testid="fx-transfer-form-container">
      <form
        onSubmit={handleRequestQuote}
        className="fx-transfer-form"
        data-testid="fx-transfer-form"
      >
        <header className="fx-transfer-form__header">
          <h3 className="fx-transfer-form__title">Multi-Currency FX Transfer</h3>
          <p className="fx-transfer-form__desc">
            Convert currencies at guaranteed live exchange rates with dual-leg double-entry
            execution.
          </p>
        </header>

        {error && (
          <div className="fx-transfer-form__error" data-testid="fx-form-error">
            <DomainErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="fx-transfer-form__field">
          <label htmlFor="fx-source-acc" className="fx-transfer-form__label">
            Source Account (Base Currency):
          </label>
          <select
            id="fx-source-acc"
            className="fx-transfer-form__select"
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
            required
            data-testid="fx-source-acc-select"
          >
            <option value="">Select source account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.label} ({acc.currency} - Balance:{' '}
                {acc.availableBalance ? acc.availableBalance.format() : acc.derivedBalance.format()}
                )
              </option>
            ))}
          </select>
        </div>

        <div className="fx-transfer-form__field">
          <label htmlFor="fx-dest-acc" className="fx-transfer-form__label">
            Destination Account ID:
          </label>
          <input
            id="fx-dest-acc"
            type="text"
            className="fx-transfer-form__input"
            value={destinationAccountId}
            onChange={(e) => setDestinationAccountId(e.target.value)}
            placeholder="e.g. acc-foreign-uuid"
            required
            data-testid="fx-dest-acc-input"
          />
        </div>

        <div className="fx-transfer-form__row">
          <div className="fx-transfer-form__field">
            <label htmlFor="fx-amount" className="fx-transfer-form__label">
              Amount ({sourceCurrency}):
            </label>
            <input
              id="fx-amount"
              type="text"
              inputMode="decimal"
              className="fx-transfer-form__input"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              required
              data-testid="fx-amount-input"
            />
          </div>

          <div className="fx-transfer-form__field">
            <label htmlFor="fx-target-currency" className="fx-transfer-form__label">
              Convert To:
            </label>
            <select
              id="fx-target-currency"
              className="fx-transfer-form__select"
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value as Currency)}
              data-testid="fx-target-currency-select"
            >
              {Object.values(Currency)
                .filter((c) => c !== sourceCurrency)
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <footer className="fx-transfer-form__actions">
          <button
            type="submit"
            className="fx-transfer-form__submit-btn"
            disabled={requestQuoteMutation.isPending || !amountStr}
            data-testid="fx-request-quote-btn"
          >
            {requestQuoteMutation.isPending
              ? 'Requesting Guaranteed Quote...'
              : 'Get Guaranteed Quote'}
          </button>
        </footer>
      </form>

      {/* Quote Dialog with active countdown */}
      {activeQuote && (
        <FxQuoteDialog
          quote={activeQuote}
          sourceAccountId={sourceAccountId}
          destinationAccountId={destinationAccountId}
          isOpen={Boolean(activeQuote)}
          onClose={() => setActiveQuote(null)}
          onRefreshQuote={handleRefreshQuote}
        />
      )}
    </div>
  );
}
