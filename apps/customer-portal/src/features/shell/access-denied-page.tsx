import { Link } from 'react-router-dom';

/**
 * Access Denied page displayed when the user's role is insufficient for the requested route.
 */
export function AccessDeniedPage() {
  return (
    <div className="access-denied">
      <h1 className="access-denied__title">Access Denied</h1>
      <p className="access-denied__message">You do not have permission to access this page.</p>
      <Link to="/login" className="access-denied__link">
        Return to Login
      </Link>
    </div>
  );
}
