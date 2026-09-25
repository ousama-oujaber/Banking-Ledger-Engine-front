import { useId } from 'react';
import type { TransactionResponse } from '@ble-frontend/api-client';

export interface TransferConfirmationModalProps {
  transaction: TransactionResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying transaction receipt after successful transfer execution (S3-T1).
 */
export function TransferConfirmationModal({
  transaction,
  isOpen,
  onClose,
}: TransferConfirmationModalProps) {
  const titleId = useId();

  if (!isOpen || !transaction) return null;

  const amountDisplay = transaction.amount
    ? `${transaction.amount.amount} ${transaction.amount.currency}`
    : 'N/A';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog transfer-confirmation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="transfer-confirmation-modal"
      >
        <header className="transfer-confirmation-modal__header">
          <h3 id={titleId} className="transfer-confirmation-modal__title">
            Transfer Confirmed
          </h3>
          <button
            type="button"
            className="transfer-confirmation-modal__close-btn"
            onClick={onClose}
            aria-label="Close confirmation"
            data-testid="transfer-confirm-close-btn"
          >
            ✕
          </button>
        </header>

        <div className="transfer-confirmation-modal__body">
          <div className="transfer-confirmation-modal__badge" data-testid="transfer-success-badge">
            ✓ Double-Entry Ledger Posting Committed
          </div>

          <div className="transfer-confirmation-modal__meta-grid">
            <div className="transfer-confirmation-modal__item">
              <span className="transfer-confirmation-modal__label">Transaction ID:</span>
              <code data-testid="confirm-tx-id">{transaction.id}</code>
            </div>

            <div className="transfer-confirmation-modal__item">
              <span className="transfer-confirmation-modal__label">Reference:</span>
              <code data-testid="confirm-tx-ref">{transaction.reference}</code>
            </div>

            <div className="transfer-confirmation-modal__item">
              <span className="transfer-confirmation-modal__label">Source Account:</span>
              <code data-testid="confirm-source-acc">
                {transaction.sourceAccountId || transaction.fromAccountId || 'N/A'}
              </code>
            </div>

            <div className="transfer-confirmation-modal__item">
              <span className="transfer-confirmation-modal__label">Destination Account:</span>
              <code data-testid="confirm-dest-acc">
                {transaction.destinationAccountId || transaction.toAccountId || 'N/A'}
              </code>
            </div>

            <div className="transfer-confirmation-modal__item">
              <span className="transfer-confirmation-modal__label">Amount:</span>
              <strong data-testid="confirm-amount">{amountDisplay}</strong>
            </div>

            <div className="transfer-confirmation-modal__item">
              <span className="transfer-confirmation-modal__label">Status:</span>
              <span data-testid="confirm-status">
                {transaction.state || transaction.status || 'COMMITTED'}
              </span>
            </div>
          </div>
        </div>

        <footer className="transfer-confirmation-modal__footer">
          <button
            type="button"
            className="transfer-confirmation-modal__dismiss-btn"
            onClick={onClose}
            data-testid="transfer-confirm-dismiss-btn"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
