import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers';
import { ProtectedRoute } from './protected-route';
import { LoginPage } from '../features/login/login-page';
import { AuthenticatedShell } from '../features/shell/authenticated-shell';
import { AccessDeniedPage } from '../features/shell/access-denied-page';
import { NotFoundPage } from '../features/shell/not-found-page';
import { DashboardPage } from '../features/dashboard/dashboard-page';
import { TransfersPage } from '../features/transfers';
import { FxPage } from '../features/fx';
import { BeneficiariesPage } from '../features/beneficiaries';
import { StatementsPage } from '../features/statements';
import { ErrorBoundary } from '../features/errors';

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <ErrorBoundary>
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
            <Route path="accounts" element={<Navigate to="/" replace />} />
            <Route path="transfers" element={<TransfersPage />} />
            <Route path="fx" element={<FxPage />} />
            <Route path="beneficiaries" element={<BeneficiariesPage />} />
            <Route path="statements" element={<StatementsPage />} />
          </Route>
        </Route>

        {/* Catch-all route -> 404 Not Found Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
