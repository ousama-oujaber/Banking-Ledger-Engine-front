import { AccountStatus } from '@ble-frontend/domain-types';

export interface StatusBadgeProps {
  status: AccountStatus | string;
  className?: string;
}

/**
 * Semantic status chip distinguishing account states:
 * - ACTIVE: normal operations
 * - FROZEN: restricted operations (transfers blocked)
 * - CLOSED: terminal state
 */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const normalized = (status || '').toUpperCase();

  let modifier = 'active';
  let label = 'Active';

  if (normalized === AccountStatus.FROZEN) {
    modifier = 'frozen';
    label = 'Frozen (Restricted)';
  } else if (normalized === AccountStatus.CLOSED) {
    modifier = 'closed';
    label = 'Closed';
  }

  return (
    <span
      className={`status-badge status-badge--${modifier} ${className}`.trim()}
      role="status"
      aria-label={`Account status: ${label}`}
      data-status={normalized}
      data-testid="status-badge"
    >
      {label}
    </span>
  );
}
