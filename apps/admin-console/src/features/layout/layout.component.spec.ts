import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { LayoutComponent } from './layout.component';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('LayoutComponent (Admin Console)', () => {
  let component: LayoutComponent;
  let mockRouter: Router;

  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    } as unknown as Router;
  });

  it('should initialize with null user when unauthenticated', () => {
    component = new LayoutComponent(mockRouter);
    expect(component.user()).toBeNull();
    expect(component.userRolesString()).toBe('Operator');
  });

  it('should populate user signal and format roles when token exists', () => {
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
    expect(component.userRolesString()).toBe('OPERATOR, AUDITOR');
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
