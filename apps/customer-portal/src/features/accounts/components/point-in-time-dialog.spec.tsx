import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Currency, AccountStatus, AccountType, Money } from '@ble-frontend/domain-types';
import { PointInTimeDialog } from './point-in-time-dialog';
import * as pitHookModule from '../hooks/use-point-in-time-balance';
import type { Account } from '../types';

describe('PointInTimeDialog Component', () => {
  const mockAccount: Account = {
    id: 'acc-pit-1234',
    ownerId: 'cust-1',
    label: 'Main Savings',
    currency: Currency.EUR,
    type: AccountType.SAVINGS,
    status: AccountStatus.ACTIVE,
    derivedBalance: Money.from('5000.00', Currency.EUR),
    allowOverdraft: false,
    version: 1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(pitHookModule, 'usePointInTimeBalance').mockReturnValue({
      balance: null,
      asOf: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('does not render when isOpen is false', () => {
    render(<PointInTimeDialog account={mockAccount} isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('pit-dialog')).not.toBeInTheDocument();
  });

  it('renders dialog, account info, and datetime input when isOpen is true', () => {
    render(<PointInTimeDialog account={mockAccount} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('pit-dialog')).toBeInTheDocument();
    expect(screen.getByText('Point-in-Time Balance Inspector')).toBeInTheDocument();
    expect(screen.getByTestId('pit-account-label')).toHaveTextContent('Main Savings');
    expect(screen.getByTestId('current-balance')).toHaveTextContent('€5,000.00');
    expect(screen.getByTestId('pit-datetime-input')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<PointInTimeDialog account={mockAccount} isOpen={true} onClose={onClose} />);

    await user.click(screen.getByTestId('pit-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays loading indicator when computing historical balance', () => {
    vi.spyOn(pitHookModule, 'usePointInTimeBalance').mockReturnValue({
      balance: null,
      asOf: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PointInTimeDialog account={mockAccount} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('pit-loading')).toHaveTextContent(
      'Summing ledger entries at target timestamp...',
    );
  });

  it('displays error message when historical query fails', () => {
    vi.spyOn(pitHookModule, 'usePointInTimeBalance').mockReturnValue({
      balance: null,
      asOf: null,
      isLoading: false,
      isError: true,
      error: new Error('Account did not exist at specified date'),
      refetch: vi.fn(),
    });

    render(<PointInTimeDialog account={mockAccount} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('pit-error')).toBeInTheDocument();
    expect(screen.getByText(/Account did not exist at specified date/)).toBeInTheDocument();
  });

  it('renders calculated historical balance when query succeeds', async () => {
    const user = userEvent.setup();

    vi.spyOn(pitHookModule, 'usePointInTimeBalance').mockReturnValue({
      balance: Money.from('4250.75', Currency.EUR),
      asOf: '2026-09-20T10:00:00.000Z',
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PointInTimeDialog account={mockAccount} isOpen={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByTestId('pit-submit-btn');
    await user.click(submitBtn);

    expect(screen.getByTestId('pit-result')).toBeInTheDocument();
    expect(screen.getByTestId('pit-amount')).toHaveTextContent('€4,250.75');
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<PointInTimeDialog account={mockAccount} isOpen={true} onClose={onClose} />);

    const backdrop = screen.getByRole('presentation');
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
