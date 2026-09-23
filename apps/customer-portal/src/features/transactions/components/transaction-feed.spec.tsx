import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, TransactionState, TransactionType, Money } from '@ble-frontend/domain-types';
import { TransactionFeed } from './transaction-feed';
import * as txHookModule from '../hooks/use-transactions';
import type { Transaction } from '../types';

describe('TransactionFeed Component', () => {
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: TransactionType.DEPOSIT,
      amount: Money.from('200.00', Currency.EUR),
      currency: Currency.EUR,
      reference: 'REF-1',
      description: 'Payroll Deposit',
      state: TransactionState.SETTLED,
      entries: [],
      createdAt: '2026-09-22T10:00:00Z',
    },
    {
      id: 'tx-2',
      type: TransactionType.WITHDRAWAL,
      amount: Money.from('40.00', Currency.EUR),
      currency: Currency.EUR,
      reference: 'REF-2',
      description: 'ATM Withdrawal',
      state: TransactionState.POSTED,
      entries: [],
      createdAt: '2026-09-22T12:00:00Z',
    },
  ];

  const defaultMockResult: txHookModule.UseTransactionsResult = {
    transactions: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
    page: 1,
    hasMore: false,
    loadMore: vi.fn(),
    resetPagination: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({ ...defaultMockResult });
  });

  it('renders loading state when isLoading is true', () => {
    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      isLoading: true,
    });

    render(<TransactionFeed />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading transaction activity...');
  });

  it('renders error state and retry button when isError is true', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();

    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      isError: true,
      error: new Error('Network timeout'),
      refetch,
    });

    render(<TransactionFeed />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();

    await user.click(screen.getByTestId('tx-retry-btn'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when transactions list is empty', () => {
    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      transactions: [],
    });

    render(<TransactionFeed />);

    expect(screen.getByTestId('tx-feed-empty')).toBeInTheDocument();
    expect(screen.getByText('No Transactions Found')).toBeInTheDocument();
  });

  it('renders transactions list and updates count badge', () => {
    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      transactions: mockTransactions,
    });

    render(<TransactionFeed />);

    expect(screen.getByTestId('tx-count-badge')).toHaveTextContent('2 Transactions');
    expect(screen.getByTestId('tx-item-tx-1')).toBeInTheDocument();
    expect(screen.getByTestId('tx-item-tx-2')).toBeInTheDocument();
  });

  it('renders account filter dropdown when accounts are provided', async () => {
    const user = userEvent.setup();

    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      transactions: mockTransactions,
    });

    const accounts = [
      { id: 'acc-1', label: 'Primary Checking' },
      { id: 'acc-2', label: 'Savings' },
    ];

    render(<TransactionFeed accounts={accounts} />);

    const accountSelect = screen.getByTestId('tx-account-filter');
    expect(accountSelect).toBeInTheDocument();

    await user.selectOptions(accountSelect, 'acc-1');
    expect(accountSelect).toHaveValue('acc-1');
  });

  it('renders status filter and allows status selection', async () => {
    const user = userEvent.setup();

    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      transactions: mockTransactions,
    });

    render(<TransactionFeed />);

    const stateSelect = screen.getByTestId('tx-state-filter');
    expect(stateSelect).toBeInTheDocument();

    await user.selectOptions(stateSelect, 'SETTLED');
    expect(stateSelect).toHaveValue('SETTLED');
  });

  it('renders load more button when hasMore is true and triggers loadMore', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();

    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      transactions: mockTransactions,
      hasMore: true,
      loadMore,
    });

    render(<TransactionFeed />);

    const loadMoreBtn = screen.getByTestId('tx-load-more-btn');
    expect(loadMoreBtn).toBeInTheDocument();
    expect(loadMoreBtn).toHaveTextContent('Load More Transactions');

    await user.click(loadMoreBtn);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('opens TransactionDetailModal when clicking View Details on a transaction', async () => {
    const user = userEvent.setup();

    vi.spyOn(txHookModule, 'useTransactions').mockReturnValue({
      ...defaultMockResult,
      transactions: mockTransactions,
    });

    render(<TransactionFeed />);

    // Click view breakdown button on first tx
    const viewBtn = screen.getAllByTestId('tx-item-detail-btn')[0];
    await user.click(viewBtn);

    // Modal should be open
    expect(screen.getByTestId('tx-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('tx-modal-id')).toHaveTextContent('tx-1');

    // Close modal
    const closeBtn = screen.getByTestId('tx-modal-close-btn');
    await user.click(closeBtn);
    expect(screen.queryByTestId('tx-detail-modal')).not.toBeInTheDocument();
  });
});
