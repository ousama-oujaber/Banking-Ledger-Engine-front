import { useAuth } from '../../app/providers';

/**
 * Customer dashboard landing page — placeholder for Sprint 2 account cards.
 */
export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <h2 className="dashboard__title">Customer Dashboard</h2>
      <p className="dashboard__welcome">
        Welcome, {user?.name || user?.username || 'Customer'}. Your dashboard is ready.
      </p>
    </div>
  );
}
