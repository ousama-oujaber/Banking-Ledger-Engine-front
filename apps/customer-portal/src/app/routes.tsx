import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers';
import { ProtectedRoute } from './protected-route';
import { LoginPage } from '../features/login/login-page';
import { AuthenticatedShell } from '../features/shell/authenticated-shell';
import { AccessDeniedPage } from '../features/shell/access-denied-page';
import { DashboardPage } from '../features/dashboard/dashboard-page';

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />}
      />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      {/* Protected routes — requires CUSTOMER role */}
      <Route element={<ProtectedRoute requiredRoles={['CUSTOMER']} />}>
        <Route element={<AuthenticatedShell />}>
          <Route index element={<DashboardPage />} />
          {/* Future Sprint 2+ routes will be nested here */}
        </Route>
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
