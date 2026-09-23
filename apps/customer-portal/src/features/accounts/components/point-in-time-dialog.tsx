import { useState, useId } from 'react';
import { usePointInTimeBalance } from '../hooks/use-point-in-time-balance';
import type { Account } from '../types';

export interface PointInTimeDialogProps {
  account: Account;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Formats a Date object to YYYY-MM-DDTHH:mm string for datetime-local input.
 */
function toInputDateTimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

/**
 * Modal dialog for inspecting historical derived balances at a specified timestamp (FR-CUST-ACC-02).
 */
export function PointInTimeDialog({ account, isOpen, onClose }: PointInTimeDialogProps) {
  const titleId = useId();
  const inputId = useId();

  // Default to 1 hour ago
  const defaultDate = new Date(Date.now() - 3600 * 1000);
  const [dateTimeString, setDateTimeString] = useState(toInputDateTimeString(defaultDate));
  const [submittedIso, setSubmittedIso] = useState<string | null>(null);

  // Maximum selectable datetime is right now (no future queries)
  const maxDateTime = toInputDateTimeString(new Date());

  const { balance, isLoading, isError, error } = usePointInTimeBalance({
    accountId: account.id,
    asOf: submittedIso ?? undefined,
    currency: account.currency,
    enabled: isOpen && Boolean(submittedIso),
  });

  if (!isOpen) return null;

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateTimeString) return;

    const parsed = new Date(dateTimeString);
    if (!isNaN(parsed.getTime())) {
      setSubmittedIso(parsed.toISOString());
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
        className="modal-dialog point-in-time-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="pit-dialog"
      >
        <header className="point-in-time-dialog__header">
          <h3 id={titleId} className="point-in-time-dialog__title">
            Point-in-Time Balance Inspector
          </h3>
          <button
            type="button"
            className="point-in-time-dialog__close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            data-testid="pit-close-btn"
          >
            ✕
          </button>
        </header>

        <div className="point-in-time-dialog__meta">
          <p>
            <strong>Account:</strong> <span data-testid="pit-account-label">{account.label}</span> (
            <code>{account.id}</code>)
          </p>
          <p>
            <strong>Current Derived Balance:</strong>{' '}
            <span data-testid="current-balance">{account.derivedBalance.format()}</span>
          </p>
        </div>

        <form onSubmit={handleQuery} className="point-in-time-dialog__form">
          <label htmlFor={inputId} className="point-in-time-dialog__label">
            Select Historical Date & Time:
          </label>
          <input
            id={inputId}
            type="datetime-local"
            className="point-in-time-dialog__input"
            value={dateTimeString}
            max={maxDateTime}
            onChange={(e) => setDateTimeString(e.target.value)}
            required
            data-testid="pit-datetime-input"
          />

          <button
            type="submit"
            className="point-in-time-dialog__submit-btn"
            disabled={isLoading || !dateTimeString}
            data-testid="pit-submit-btn"
          >
            {isLoading ? 'Querying Engine...' : 'Calculate Balance'}
          </button>
        </form>

        <div className="point-in-time-dialog__results" aria-live="polite">
          {isLoading && (
            <div className="point-in-time-dialog__loading" role="status" data-testid="pit-loading">
              Summing ledger entries at target timestamp...
            </div>
          )}

          {isError && (
            <div className="point-in-time-dialog__error" role="alert" data-testid="pit-error">
              <p>Failed to retrieve balance: {error?.message || 'Unexpected server error'}</p>
            </div>
          )}

          {!isLoading && !isError && balance && submittedIso && (
            <div className="point-in-time-dialog__result-box" data-testid="pit-result">
              <span className="point-in-time-dialog__result-caption">
                Balance as of {new Date(submittedIso).toLocaleString()}:
              </span>
              <strong className="point-in-time-dialog__result-amount" data-testid="pit-amount">
                {balance.format()}
              </strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
