import { useAuth } from '../../app/providers';
import { AccountList } from '../accounts';

/**
 * Customer dashboard landing page displaying customer accounts overview.
 */
export function DashboardPage() {
  const { user } = useAuth();

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
      </main>
    </div>
  );
}
