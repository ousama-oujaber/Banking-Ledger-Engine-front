import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Currency,
  TransactionState,
  TransactionType,
  EntryType,
  Money,
} from '@ble-frontend/domain-types';
import { TransactionDetailModal } from './transaction-detail-modal';
import type { Transaction } from '../types';

describe('TransactionDetailModal Component', () => {
  const mockTx: Transaction = {
    id: 'tx-uuid-999',
    type: TransactionType.TRANSFER,
    amount: Money.from('100.00', Currency.EUR),
    currency: Currency.EUR,
    reference: 'IDEMP-KEY-UUID-1',
    description: 'Internal Transfer',
    state: TransactionState.SETTLED,
    createdAt: '2026-09-22T08:00:00Z',
    entries: [
      {
        id: 'entry-1',
        accountId: 'acc-source',
        type: EntryType.DEBIT,
        amount: Money.from('100.00', Currency.EUR),
      },
      {
        id: 'entry-2',
        accountId: 'acc-dest',
        type: EntryType.CREDIT,
        amount: Money.from('100.00', Currency.EUR),
      },
    ],
  };

  it('does not render when isOpen is false', () => {
    render(<TransactionDetailModal transaction={mockTx} isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('tx-detail-modal')).not.toBeInTheDocument();
  });

  it('renders metadata, reference, and double-entry postings table when open', () => {
    render(<TransactionDetailModal transaction={mockTx} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('tx-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('tx-modal-id')).toHaveTextContent('tx-uuid-999');
    expect(screen.getByTestId('tx-modal-reference')).toHaveTextContent('IDEMP-KEY-UUID-1');
    expect(screen.getByTestId('tx-modal-amount')).toHaveTextContent('€100.00');

    // Table rows
    expect(screen.getByTestId('tx-modal-entry-entry-1')).toBeInTheDocument();
    expect(screen.getByTestId('tx-modal-entry-entry-2')).toBeInTheDocument();
    expect(screen.getByText('acc-source')).toBeInTheDocument();
    expect(screen.getByText('acc-dest')).toBeInTheDocument();
  });

  it('displays failure reason when transaction failed', () => {
    const failedTx: Transaction = {
      ...mockTx,
      state: TransactionState.FAILED,
      failureReason: 'Insufficient available funds',
    };

    render(<TransactionDetailModal transaction={failedTx} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('tx-modal-failure-reason')).toHaveTextContent(
      'Insufficient available funds',
    );
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<TransactionDetailModal transaction={mockTx} isOpen={true} onClose={onClose} />);

    await user.click(screen.getByTestId('tx-modal-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays atomic entry balanced badge when debits equal credits', () => {
    render(<TransactionDetailModal transaction={mockTx} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('tx-modal-balance-check')).toBeInTheDocument();
    expect(screen.getByTestId('tx-balanced-badge')).toHaveTextContent(
      '✓ Atomic Entry Balanced: Debits equal Credits (Net Zero)',
    );
  });

  it('displays warning badge when postings do not balance', () => {
    const unbalancedTx: Transaction = {
      ...mockTx,
      entries: [
        {
          id: 'entry-1',
          accountId: 'acc-source',
          type: EntryType.DEBIT,
          amount: Money.from('100.00', Currency.EUR),
        },
        {
          id: 'entry-2',
          accountId: 'acc-dest',
          type: EntryType.CREDIT,
          amount: Money.from('80.00', Currency.EUR),
        },
      ],
    };

    render(<TransactionDetailModal transaction={unbalancedTx} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('tx-unbalanced-badge')).toHaveTextContent(
      '⚠ Warning: Ledger postings do not sum to net zero',
    );
  });

  it('renders fallback message when transaction has no entries', () => {
    const noEntriesTx: Transaction = {
      ...mockTx,
      entries: [],
    };

    render(<TransactionDetailModal transaction={noEntriesTx} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('tx-modal-no-entries')).toBeInTheDocument();
  });

  it('calls onClose when backdrop or footer dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<TransactionDetailModal transaction={mockTx} isOpen={true} onClose={onClose} />);

    // Click footer dismiss button
    const dismissBtn = screen.getByText('Close');
    await user.click(dismissBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click backdrop
    const backdrop = screen.getByRole('presentation');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
