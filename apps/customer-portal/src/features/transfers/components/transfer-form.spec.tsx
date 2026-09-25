import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, AccountStatus, AccountType, Money } from '@ble-frontend/domain-types';
import * as accountsHookModule from '../../accounts';
import * as transferHookModule from '../hooks/use-transfers';
import { TransferForm } from './transfer-form';
import type { Account } from '../../accounts/types';

describe('TransferForm Component (S3-T1, S3-T2)', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc-source-1',
      ownerId: 'cust-1',
      label: 'Main Checking',
      currency: Currency.EUR,
      type: AccountType.CLASSIC,
      status: AccountStatus.ACTIVE,
      derivedBalance: Money.from('1000.00', Currency.EUR),
      availableBalance: Money.from('800.00', Currency.EUR),
      allowOverdraft: false,
      version: 1,
    },
    {
      id: 'acc-savings-2',
      ownerId: 'cust-1',
      label: 'Rainy Day Savings',
      currency: Currency.EUR,
      type: AccountType.SAVINGS,
      status: AccountStatus.ACTIVE,
      derivedBalance: Money.from('5000.00', Currency.EUR),
      availableBalance: Money.from('5000.00', Currency.EUR),
      allowOverdraft: false,
      version: 1,
    },
  ];

  let mutateAsyncMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mutateAsyncMock = vi.fn().mockResolvedValue({
      id: 'tx-confirmed-101',
      type: 'TRANSFER',
      amount: { amount: 100, currency: 'EUR' },
      reference: 'TRF-TEST-REF',
      state: 'COMMITTED',
      sourceAccountId: 'acc-source-1',
      destinationAccountId: 'acc-savings-2',
    });

    vi.spyOn(accountsHookModule, 'useAccounts').mockReturnValue({
      accounts: mockAccounts,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    });

    vi.spyOn(transferHookModule, 'useTransferMutation').mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
    } as any);
  });

  it('renders form fields, source account options, and submit button', () => {
    render(<TransferForm />);

    expect(screen.getByTestId('transfer-form')).toBeInTheDocument();
    expect(screen.getByTestId('from-account-select')).toBeInTheDocument();
    expect(screen.getByTestId('to-account-input')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-amount-input')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-currency-select')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-reference-input')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-submit-btn')).toHaveTextContent('Submit Transfer');
  });

  it('prevents submission and displays inline validation error on self-transfer', async () => {
    const user = userEvent.setup();
    render(<TransferForm initialSourceAccountId="acc-source-1" />);

    const toInput = screen.getByTestId('to-account-input');
    const amountInput = screen.getByTestId('transfer-amount-input');
    const submitBtn = screen.getByTestId('transfer-submit-btn');

    await user.type(toInput, 'acc-source-1'); // Same account!
    await user.type(amountInput, '50.00');
    await user.click(submitBtn);

    expect(screen.getByTestId('error-toAccountId')).toHaveTextContent(
      'Cannot transfer to the same account (self-transfer prohibited)',
    );
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('prevents submission and displays error when amount exceeds available balance', async () => {
    const user = userEvent.setup();
    render(<TransferForm initialSourceAccountId="acc-source-1" />);

    const toInput = screen.getByTestId('to-account-input');
    const amountInput = screen.getByTestId('transfer-amount-input');
    const submitBtn = screen.getByTestId('transfer-submit-btn');

    await user.type(toInput, 'acc-savings-2');
    await user.type(amountInput, '900.00'); // Available is 800.00
    await user.click(submitBtn);

    expect(screen.getByTestId('error-amount')).toHaveTextContent('Insufficient available balance');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it('submits valid transfer and opens confirmation modal', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(
      <TransferForm
        initialSourceAccountId="acc-source-1"
        initialDestinationAccountId="acc-savings-2"
        onSuccess={onSuccess}
      />,
    );

    const amountInput = screen.getByTestId('transfer-amount-input');
    const submitBtn = screen.getByTestId('transfer-submit-btn');

    await user.type(amountInput, '100.00');
    await user.click(submitBtn);

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    const callArg = mutateAsyncMock.mock.calls[0][0];
    expect(callArg.command.fromAccountId).toBe('acc-source-1');
    expect(callArg.command.toAccountId).toBe('acc-savings-2');
    expect(callArg.command.amount.format()).toBe('€100.00');
    expect(callArg.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(screen.getByTestId('transfer-confirmation-modal')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-tx-id')).toHaveTextContent('tx-confirmed-101');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('displays domain error banner when transfer fails and allows retry', async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockRejectedValue({
      status: 422,
      data: {
        code: 'ACCOUNT_FROZEN',
        message: 'Source account is frozen by operator',
        traceId: 'trace-freeze-789',
      },
    });

    render(
      <TransferForm
        initialSourceAccountId="acc-source-1"
        initialDestinationAccountId="acc-savings-2"
      />,
    );

    const amountInput = screen.getByTestId('transfer-amount-input');
    await user.type(amountInput, '50.00');
    await user.click(screen.getByTestId('transfer-submit-btn'));

    expect(screen.getByTestId('transfer-error-banner')).toBeInTheDocument();
    expect(screen.getByText(/Source account is frozen by operator/)).toBeInTheDocument();
    expect(screen.getByText('trace-freeze-789')).toBeInTheDocument();

    // Now test retry button preserving idempotency key
    const retryBtn = screen.getByTestId('transfer-retry-btn');
    expect(retryBtn).toBeInTheDocument();

    mutateAsyncMock.mockResolvedValueOnce({
      id: 'tx-retry-ok',
      state: 'COMMITTED',
    });

    await user.click(retryBtn);
    expect(mutateAsyncMock).toHaveBeenCalledTimes(2);
    // Keys match across retries!
    const key1 = mutateAsyncMock.mock.calls[0][0].idempotencyKey;
    const key2 = mutateAsyncMock.mock.calls[1][0].idempotencyKey;
    expect(key1).toBe(key2);
  });
});
