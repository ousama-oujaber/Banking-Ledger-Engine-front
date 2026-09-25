import { Component, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService, AuthUser } from '@ble-frontend/auth';

export interface NavItem {
  path: string;
  label: string;
  tag: string;
  icon: string;
}

@Component({
  selector: 'ble-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell" [class.collapsed]="collapsed()">
      <!-- Navigation Sidebar -->
      <aside class="admin-sidebar" data-testid="admin-sidebar" aria-label="Back-Office Navigation">
        <div class="sidebar-header">
          <div class="brand" data-testid="admin-brand">
            <div class="brand-logo">BLE</div>
            <div class="brand-text" *ngIf="!collapsed()">
              <span class="brand-title">Banking Ledger</span>
              <span class="brand-subtitle">Console Ops</span>
            </div>
          </div>
          <button
            type="button"
            class="toggle-btn"
            data-testid="sidebar-toggle"
            (click)="toggleSidebar()"
            [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          >
            <span class="toggle-icon">{{ collapsed() ? '→' : '←' }}</span>
          </button>
        </div>

        <!-- Operator Profile Card -->
        <div class="operator-profile-card" data-testid="operator-profile" *ngIf="!collapsed()">
          <div class="avatar-ring">
            <span class="avatar-initials" data-testid="operator-avatar">{{ operatorInitials() }}</span>
          </div>
          <div class="operator-info">
            <div class="operator-name-row">
              <span class="operator-name" data-testid="operator-name">{{ operatorDisplayName() }}</span>
              <span class="session-badge" data-testid="session-status" title="Zoneless Reactivity Active">
                <span class="pulse-dot"></span>
                Zoneless
              </span>
            </div>
            <div class="roles-container" data-testid="operator-roles">
              <span *ngFor="let role of userRolesList()" class="role-chip" [class.admin]="role === 'ADMIN'">
                {{ role }}
              </span>
            </div>
          </div>
        </div>

        <!-- Navigation Menu -->
        <nav class="sidebar-nav" data-testid="admin-nav">
          <ul class="nav-list">
            <li *ngFor="let item of navItems" class="nav-item">
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                [attr.data-testid]="'nav-' + item.tag"
                class="nav-link"
                [title]="item.label"
              >
                <span class="nav-icon">{{ item.icon }}</span>
                <span class="nav-label" *ngIf="!collapsed()">{{ item.label }}</span>
                <span class="active-indicator"></span>
              </a>
            </li>
          </ul>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-footer">
          <button
            type="button"
            (click)="logout()"
            class="logout-btn"
            data-testid="logout-btn"
            [title]="'Sign out (' + operatorDisplayName() + ')'"
          >
            <span class="logout-icon">⏻</span>
            <span class="logout-label" *ngIf="!collapsed()">Logout</span>
          </button>
        </div>
      </aside>

      <!-- Main Workspace -->
      <div class="workspace-wrapper">
        <!-- Top App Bar / Header -->
        <header class="admin-header" data-testid="admin-header">
          <div class="header-left">
            <span class="env-badge" data-testid="env-badge">STAGING</span>
            <span class="system-time" data-testid="system-time">UTC {{ currentTime() }}</span>
          </div>
          <div class="header-right">
            <span class="ledger-status" title="Core Double-Entry Invariant: Verified">
              <span class="status-indicator"></span>
              Ledger Synchronized
            </span>
          </div>
        </header>

        <!-- Main Routed Content -->
        <main class="admin-content" data-testid="admin-main">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: var(--ble-color-background, #0b1120);
      color: var(--ble-color-text-primary, #f8fafc);
    }

    .admin-shell {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    /* Sidebar */
    .admin-sidebar {
      width: var(--ble-sidebar-width, 250px);
      background: var(--ble-color-surface, #1e293b);
      border-right: 1px solid var(--ble-color-border, #334155);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 20;
    }

    .admin-shell.collapsed .admin-sidebar {
      width: var(--ble-sidebar-collapsed-width, 68px);
    }

    /* Header */
    .sidebar-header {
      height: var(--ble-header-height, 54px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid var(--ble-color-border, #334155);
      background: rgba(15, 23, 42, 0.6);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
    }

    .brand-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: #ffffff;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.05em;
      border-radius: 6px;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
      flex-shrink: 0;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
      white-space: nowrap;
    }

    .brand-title {
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
      color: #f8fafc;
    }

    .brand-subtitle {
      font-size: 10px;
      font-weight: 500;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .toggle-btn {
      background: transparent;
      border: 1px solid var(--ble-color-border, #334155);
      color: var(--ble-color-text-secondary, #94a3b8);
      width: 26px;
      height: 26px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: all 150ms ease;
    }

    .toggle-btn:hover {
      background: var(--ble-color-surface-subtle, #334155);
      color: var(--ble-color-text-primary, #f8fafc);
    }

    /* Operator Profile */
    .operator-profile-card {
      padding: 12px 14px;
      margin: 10px 10px 4px 10px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.6);
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar-ring {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border: 2px solid #3b82f6;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .avatar-initials {
      font-size: 12px;
      font-weight: 700;
      color: #93c5fd;
      letter-spacing: 0.05em;
    }

    .operator-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .operator-name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .operator-name {
      font-size: 12px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 600;
      color: #34d399;
      background: rgba(16, 185, 129, 0.12);
      padding: 1px 5px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .pulse-dot {
      width: 5px;
      height: 5px;
      background: #34d399;
      border-radius: 50%;
      box-shadow: 0 0 6px #34d399;
    }

    .roles-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .role-chip {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(59, 130, 246, 0.15);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .role-chip.admin {
      background: rgba(245, 158, 11, 0.15);
      color: #fcd34d;
      border-color: rgba(245, 158, 11, 0.3);
    }

    /* Nav List */
    .sidebar-nav {
      flex: 1;
      padding: 8px 6px;
      overflow-y: auto;
    }

    .nav-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 5px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      position: relative;
      transition: all 120ms ease;
      white-space: nowrap;
    }

    .nav-link:hover {
      background: var(--ble-color-surface-subtle, #334155);
      color: #f8fafc;
    }

    .nav-link.active {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      font-weight: 600;
    }

    .nav-icon {
      font-size: 15px;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .active-indicator {
      display: none;
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 3px;
      border-radius: 0 2px 2px 0;
      background: #3b82f6;
    }

    .nav-link.active .active-indicator {
      display: block;
    }

    /* Footer */
    .sidebar-footer {
      padding: 8px 10px;
      border-top: 1px solid var(--ble-color-border, #334155);
    }

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 12px;
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.5);
    }

    /* Workspace */
    .workspace-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }

    /* Header */
    .admin-header {
      height: var(--ble-header-height, 54px);
      background: var(--ble-color-surface, #1e293b);
      border-bottom: 1px solid var(--ble-color-border, #334155);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .env-badge {
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(14, 165, 233, 0.3);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .system-time {
      font-family: var(--ble-font-family-mono);
      font-size: 11px;
      color: var(--ble-color-text-secondary, #94a3b8);
    }

    .ledger-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 500;
      color: #34d399;
    }

    .status-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 6px #34d399;
    }

    /* Content Area */
    .admin-content {
      flex: 1;
      overflow-y: auto;
      background: var(--ble-color-background, #0b1120);
      padding: 0;
    }
  `]
})
export class LayoutComponent implements OnDestroy {
  user = signal<AuthUser | null>(AuthService.getUser());
  collapsed = signal<boolean>(false);
  currentTime = signal<string>(new Date().toISOString().replace('T', ' ').substring(0, 19));

  private timeInterval: ReturnType<typeof setInterval> | null = null;

  readonly navItems: NavItem[] = [
    { path: '/accounts', label: 'Accounts', tag: 'accounts', icon: '🏛' },
    { path: '/audit', label: 'Audit Trail', tag: 'audit', icon: '📜' },
    { path: '/holds', label: 'Holds', tag: 'holds', icon: '🔒' },
    { path: '/recon', label: 'Reconciliation', tag: 'recon', icon: '⚖' },
    { path: '/dlq', label: 'DLQ Ops', tag: 'dlq', icon: '⚠' },
    { path: '/rules', label: 'Rules Matrix', tag: 'rules', icon: '⚙' },
  ];

  operatorDisplayName = computed<string>(() => {
    const u = this.user();
    return u?.name || u?.username || 'Operator';
  });

  operatorInitials = computed<string>(() => {
    const u = this.user();
    if (!u) return '??';
    if (u.name && u.name.trim().length > 0) {
      const parts = u.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (u.username && u.username.length >= 2) {
      return u.username.substring(0, 2).toUpperCase();
    }
    return 'OP';
  });

  userRolesList = computed<string[]>(() => {
    const roles = this.user()?.roles;
    return roles && roles.length > 0 ? roles : ['OPERATOR'];
  });

  userRolesString = computed<string>(() => {
    return this.userRolesList().join(', ');
  });

  constructor(private router: Router) {
    if (typeof window !== 'undefined') {
      this.timeInterval = setInterval(() => {
        this.currentTime.set(new Date().toISOString().replace('T', ' ').substring(0, 19));
      }, 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }

  logout(): void {
    AuthService.clear();
    this.router.navigate(['/login']);
  }
}
