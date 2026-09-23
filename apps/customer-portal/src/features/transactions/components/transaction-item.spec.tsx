import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, TransactionState, TransactionType, Money } from '@ble-frontend/domain-types';
import { TransactionItem } from './transaction-item';
import type { Transaction } from '../types';

describe('TransactionItem Component', () => {
  const mockDeposit: Transaction = {
    id: 'tx-100',
    type: TransactionType.DEPOSIT,
    amount: Money.from('250.00', Currency.EUR),
    currency: Currency.EUR,
    reference: 'DEP-2026-001',
    description: 'ATM Cash Deposit',
    state: TransactionState.SETTLED,
    destinationAccountId: 'acc-target-1',
    entries: [],
    createdAt: '2026-09-20T10:30:00Z',
  };

  const mockTransfer: Transaction = {
    id: 'tx-200',
    type: TransactionType.TRANSFER,
    amount: Money.from('50.00', Currency.EUR),
    currency: Currency.EUR,
    reference: 'TRF-2026-002',
    description: 'Wire Transfer to Bob',
    state: TransactionState.POSTED,
    sourceAccountId: 'acc-source-1',
    destinationAccountId: 'acc-target-2',
    entries: [],
    createdAt: '2026-09-21T14:15:00Z',
  };

  it('renders credit transaction with plus sign and credit class', () => {
    render(
      <TransactionItem
        transaction={mockDeposit}
        activeAccountId="acc-target-1"
        onViewDetails={vi.fn()}
      />,
    );

    expect(screen.getByTestId('tx-item-type')).toHaveTextContent('DEPOSIT');
    expect(screen.getByText('ATM Cash Deposit')).toBeInTheDocument();
    expect(screen.getByTestId('tx-item-ref')).toHaveTextContent('DEP-2026-001');

    const amount = screen.getByTestId('tx-item-amount');
    expect(amount).toHaveTextContent('+€250.00');
    expect(amount).toHaveClass('tx-item__amount--credit');
  });

  it('renders debit transaction with minus sign and debit class', () => {
    render(
      <TransactionItem
        transaction={mockTransfer}
        activeAccountId="acc-source-1"
        onViewDetails={vi.fn()}
      />,
    );

    const amount = screen.getByTestId('tx-item-amount');
    expect(amount).toHaveTextContent('-€50.00');
    expect(amount).toHaveClass('tx-item__amount--debit');
  });

  it('triggers onViewDetails callback when View Breakdown button is clicked', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();

    render(
      <TransactionItem
        transaction={mockDeposit}
        activeAccountId="acc-target-1"
        onViewDetails={onViewDetails}
      />,
    );

    await user.click(screen.getByTestId('tx-item-detail-btn'));
    expect(onViewDetails).toHaveBeenCalledWith(mockDeposit);
  });
});
