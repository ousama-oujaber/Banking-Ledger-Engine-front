import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, AccountStatus, AccountType, Money } from '@ble-frontend/domain-types';
import { AccountCard } from './account-card';
import type { Account } from '../types';

describe('AccountCard Component', () => {
  const mockAccount: Account = {
    id: 'acc-uuid-1234',
    ownerId: 'cust-999',
    label: 'Primary Checking',
    currency: Currency.EUR,
    type: AccountType.CLASSIC,
    status: AccountStatus.ACTIVE,
    derivedBalance: Money.from('1500.50', Currency.EUR),
    availableBalance: Money.from('1500.50', Currency.EUR),
    allowOverdraft: false,
    version: 3,
  };

  it('renders account metadata, currency tag, type tag, and formatted balance', () => {
    render(<AccountCard account={mockAccount} />);

    expect(screen.getByText('Primary Checking')).toBeInTheDocument();
    expect(screen.getByText('acc-uuid-1234')).toBeInTheDocument();
    expect(screen.getByTestId('account-type')).toHaveTextContent('CLASSIC');
    expect(screen.getByTestId('account-currency')).toHaveTextContent('EUR');
    expect(screen.getByTestId('derived-balance')).toHaveTextContent('€1,500.50');
    expect(screen.getByTestId('available-balance')).toHaveTextContent('€1,500.50');
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Active');
  });

  it('renders held funds when heldAmount is present and non-zero', () => {
    const accountWithHolds: Account = {
      ...mockAccount,
      derivedBalance: Money.from('2000.00', Currency.EUR),
      availableBalance: Money.from('1800.00', Currency.EUR),
      heldAmount: Money.from('200.00', Currency.EUR),
    };

    render(<AccountCard account={accountWithHolds} />);

    expect(screen.getByTestId('held-amount')).toHaveTextContent('€200.00');
    expect(screen.getByTestId('available-balance')).toHaveTextContent('€1,800.00');
  });

  it('renders warning alert and disables transfers when account is FROZEN', () => {
    const frozenAccount: Account = {
      ...mockAccount,
      status: AccountStatus.FROZEN,
    };

    render(<AccountCard account={frozenAccount} />);

    expect(screen.getByTestId('frozen-warning')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-btn')).toBeDisabled();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Frozen (Restricted)');
  });

  it('renders closed warning and disables transfers when account is CLOSED', () => {
    const closedAccount: Account = {
      ...mockAccount,
      status: AccountStatus.CLOSED,
    };

    render(<AccountCard account={closedAccount} />);

    expect(screen.getByTestId('closed-warning')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-btn')).toBeDisabled();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Closed');
  });

  it('triggers action callbacks when action buttons are clicked', async () => {
    const user = userEvent.setup();
    const onTransferClick = vi.fn();
    const onStatementClick = vi.fn();
    const onBalanceAtClick = vi.fn();

    render(
      <AccountCard
        account={mockAccount}
        onTransferClick={onTransferClick}
        onStatementClick={onStatementClick}
        onBalanceAtClick={onBalanceAtClick}
      />,
    );

    await user.click(screen.getByTestId('transfer-btn'));
    expect(onTransferClick).toHaveBeenCalledWith(mockAccount);

    await user.click(screen.getByTestId('statement-btn'));
    expect(onStatementClick).toHaveBeenCalledWith(mockAccount);

    await user.click(screen.getByTestId('balance-at-btn'));
    expect(onBalanceAtClick).toHaveBeenCalledWith(mockAccount);
  });
});
