import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { LayoutComponent } from './layout.component';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('LayoutComponent (Admin Console Shell - S4-T1)', () => {
  let component: LayoutComponent;
  let mockRouter: Router;

  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    } as unknown as Router;
  });

  it('should initialize with null user when unauthenticated and fallback defaults', () => {
    component = new LayoutComponent(mockRouter);
    expect(component.user()).toBeNull();
    expect(component.operatorInitials()).toBe('??');
    expect(component.operatorDisplayName()).toBe('Operator');
    expect(component.userRolesList()).toEqual(['OPERATOR']);
    expect(component.userRolesString()).toBe('OPERATOR');
    expect(component.collapsed()).toBe(false);
  });

  it('should populate user signal, compute initials from name, and format roles', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockToken({
      sub: 'operator-7',
      preferred_username: 'sarah_teller',
      name: 'Sarah Connor',
      roles: ['OPERATOR', 'AUDITOR'],
      exp: future,
    });
    AuthService.setToken(token);

    component = new LayoutComponent(mockRouter);
    expect(component.user()?.username).toBe('sarah_teller');
    expect(component.user()?.name).toBe('Sarah Connor');
    expect(component.operatorDisplayName()).toBe('Sarah Connor');
    expect(component.operatorInitials()).toBe('SC');
    expect(component.userRolesList()).toEqual(['OPERATOR', 'AUDITOR']);
    expect(component.userRolesString()).toBe('OPERATOR, AUDITOR');
  });

  it('should compute initials from single-word username if name is absent', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockToken({
      sub: 'operator-9',
      preferred_username: 'alex',
      roles: ['ADMIN'],
      exp: future,
    });
    AuthService.setToken(token);

    component = new LayoutComponent(mockRouter);
    expect(component.operatorDisplayName()).toBe('alex');
    expect(component.operatorInitials()).toBe('AL');
    expect(component.userRolesList()).toEqual(['ADMIN']);
  });

  it('should toggle sidebar collapse state', () => {
    component = new LayoutComponent(mockRouter);
    expect(component.collapsed()).toBe(false);

    component.toggleSidebar();
    expect(component.collapsed()).toBe(true);

    component.toggleSidebar();
    expect(component.collapsed()).toBe(false);
  });

  it('should define all 6 required back-office navigation items', () => {
    component = new LayoutComponent(mockRouter);
    const routes = component.navItems.map((item) => item.path);
    expect(routes).toEqual(['/accounts', '/audit', '/holds', '/recon', '/dlq', '/rules']);

    const labels = component.navItems.map((item) => item.label);
    expect(labels).toContain('Accounts');
    expect(labels).toContain('Audit Trail');
    expect(labels).toContain('Holds');
    expect(labels).toContain('Reconciliation');
    expect(labels).toContain('DLQ Ops');
    expect(labels).toContain('Rules Matrix');
  });

  it('should clear token and navigate to /login on logout', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockToken({
      sub: 'op-01',
      roles: ['OPERATOR'],
      exp: future,
    });
    AuthService.setToken(token);

    component = new LayoutComponent(mockRouter);
    component.logout();

    expect(AuthService.getToken()).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
