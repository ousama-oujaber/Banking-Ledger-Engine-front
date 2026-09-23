import { useState } from 'react';
import { useTransactions } from '../hooks/use-transactions';
import { TransactionItem } from './transaction-item';
import { TransactionDetailModal } from './transaction-detail-modal';
import type { Transaction } from '../types';

export interface AccountOption {
  id: string;
  label: string;
}

export interface TransactionFeedProps {
  initialAccountId?: string;
  accounts?: AccountOption[];
}

/**
 * Transaction Activity Feed component with account filtering and detail inspection (S2-T4, S2-T5).
 */
export function TransactionFeed({ initialAccountId, accounts = [] }: TransactionFeedProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(initialAccountId);
  const [selectedState, setSelectedState] = useState<string | undefined>(undefined);
  const [inspectingTx, setInspectingTx] = useState<Transaction | null>(null);

  const {
    transactions,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    hasMore,
    loadMore,
    resetPagination,
  } = useTransactions({
    accountId: selectedAccountId || undefined,
    state: selectedState || undefined,
  });

  const handleAccountChange = (newAccId?: string) => {
    setSelectedAccountId(newAccId);
    resetPagination();
  };

  const handleStateChange = (newState?: string) => {
    setSelectedState(newState);
    resetPagination();
  };

  return (
    <section className="tx-feed" aria-label="Transaction Activity Feed">
      <header className="tx-feed__header">
        <div className="tx-feed__title-group">
          <h3 className="tx-feed__title">Activity Feed</h3>
          <span className="tx-feed__count-badge" data-testid="tx-count-badge">
            {transactions.length} Transactions
          </span>
        </div>

        {/* Filter controls */}
        <div className="tx-feed__filters" data-testid="tx-feed-filters">
          {accounts.length > 0 && (
            <div className="tx-feed__filter-item">
              <label htmlFor="tx-account-filter" className="tx-feed__filter-label">
                Filter Account:
              </label>
              <select
                id="tx-account-filter"
                className="tx-feed__select"
                value={selectedAccountId || ''}
                onChange={(e) => handleAccountChange(e.target.value || undefined)}
                data-testid="tx-account-filter"
              >
                <option value="">All Accounts</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} ({acc.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="tx-feed__filter-item">
            <label htmlFor="tx-state-filter" className="tx-feed__filter-label">
              Status:
            </label>
            <select
              id="tx-state-filter"
              className="tx-feed__select"
              value={selectedState || ''}
              onChange={(e) => handleStateChange(e.target.value || undefined)}
              data-testid="tx-state-filter"
            >
              <option value="">All Statuses</option>
              <option value="SETTLED">Settled</option>
              <option value="POSTED">Posted</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>
      </header>

      {/* Content states */}
      <div className="tx-feed__content">
        {isLoading && (
          <div className="tx-feed__state tx-feed__state--loading" role="status">
            <p>Loading transaction activity...</p>
          </div>
        )}

        {isError && (
          <div className="tx-feed__state tx-feed__state--error" role="alert">
            <h4>Unable to load activity feed</h4>
            <p>{error?.message || 'A network error occurred while retrieving transactions.'}</p>
            <button
              type="button"
              className="tx-feed__retry-btn"
              onClick={() => refetch()}
              data-testid="tx-retry-btn"
            >
              {isFetching ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        )}

        {!isLoading && !isError && transactions.length === 0 && (
          <div className="tx-feed__state tx-feed__state--empty" data-testid="tx-feed-empty">
            <h4>No Transactions Found</h4>
            <p>There are no transactions recorded for the selected account and filters.</p>
          </div>
        )}

        {!isLoading && !isError && transactions.length > 0 && (
          <>
            <div className="tx-feed__list" data-testid="tx-list">
              {transactions.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  activeAccountId={selectedAccountId}
                  onViewDetails={(selected) => setInspectingTx(selected)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="tx-feed__pagination" data-testid="tx-pagination">
                <button
                  type="button"
                  className="tx-feed__load-more-btn"
                  onClick={loadMore}
                  disabled={isFetching}
                  data-testid="tx-load-more-btn"
                >
                  {isFetching ? 'Loading more transactions...' : 'Load More Transactions'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Granular Ledger Breakdown Modal */}
      {inspectingTx && (
        <TransactionDetailModal
          transaction={inspectingTx}
          isOpen={Boolean(inspectingTx)}
          onClose={() => setInspectingTx(null)}
        />
      )}
    </section>
  );
}
