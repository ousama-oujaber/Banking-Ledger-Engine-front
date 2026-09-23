import { useAuth } from '../../app/providers';
import { AccountList, useAccounts } from '../accounts';
import { TransactionFeed } from '../transactions';

/**
 * Customer dashboard landing page displaying customer accounts overview and activity feed.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { accounts } = useAccounts();

  const accountOptions = accounts.map((acc) => ({
    id: acc.id,
    label: acc.label,
  }));

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h2 className="dashboard__title">Customer Dashboard</h2>
        <p className="dashboard__welcome">
          Welcome back, {user?.name || user?.username || 'Customer'}.
        </p>
      </header>

      <main className="dashboard__content">
        <AccountList />
        <TransactionFeed accounts={accountOptions} />
      </main>
    </div>
  );
}
