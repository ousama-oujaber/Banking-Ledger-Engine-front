import { Outlet } from 'react-router-dom';
import { useAuth } from '../../app/providers';

/**
 * Authenticated layout shell wrapping all protected pages.
 * Renders a header with user greeting + logout, and a content area for nested routes.
 *
 * Uses semantic CSS class names only — zero visual styling (Design Autonomy).
 */
export function AuthenticatedShell() {
  const { user, logout } = useAuth();

  return (
    <div className="auth-shell">
      <header className="auth-shell__header">
        <span className="auth-shell__brand">Banking Ledger Engine</span>
        <div className="auth-shell__user">
          {user && <span className="auth-shell__greeting">{user.name || user.username}</span>}
          <button className="auth-shell__logout" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>
      <main className="auth-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
