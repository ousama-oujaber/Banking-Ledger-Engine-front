import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, AccountStatus, AccountType, Money } from '@ble-frontend/domain-types';
import * as transferHookModule from '../hooks/use-transfers';
import { DepositWithdrawModal } from './deposit-withdraw-modal';
import type { Account } from '../../accounts/types';

describe('DepositWithdrawModal Component (FR-CUST-TX-02)', () => {
  const mockAccount: Account = {
    id: 'acc-dw-1',
    ownerId: 'cust-1',
    label: 'Primary Checking',
    currency: Currency.EUR,
    type: AccountType.CLASSIC,
    status: AccountStatus.ACTIVE,
    derivedBalance: Money.from('300.00', Currency.EUR),
    availableBalance: Money.from('250.00', Currency.EUR),
    allowOverdraft: false,
    version: 1,
  };

  let depositMutateMock: ReturnType<typeof vi.fn>;
  let withdrawMutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    depositMutateMock = vi.fn().mockResolvedValue({ id: 'tx-dep-ok', state: 'COMMITTED' });
    withdrawMutateMock = vi.fn().mockResolvedValue({ id: 'tx-wth-ok', state: 'COMMITTED' });

    vi.spyOn(transferHookModule, 'useDepositMutation').mockReturnValue({
      mutateAsync: depositMutateMock,
      isPending: false,
    } as any);

    vi.spyOn(transferHookModule, 'useWithdrawMutation').mockReturnValue({
      mutateAsync: withdrawMutateMock,
      isPending: false,
    } as any);
  });

  it('does not render when isOpen is false or account is null', () => {
    const { rerender } = render(
      <DepositWithdrawModal
        account={mockAccount}
        mode="DEPOSIT"
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('deposit-withdraw-modal')).not.toBeInTheDocument();

    rerender(
      <DepositWithdrawModal account={null} mode="DEPOSIT" isOpen={true} onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId('deposit-withdraw-modal')).not.toBeInTheDocument();
  });

  it('renders deposit mode and submits deposit successfully', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <DepositWithdrawModal
        account={mockAccount}
        mode="DEPOSIT"
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Deposit Funds')).toBeInTheDocument();

    const amountInput = screen.getByTestId('dw-amount-input');
    await user.type(amountInput, '100.00');

    const submitBtn = screen.getByTestId('dw-submit-btn');
    expect(submitBtn).toHaveTextContent('Confirm Deposit');
    await user.click(submitBtn);

    expect(depositMutateMock).toHaveBeenCalledTimes(1);
    expect(depositMutateMock.mock.calls[0][0].command.amount.format()).toBe('€100.00');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders withdrawal mode and prevents amount exceeding available balance', async () => {
    const user = userEvent.setup();

    render(
      <DepositWithdrawModal
        account={mockAccount}
        mode="WITHDRAW"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Withdraw Funds')).toBeInTheDocument();

    const amountInput = screen.getByTestId('dw-amount-input');
    await user.type(amountInput, '400.00'); // Available is 250.00

    const submitBtn = screen.getByTestId('dw-submit-btn');
    await user.click(submitBtn);

    expect(screen.getByTestId('dw-error')).toHaveTextContent('Amount exceeds available balance');
    expect(withdrawMutateMock).not.toHaveBeenCalled();
  });

  it('executes valid withdrawal successfully', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <DepositWithdrawModal
        account={mockAccount}
        mode="WITHDRAW"
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );

    const amountInput = screen.getByTestId('dw-amount-input');
    await user.type(amountInput, '50.00');
    await user.click(screen.getByTestId('dw-submit-btn'));

    expect(withdrawMutateMock).toHaveBeenCalledTimes(1);
    expect(withdrawMutateMock.mock.calls[0][0].command.amount.format()).toBe('€50.00');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders DomainErrorBanner when server operation fails', async () => {
    const user = userEvent.setup();
    depositMutateMock.mockRejectedValueOnce({
      status: 422,
      data: {
        code: 'ACCOUNT_FROZEN',
        message: 'Account is frozen',
        traceId: 'trace-modal-fail',
      },
    });

    render(
      <DepositWithdrawModal account={mockAccount} mode="DEPOSIT" isOpen={true} onClose={vi.fn()} />,
    );

    const amountInput = screen.getByTestId('dw-amount-input');
    await user.type(amountInput, '100.00');
    await user.click(screen.getByTestId('dw-submit-btn'));

    expect(await screen.findByTestId('dw-server-error')).toBeInTheDocument();
    expect(screen.getByTestId('domain-error-banner')).toBeInTheDocument();
    expect(screen.getByTestId('error-banner-code')).toHaveTextContent('Error ACCOUNT_FROZEN');
    expect(screen.getByTestId('error-banner-trace')).toHaveTextContent('trace-modal-fail');
  });
});
