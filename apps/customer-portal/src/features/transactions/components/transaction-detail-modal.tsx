import { useId } from 'react';
import { TransactionStatusBadge } from './transaction-status-badge';
import type { Transaction } from '../types';

export interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying double-entry ledger breakdown, idempotency reference, and status (S2-T5).
 */
export function TransactionDetailModal({
  transaction,
  isOpen,
  onClose,
}: TransactionDetailModalProps) {
  const titleId = useId();

  if (!isOpen || !transaction) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog transaction-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="tx-detail-modal"
      >
        <header className="transaction-detail-modal__header">
          <div className="transaction-detail-modal__title-group">
            <h3 id={titleId} className="transaction-detail-modal__title">
              Transaction Details
            </h3>
            <TransactionStatusBadge state={transaction.state} />
          </div>
          <button
            type="button"
            className="transaction-detail-modal__close-btn"
            onClick={onClose}
            aria-label="Close details"
            data-testid="tx-modal-close-btn"
          >
            ✕
          </button>
        </header>

        <div className="transaction-detail-modal__body">
          {/* Metadata Grid */}
          <div className="transaction-detail-modal__meta-grid">
            <div className="transaction-detail-modal__meta-item">
              <span className="transaction-detail-modal__caption">Transaction ID</span>
              <code className="transaction-detail-modal__code" data-testid="tx-modal-id">
                {transaction.id}
              </code>
            </div>

            <div className="transaction-detail-modal__meta-item">
              <span className="transaction-detail-modal__caption">Reference / Idempotency Key</span>
              <code className="transaction-detail-modal__code" data-testid="tx-modal-reference">
                {transaction.reference}
              </code>
            </div>

            <div className="transaction-detail-modal__meta-item">
              <span className="transaction-detail-modal__caption">Type</span>
              <strong className="transaction-detail-modal__type" data-testid="tx-modal-type">
                {transaction.type}
              </strong>
            </div>

            <div className="transaction-detail-modal__meta-item">
              <span className="transaction-detail-modal__caption">Total Amount</span>
              <strong className="transaction-detail-modal__amount" data-testid="tx-modal-amount">
                {transaction.amount.format()}
              </strong>
            </div>

            <div className="transaction-detail-modal__meta-item">
              <span className="transaction-detail-modal__caption">Timestamp</span>
              <time dateTime={transaction.createdAt} data-testid="tx-modal-timestamp">
                {new Date(transaction.createdAt).toLocaleString()}
              </time>
            </div>

            <div className="transaction-detail-modal__meta-item">
              <span className="transaction-detail-modal__caption">Description</span>
              <span data-testid="tx-modal-description">{transaction.description}</span>
            </div>
          </div>

          {/* Failure Alert if applicable */}
          {transaction.failureReason && (
            <div
              className="transaction-detail-modal__failure-alert"
              role="alert"
              data-testid="tx-modal-failure-reason"
            >
              <strong>Failure Reason:</strong> {transaction.failureReason}
            </div>
          )}

          {/* Double-Entry Ledger Entries Table */}
          <section
            className="transaction-detail-modal__entries-section"
            aria-label="Double-Entry Breakdown"
          >
            <h4 className="transaction-detail-modal__section-title">
              Double-Entry Ledger Postings
            </h4>
            <p className="transaction-detail-modal__section-desc">
              Atomic debit and credit postings recorded on the core ledger.
            </p>

            {transaction.entries.length === 0 ? (
              <p className="transaction-detail-modal__no-entries" data-testid="tx-modal-no-entries">
                No granular ledger postings recorded for this transaction.
              </p>
            ) : (
              <table
                className="transaction-detail-modal__table"
                data-testid="tx-modal-entries-table"
              >
                <thead>
                  <tr>
                    <th scope="col">Entry ID</th>
                    <th scope="col">Account ID</th>
                    <th scope="col">Direction</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transaction.entries.map((entry, idx) => (
                    <tr
                      key={entry.id || idx}
                      data-testid={`tx-modal-entry-${entry.id || idx}`}
                      className={`tx-entry tx-entry--${entry.type.toLowerCase()}`}
                    >
                      <td>
                        <code>{entry.id || `#${idx + 1}`}</code>
                      </td>
                      <td>
                        <code>{entry.accountId}</code>
                      </td>
                      <td>
                        <span
                          className={`tx-entry__direction tx-entry__direction--${entry.type.toLowerCase()}`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="tx-entry__amount">{entry.amount.format()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <footer className="transaction-detail-modal__footer">
          <button type="button" className="transaction-detail-modal__dismiss-btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
