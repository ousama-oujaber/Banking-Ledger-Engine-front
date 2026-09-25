import { useState, useEffect, useId } from 'react';
import type { TransactionResponse } from '@ble-frontend/api-client';
import { parseBackendError, type AppError } from '@ble-frontend/domain-types';
import { useExecuteFxTransferMutation } from '../hooks/use-fx';
import type { FxQuote } from '../types';
import { DomainErrorBanner } from '../../errors';

export interface FxQuoteDialogProps {
  quote: FxQuote | null;
  sourceAccountId: string;
  destinationAccountId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshQuote?: () => void;
  onTransferSuccess?: (tx: TransactionResponse) => void;
}

/**
 * Calculates remaining seconds until quote expiration timestamp.
 */
export function calculateRemainingSeconds(expiresAt?: string): number {
  if (!expiresAt) return 0;
  const expiryTime = new Date(expiresAt).getTime();
  const diff = expiryTime - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Formats seconds into MM:SS string.
 */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * FX Guaranteed Quote Modal with dynamic countdown timer and dual-leg transfer confirmation (FR-CUST-FX-01, FR-CUST-FX-02).
 */
export function FxQuoteDialog({
  quote,
  sourceAccountId,
  destinationAccountId,
  isOpen,
  onClose,
  onRefreshQuote,
  onTransferSuccess,
}: FxQuoteDialogProps) {
  const titleId = useId();
  const executeMutation = useExecuteFxTransferMutation();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    calculateRemainingSeconds(quote?.expiresAt),
  );
  const [confirmedTx, setConfirmedTx] = useState<TransactionResponse | null>(null);
  const [error, setError] = useState<AppError | string | null>(null);

  // Active countdown timer effect
  useEffect(() => {
    if (!isOpen || !quote?.expiresAt) return;

    setSecondsRemaining(calculateRemainingSeconds(quote.expiresAt));

    const interval = setInterval(() => {
      const remaining = calculateRemainingSeconds(quote.expiresAt);
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, quote?.expiresAt]);

  if (!isOpen || !quote) return null;

  const isExpired = secondsRemaining <= 0 || quote.status === 'EXPIRED';

  const handleExecute = async () => {
    if (isExpired) return;
    setError(null);

    const reference = `FX-${Date.now().toString().slice(-6)}`;

    try {
      const tx = await executeMutation.mutateAsync({
        command: {
          quoteReference: quote.quoteReference,
          sourceAccountId,
          destinationAccountId,
          reference,
          description: `FX Transfer ${quote.sourceCurrency}->${quote.targetCurrency}`,
        },
      });

      setConfirmedTx(tx);
      onTransferSuccess?.(tx);
    } catch (err: any) {
      setError(parseBackendError(err));
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
        className="modal-dialog fx-quote-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="fx-quote-dialog"
      >
        <header className="fx-quote-dialog__header">
          <h3 id={titleId} className="fx-quote-dialog__title">
            {confirmedTx ? 'Cross-Currency Transfer Completed' : 'Guaranteed FX Quote'}
          </h3>
          <button
            type="button"
            className="fx-quote-dialog__close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="fx-quote-close-btn"
          >
            ✕
          </button>
        </header>

        {!confirmedTx ? (
          <div className="fx-quote-dialog__content">
            {/* Countdown validity banner */}
            <div
              className={`fx-quote-dialog__timer-box ${
                isExpired ? 'fx-quote-dialog__timer-box--expired' : ''
              }`}
              data-testid="fx-quote-timer-box"
            >
              <span className="fx-quote-dialog__timer-label">Quote Validity:</span>
              <strong className="fx-quote-dialog__timer-count" data-testid="fx-quote-countdown">
                {formatCountdown(secondsRemaining)}
              </strong>
              {isExpired && (
                <span
                  className="fx-quote-dialog__expired-badge"
                  data-testid="fx-quote-expired-badge"
                >
                  EXPIRED
                </span>
              )}
            </div>

            {/* Conversion Details */}
            <div className="fx-quote-dialog__quote-details" data-testid="fx-quote-details">
              <div className="fx-quote-dialog__detail-row">
                <span>You Send:</span>
                <strong data-testid="fx-quote-source-amount">{quote.sourceAmount.format()}</strong>
              </div>

              <div className="fx-quote-dialog__detail-row">
                <span>Guaranteed Exchange Rate:</span>
                <strong data-testid="fx-quote-rate">
                  1 {quote.sourceCurrency} = {quote.exchangeRate.toFixed(4)} {quote.targetCurrency}
                </strong>
              </div>

              <div className="fx-quote-dialog__detail-row fx-quote-dialog__detail-row--target">
                <span>Recipient Gets:</span>
                <strong data-testid="fx-quote-target-amount">{quote.targetAmount.format()}</strong>
              </div>

              <div className="fx-quote-dialog__meta-info">
                <small>
                  Quote Reference: <code>{quote.quoteReference}</code>
                </small>
              </div>
            </div>

            {error && (
              <div className="fx-quote-dialog__error" data-testid="fx-execute-error">
                <DomainErrorBanner error={error} onDismiss={() => setError(null)} />
              </div>
            )}

            <footer className="fx-quote-dialog__actions">
              {isExpired ? (
                <button
                  type="button"
                  className="fx-quote-dialog__refresh-btn"
                  onClick={onRefreshQuote}
                  data-testid="fx-refresh-quote-btn"
                >
                  Refresh Quote
                </button>
              ) : (
                <button
                  type="button"
                  className="fx-quote-dialog__execute-btn"
                  onClick={handleExecute}
                  disabled={executeMutation.isPending || isExpired}
                  data-testid="fx-execute-btn"
                >
                  {executeMutation.isPending ? 'Executing FX Transfer...' : 'Execute FX Transfer'}
                </button>
              )}
            </footer>
          </div>
        ) : (
          /* Dual-leg Accounting Confirmation (FR-CUST-FX-02) */
          <div className="fx-quote-dialog__confirmation" data-testid="fx-dual-leg-confirmation">
            <div className="fx-quote-dialog__confirmed-banner">
              ✓ Dual-Leg Multi-Currency Settlement Completed
            </div>

            <div className="fx-quote-dialog__dual-leg-grid">
              <div className="fx-quote-dialog__leg fx-quote-dialog__leg--source">
                <h4>Leg 1: Source Debit</h4>
                <p>
                  Account: <code>{sourceAccountId}</code>
                </p>
                <p>
                  Debited: <strong>{quote.sourceAmount.format()}</strong>
                </p>
              </div>

              <div className="fx-quote-dialog__leg fx-quote-dialog__leg--dest">
                <h4>Leg 2: Destination Credit</h4>
                <p>
                  Account: <code>{destinationAccountId}</code>
                </p>
                <p>
                  Credited: <strong>{quote.targetAmount.format()}</strong>
                </p>
              </div>
            </div>

            <div className="fx-quote-dialog__tx-info">
              <p>
                Transaction ID: <code>{confirmedTx.id}</code>
              </p>
              <p>
                Rate Applied:{' '}
                <strong>
                  1 {quote.sourceCurrency} = {quote.exchangeRate.toFixed(4)} {quote.targetCurrency}
                </strong>
              </p>
            </div>

            <footer className="fx-quote-dialog__actions">
              <button
                type="button"
                className="fx-quote-dialog__dismiss-btn"
                onClick={onClose}
                data-testid="fx-confirm-dismiss-btn"
              >
                Done
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
