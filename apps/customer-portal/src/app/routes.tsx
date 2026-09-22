import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './providers';
import { LoginPage } from '../features/login/login-page';
import { DashboardPage } from '../features/dashboard/dashboard-page';

export function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />
      <Route path="/*" element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
