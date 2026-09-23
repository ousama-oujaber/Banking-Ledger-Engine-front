import { TransactionType } from '@ble-frontend/domain-types';
import { TransactionStatusBadge } from './transaction-status-badge';
import type { Transaction } from '../types';

export interface TransactionItemProps {
  transaction: Transaction;
  activeAccountId?: string;
  onViewDetails: (transaction: Transaction) => void;
}

/**
 * Individual Transaction list item in the activity feed (S2-T4).
 */
export function TransactionItem({
  transaction,
  activeAccountId,
  onViewDetails,
}: TransactionItemProps) {
  // Determine if this transaction acts as a debit or credit relative to the active account context
  const isCredit =
    transaction.type === TransactionType.DEPOSIT ||
    (transaction.destinationAccountId && transaction.destinationAccountId === activeAccountId);

  const directionClass = isCredit ? 'tx-item--credit' : 'tx-item--debit';
  const amountPrefix = isCredit ? '+' : '-';

  return (
    <article
      className={`tx-item ${directionClass}`}
      data-testid={`tx-item-${transaction.id}`}
      aria-labelledby={`tx-desc-${transaction.id}`}
    >
      <div className="tx-item__main">
        <div className="tx-item__info">
          <div className="tx-item__header-line">
            <span className="tx-item__type-chip" data-testid="tx-item-type">
              {transaction.type}
            </span>
            <time
              className="tx-item__timestamp"
              dateTime={transaction.createdAt}
              data-testid="tx-item-time"
            >
              {new Date(transaction.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>

          <h4 id={`tx-desc-${transaction.id}`} className="tx-item__description">
            {transaction.description}
          </h4>

          <div className="tx-item__reference-group">
            <span className="tx-item__ref-label">Ref:</span>
            <code className="tx-item__ref-value" data-testid="tx-item-ref">
              {transaction.reference}
            </code>
          </div>
        </div>

        <div className="tx-item__figures">
          <div className="tx-item__amount-container">
            <strong
              className={`tx-item__amount ${
                isCredit ? 'tx-item__amount--credit' : 'tx-item__amount--debit'
              }`}
              data-testid="tx-item-amount"
            >
              {amountPrefix}
              {transaction.amount.format()}
            </strong>
          </div>
          <TransactionStatusBadge state={transaction.state} />
        </div>
      </div>

      <footer className="tx-item__actions">
        <button
          type="button"
          className="tx-item__detail-btn"
          onClick={() => onViewDetails(transaction)}
          data-testid="tx-item-detail-btn"
        >
          View Breakdown
        </button>
      </footer>
    </article>
  );
}
