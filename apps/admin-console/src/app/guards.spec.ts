import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { RoleGuard, AuthGuardImpl } from './guards';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('RoleGuard (Admin Console)', () => {
  let mockRouter: Router;
  let roleGuard: RoleGuard;
  let authGuard: AuthGuardImpl;

  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
      createUrlTree: vi.fn().mockImplementation((commands: unknown[]) => ({
        toString: () => commands.join('/'),
      })),
    } as unknown as Router;

    roleGuard = new RoleGuard(mockRouter);
    authGuard = new AuthGuardImpl(mockRouter);
  });

  describe('Unauthenticated access', () => {
    it('should block navigation and redirect to /login when no token is present', () => {
      const result = roleGuard.canActivate();
      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should block navigation when token is expired', () => {
      const past = Math.floor(Date.now() / 1000) - 3600;
      const token = createMockToken({
        sub: 'admin-01',
        roles: ['ADMIN'],
        exp: past,
      });
      AuthService.setToken(token);

      const result = roleGuard.canActivate();
      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Unauthorized roles (CUSTOMER only)', () => {
    it('should block access and redirect to /access-denied for customer accounts', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({
        sub: 'cust-01',
        preferred_username: 'alice',
        roles: ['CUSTOMER'],
        permissions: [],
        exp: future,
      });
      AuthService.setToken(token);

      const result = roleGuard.canActivate();
      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/access-denied']);
    });
  });

  describe('Authorized roles', () => {
    it('should allow access for OPERATOR role', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({
        sub: 'op-01',
        preferred_username: 'bob_operator',
        roles: ['OPERATOR'],
        permissions: ['account:freeze'],
        exp: future,
      });
      AuthService.setToken(token);

      const result = roleGuard.canActivate();
      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should allow access for AUDITOR role', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({
        sub: 'audit-01',
        preferred_username: 'carol_auditor',
        roles: ['AUDITOR'],
        permissions: ['audit:read'],
        exp: future,
      });
      AuthService.setToken(token);

      const result = roleGuard.canActivate();
      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should allow access for ADMIN role', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({
        sub: 'admin-01',
        preferred_username: 'dave_admin',
        roles: ['ADMIN'],
        permissions: ['*'],
        exp: future,
      });
      AuthService.setToken(token);

      const result = roleGuard.canActivate();
      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should allow access for SYSTEM service accounts', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({
        sub: 'sys-daemon',
        preferred_username: 'dlq-worker',
        roles: ['SYSTEM'],
        permissions: ['dlq:replay'],
        exp: future,
      });
      AuthService.setToken(token);

      const result = roleGuard.canActivate();
      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('AuthGuardImpl', () => {
    it('should allow any authenticated user', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({
        sub: 'user-01',
        roles: ['ANY'],
        exp: future,
      });
      AuthService.setToken(token);

      expect(authGuard.canActivate()).toBe(true);
    });

    it('should block unauthenticated access', () => {
      expect(authGuard.canActivate()).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
