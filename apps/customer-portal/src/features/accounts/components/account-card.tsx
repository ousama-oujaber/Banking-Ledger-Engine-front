import { AccountStatus } from '@ble-frontend/domain-types';
import { StatusBadge } from './status-badge';
import type { Account } from '../types';

export interface AccountCardProps {
  account: Account;
  onTransferClick?: (account: Account) => void;
  onStatementClick?: (account: Account) => void;
  onBalanceAtClick?: (account: Account) => void;
}

/**
 * AccountCard component adhering to FR-CUST-ACC-01.
 * Renders engine-derived balance, currency, type, and semantic status chips.
 */
export function AccountCard({
  account,
  onTransferClick,
  onStatementClick,
  onBalanceAtClick,
}: AccountCardProps) {
  const isFrozen = account.status === AccountStatus.FROZEN;
  const isClosed = account.status === AccountStatus.CLOSED;
  const hasHolds = account.heldAmount && !account.heldAmount.isZero();

  return (
    <article
      className={`account-card ${isFrozen ? 'account-card--frozen' : ''} ${
        isClosed ? 'account-card--closed' : ''
      }`.trim()}
      data-testid={`account-card-${account.id}`}
      aria-labelledby={`account-title-${account.id}`}
    >
      <header className="account-card__header">
        <div className="account-card__title-group">
          <h3 id={`account-title-${account.id}`} className="account-card__label">
            {account.label}
          </h3>
          <code className="account-card__id" title={account.id}>
            {account.id}
          </code>
        </div>
        <StatusBadge status={account.status} />
      </header>

      <div className="account-card__meta">
        <span className="account-card__type-tag" data-testid="account-type">
          {account.type}
        </span>
        <span className="account-card__currency-tag" data-testid="account-currency">
          {account.currency}
        </span>
      </div>

      <div className="account-card__balance-section">
        <div className="account-card__balance-item account-card__balance-item--primary">
          <span className="account-card__balance-caption">Derived Balance</span>
          <strong className="account-card__balance-amount" data-testid="derived-balance">
            {account.derivedBalance.format()}
          </strong>
        </div>

        {account.availableBalance && (
          <div className="account-card__balance-item">
            <span className="account-card__balance-caption">Available Balance</span>
            <span className="account-card__available-amount" data-testid="available-balance">
              {account.availableBalance.format()}
            </span>
          </div>
        )}

        {hasHolds && account.heldAmount && (
          <div className="account-card__balance-item account-card__balance-item--holds">
            <span className="account-card__balance-caption">Held Funds</span>
            <span className="account-card__held-amount" data-testid="held-amount">
              {account.heldAmount.format()}
            </span>
          </div>
        )}
      </div>

      {isFrozen && (
        <aside className="account-card__warning-banner" role="alert" data-testid="frozen-warning">
          Operations restricted: this account is frozen.
        </aside>
      )}

      {isClosed && (
        <aside className="account-card__terminal-banner" role="alert" data-testid="closed-warning">
          This account is closed.
        </aside>
      )}

      <footer className="account-card__actions">
        <button
          type="button"
          className="account-card__action-btn"
          disabled={isFrozen || isClosed}
          onClick={() => onTransferClick?.(account)}
          data-testid="transfer-btn"
        >
          Transfer
        </button>

        <button
          type="button"
          className="account-card__action-btn"
          onClick={() => onStatementClick?.(account)}
          data-testid="statement-btn"
        >
          Statement
        </button>

        <button
          type="button"
          className="account-card__action-btn"
          onClick={() => onBalanceAtClick?.(account)}
          data-testid="balance-at-btn"
        >
          Balance at Date
        </button>
      </footer>
    </article>
  );
}
