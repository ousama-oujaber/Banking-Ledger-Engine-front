import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferConfirmationModal } from './transfer-confirmation-modal';
import type { TransactionResponse } from '@ble-frontend/api-client';

describe('TransferConfirmationModal Component', () => {
  const mockTx: TransactionResponse = {
    id: 'tx-conf-123',
    reference: 'REF-CONF-456',
    sourceAccountId: 'acc-src-1',
    destinationAccountId: 'acc-dst-2',
    amount: { amount: 150, currency: 'EUR' },
    state: 'SETTLED',
  };

  it('does not render when isOpen is false or transaction is null', () => {
    const { rerender } = render(
      <TransferConfirmationModal transaction={mockTx} isOpen={false} onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId('transfer-confirmation-modal')).not.toBeInTheDocument();

    rerender(<TransferConfirmationModal transaction={null} isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('transfer-confirmation-modal')).not.toBeInTheDocument();
  });

  it('renders transaction confirmation details when open', () => {
    render(<TransferConfirmationModal transaction={mockTx} isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('transfer-confirmation-modal')).toBeInTheDocument();
    expect(screen.getByTestId('transfer-success-badge')).toHaveTextContent(
      'Double-Entry Ledger Posting Committed',
    );
    expect(screen.getByTestId('confirm-tx-id')).toHaveTextContent('tx-conf-123');
    expect(screen.getByTestId('confirm-tx-ref')).toHaveTextContent('REF-CONF-456');
    expect(screen.getByTestId('confirm-source-acc')).toHaveTextContent('acc-src-1');
    expect(screen.getByTestId('confirm-dest-acc')).toHaveTextContent('acc-dst-2');
    expect(screen.getByTestId('confirm-amount')).toHaveTextContent('150 EUR');
    expect(screen.getByTestId('confirm-status')).toHaveTextContent('SETTLED');
  });

  it('calls onClose when close icon, dismiss button, or backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<TransferConfirmationModal transaction={mockTx} isOpen={true} onClose={onClose} />);

    // Click close icon
    await user.click(screen.getByTestId('transfer-confirm-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click dismiss button
    await user.click(screen.getByTestId('transfer-confirm-dismiss-btn'));
    expect(onClose).toHaveBeenCalledTimes(2);

    // Click backdrop
    await user.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
