import { Outlet } from 'react-router-dom';

export function DashboardPage() {
  return (
    <div className="dashboard">
      <nav>Customer Portal</nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
