import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../app/providers';
import { ErrorBoundary } from '../errors';

/**
 * Authenticated layout shell wrapping all protected pages.
 * Renders a header with user greeting, navigation bar, and logout button.
 * Uses semantic CSS class names only — zero visual styling (Design Autonomy).
 */
export function AuthenticatedShell() {
  const { user, logout } = useAuth();

  return (
    <div className="auth-shell">
      <header className="auth-shell__header">
        <div className="auth-shell__header-left">
          <span className="auth-shell__brand">Banking Ledger Engine</span>
          <nav className="auth-shell__nav" aria-label="Main Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `auth-shell__nav-link ${isActive ? 'auth-shell__nav-link--active' : ''}`
              }
              data-testid="nav-link-dashboard"
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/transfers"
              className={({ isActive }) =>
                `auth-shell__nav-link ${isActive ? 'auth-shell__nav-link--active' : ''}`
              }
              data-testid="nav-link-transfers"
            >
              Transfers
            </NavLink>
            <NavLink
              to="/fx"
              className={({ isActive }) =>
                `auth-shell__nav-link ${isActive ? 'auth-shell__nav-link--active' : ''}`
              }
              data-testid="nav-link-fx"
            >
              FX Exchange
            </NavLink>
            <NavLink
              to="/beneficiaries"
              className={({ isActive }) =>
                `auth-shell__nav-link ${isActive ? 'auth-shell__nav-link--active' : ''}`
              }
              data-testid="nav-link-beneficiaries"
            >
              Beneficiaries
            </NavLink>
            <NavLink
              to="/statements"
              className={({ isActive }) =>
                `auth-shell__nav-link ${isActive ? 'auth-shell__nav-link--active' : ''}`
              }
              data-testid="nav-link-statements"
            >
              Statements
            </NavLink>
          </nav>
        </div>
        <div className="auth-shell__user">
          {user && <span className="auth-shell__greeting">{user.name || user.username}</span>}
          <button className="auth-shell__logout" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>
      <main className="auth-shell__content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
