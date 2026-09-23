import { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthGuard } from '@ble-frontend/auth';

interface ProtectedRouteProps {
  /** Optional roles required to access the route. */
  requiredRoles?: string[];
  /** Redirect path when unauthenticated. Defaults to '/login'. */
  redirectTo?: string;
  /** Optional children to render instead of <Outlet />. */
  children?: ReactNode;
}

/**
 * Route guard wrapper that enforces authentication and optional role checks.
 *
 * Usage:
 *   <Route element={<ProtectedRoute requiredRoles={['CUSTOMER']} />}>
 *     <Route path="/" element={<DashboardPage />} />
 *   </Route>
 */
export function ProtectedRoute({
  requiredRoles,
  redirectTo = '/login',
  children,
}: ProtectedRouteProps) {
  // Check authentication
  if (!AuthGuard.requireAuth()) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check role authorization if required
  if (requiredRoles && requiredRoles.length > 0) {
    if (!AuthGuard.requireRole(...requiredRoles)) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return <>{children ?? <Outlet />}</>;
}
