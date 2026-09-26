import { Routes } from '@angular/router';
import { LoginComponent } from '../features/login/login.component';
import { DashboardComponent } from '../features/dashboard/dashboard.component';
import { LayoutComponent } from '../features/layout/layout.component';
import { AccessDeniedComponent } from '../features/access-denied/access-denied.component';
import { roleGuard } from './guards';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'access-denied', component: AccessDeniedComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [roleGuard],
    children: [
      { path: '', component: DashboardComponent },
      {
        path: 'accounts',
        loadComponent: () =>
          import('../features/accounts/account-table.component').then(
            (m) => m.AccountTableComponent,
          ),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('../features/audit/audit-explorer.component').then(
            (m) => m.AuditExplorerComponent,
          ),
      },
      {
        path: 'holds',
        loadComponent: () =>
          import('../features/holds/hold-management.component').then(
            (m) => m.HoldManagementComponent,
          ),
      },
      {
        path: 'recon',
        loadComponent: () =>
          import('../features/recon/reconciliation.component').then(
            (m) => m.ReconciliationComponent,
          ),
      },
      {
        path: 'settlements',
        redirectTo: 'recon',
        pathMatch: 'full',
      },
      {
        path: 'rules',
        loadComponent: () =>
          import('../features/rules/rules-matrix.component').then((m) => m.RulesMatrixComponent),
      },
      {
        path: 'dlq',
        loadComponent: () =>
          import('../features/dlq/dlq-ops.component').then((m) => m.DlqOpsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
