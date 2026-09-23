import { useMemo, useState } from 'react';
import { Money, Currency } from '@ble-frontend/domain-types';
import { useAccounts } from '../hooks/use-accounts';
import { AccountCard } from './account-card';
import { PointInTimeDialog } from './point-in-time-dialog';
import type { Account } from '../types';

export interface AccountListProps {
  customerId?: string;
  onTransferClick?: (account: Account) => void;
  onStatementClick?: (account: Account) => void;
  onBalanceAtClick?: (account: Account) => void;
}

/**
 * Computes aggregated balances grouped strictly by currency.
 * In accordance with Business Rule BR-F01, currencies are NEVER mixed.
 */
export function computeCurrencyTotals(accounts: Account[]): Money[] {
  const map = new Map<string, Money>();

  for (const acc of accounts) {
    const curr = (acc.currency || Currency.EUR).toString();
    const existing = map.get(curr) || Money.zero(curr);
    map.set(curr, existing.add(acc.derivedBalance));
  }

  return Array.from(map.values());
}

/**
 * AccountList overview container component.
 * Manages reactive data states (loading, error, empty, data) and currency totals.
 */
export function AccountList({
  customerId,
  onTransferClick,
  onStatementClick,
  onBalanceAtClick,
}: AccountListProps) {
  const { accounts, isLoading, isError, error, refetch, isFetching } = useAccounts(customerId);
  const [inspectingAccount, setInspectingAccount] = useState<Account | null>(null);

  const currencyTotals = useMemo(() => computeCurrencyTotals(accounts), [accounts]);

  const handleBalanceAt = (acc: Account) => {
    if (onBalanceAtClick) {
      onBalanceAtClick(acc);
    } else {
      setInspectingAccount(acc);
    }
  };

  if (isLoading) {
    return (
      <div className="account-list__state account-list__state--loading" role="status">
        <p>Loading your accounts and balances...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="account-list__state account-list__state--error" role="alert">
        <h3>Unable to load accounts</h3>
        <p>{error?.message || 'A network error occurred while retrieving your accounts.'}</p>
        <button
          type="button"
          className="account-list__retry-btn"
          onClick={() => refetch()}
          data-testid="accounts-retry-btn"
        >
          {isFetching ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="account-list__state account-list__state--empty" data-testid="accounts-empty">
        <h3>No Accounts Found</h3>
        <p>You do not currently hold any active accounts. Please contact an operator or support.</p>
      </div>
    );
  }

  return (
    <section className="account-list" aria-label="Customer Accounts">
      {/* Portfolio Totals Summary grouped strictly by currency */}
      <div className="account-list__summary" data-testid="portfolio-summary">
        <h3 className="account-list__summary-title">Total Portfolio Holdings</h3>
        <div className="account-list__summary-items">
          {currencyTotals.map((total) => (
            <div
              key={total.currency}
              className="account-list__summary-item"
              data-testid={`portfolio-total-${total.currency}`}
            >
              <span className="account-list__summary-currency">{total.currency}</span>
              <strong className="account-list__summary-amount">{total.format()}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Grid of Account Cards */}
      <div className="account-list__grid" data-testid="account-grid">
        {accounts.map((acc) => (
          <AccountCard
            key={acc.id}
            account={acc}
            onTransferClick={onTransferClick}
            onStatementClick={onStatementClick}
            onBalanceAtClick={handleBalanceAt}
          />
        ))}
      </div>

      {/* Historical Point-in-Time Balance Dialog */}
      {inspectingAccount && (
        <PointInTimeDialog
          account={inspectingAccount}
          isOpen={Boolean(inspectingAccount)}
          onClose={() => setInspectingAccount(null)}
        />
      )}
    </section>
  );
}
