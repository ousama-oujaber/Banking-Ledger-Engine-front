import { TransactionState } from '@ble-frontend/domain-types';

export interface TransactionStatusBadgeProps {
  state: TransactionState | string;
  className?: string;
}

/**
 * Semantic status chip distinguishing transaction processing states:
 * - SETTLED / POSTED: Completed successfully
 * - PENDING / INITIATED / AUTHORIZED: Processing
 * - FAILED / CANCELLED: Terminated with failure
 * - REVERSED: Rolled back by compensating transaction
 */
export function TransactionStatusBadge({ state, className = '' }: TransactionStatusBadgeProps) {
  const normalized = (state || '').toUpperCase();

  let modifier = 'pending';
  let label = 'Pending';

  if (normalized === TransactionState.SETTLED || normalized === 'COMMITTED') {
    modifier = 'settled';
    label = 'Settled';
  } else if (normalized === TransactionState.POSTED) {
    modifier = 'posted';
    label = 'Posted';
  } else if (normalized === TransactionState.AUTHORIZED) {
    modifier = 'authorized';
    label = 'Authorized';
  } else if (normalized === TransactionState.FAILED) {
    modifier = 'failed';
    label = 'Failed';
  } else if (normalized === TransactionState.CANCELLED) {
    modifier = 'cancelled';
    label = 'Cancelled';
  } else if (normalized === TransactionState.REVERSED) {
    modifier = 'reversed';
    label = 'Reversed';
  }

  return (
    <span
      className={`tx-status-badge tx-status-badge--${modifier} ${className}`.trim()}
      role="status"
      aria-label={`Transaction status: ${label}`}
      data-state={normalized}
      data-testid="tx-status-badge"
    >
      {label}
    </span>
  );
}
