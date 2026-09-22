import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { MemoryStorage } from './storage';

function createMockToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${payloadStr}.fake_sig`;
}

describe('AuthService', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    AuthService.setStorageAdapter(memoryStorage);
    AuthService.clear();
  });

  it('should store and retrieve tokens using the active storage adapter', () => {
    expect(AuthService.getToken()).toBeNull();
    const token = 'sample.jwt.token';
    AuthService.setToken(token);
    expect(AuthService.getToken()).toBe(token);
    expect(AuthService.getStorageAdapter()).toBe(memoryStorage);
  });

  it('should extract decoded claims from the stored token', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'cust-999',
      preferred_username: 'alice',
      email: 'alice@ble.io',
      name: 'Alice Smith',
      roles: ['CUSTOMER'],
      permissions: ['transfer:create'],
      iat: now,
      exp: now + 3600,
    });

    AuthService.setToken(token);
    const claims = AuthService.getClaims();
    expect(claims?.sub).toBe('cust-999');
    expect(claims?.roles).toContain('CUSTOMER');
    expect(claims?.permissions).toContain('transfer:create');

    const user = AuthService.getUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe('cust-999');
    expect(user?.username).toBe('alice');
    expect(user?.email).toBe('alice@ble.io');
    expect(user?.name).toBe('Alice Smith');
    expect(user?.roles).toEqual(['CUSTOMER']);
  });

  it('should return null for claims and user when unauthenticated', () => {
    expect(AuthService.getClaims()).toBeNull();
    expect(AuthService.getUser()).toBeNull();
  });

  it('should accurately report expiration status', () => {
    expect(AuthService.isTokenExpired()).toBe(true);

    const now = Math.floor(Date.now() / 1000);
    const validToken = createMockToken({ sub: 'user-1', exp: now + 600 });
    AuthService.setToken(validToken);
    expect(AuthService.isTokenExpired()).toBe(false);
    expect(AuthService.getTimeUntilExpiration()).toBeGreaterThan(0);
    expect(AuthService.getExpirationDate()).toBeInstanceOf(Date);

    const expiredToken = createMockToken({ sub: 'user-2', exp: now - 100 });
    AuthService.setToken(expiredToken);
    expect(AuthService.isTokenExpired()).toBe(true);
    expect(AuthService.getTimeUntilExpiration()).toBe(0);
  });

  it('should perform role verifications', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'admin-01',
      roles: ['ADMIN', 'OPERATOR'],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    expect(AuthService.hasRole('ADMIN')).toBe(true);
    expect(AuthService.hasRole('OPERATOR')).toBe(true);
    expect(AuthService.hasRole('CUSTOMER')).toBe(false);

    expect(AuthService.hasAnyRole('CUSTOMER', 'ADMIN')).toBe(true);
    expect(AuthService.hasAnyRole('CUSTOMER', 'GUEST')).toBe(false);

    expect(AuthService.hasAllRoles('ADMIN', 'OPERATOR')).toBe(true);
    expect(AuthService.hasAllRoles('ADMIN', 'CUSTOMER')).toBe(false);
  });

  it('should perform permission verifications', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'op-01',
      roles: ['OPERATOR'],
      permissions: ['account:freeze', 'account:unfreeze'],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    expect(AuthService.hasPermission('account:freeze')).toBe(true);
    expect(AuthService.hasPermission('ledger:reconcile')).toBe(false);

    expect(AuthService.hasAnyPermission('ledger:reconcile', 'account:unfreeze')).toBe(true);
    expect(AuthService.hasAnyPermission('ledger:reconcile', 'audit:view')).toBe(false);

    expect(AuthService.hasAllPermissions('account:freeze', 'account:unfreeze')).toBe(true);
    expect(AuthService.hasAllPermissions('account:freeze', 'ledger:reconcile')).toBe(false);
  });

  it('should generate authorization headers only when valid and active', () => {
    expect(AuthService.getAuthorizationHeader()).toEqual({});

    const now = Math.floor(Date.now() / 1000);
    const validToken = createMockToken({ sub: 'u1', exp: now + 3600 });
    AuthService.setToken(validToken);
    expect(AuthService.getAuthorizationHeader()).toEqual({
      Authorization: `Bearer ${validToken}`,
    });

    const expiredToken = createMockToken({ sub: 'u2', exp: now - 100 });
    AuthService.setToken(expiredToken);
    expect(AuthService.getAuthorizationHeader()).toEqual({});
  });

  it('should notify subscribers on token change and clear', () => {
    const listener = vi.fn();
    const unsubscribe = AuthService.subscribe(listener);

    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({ sub: 'u1', exp: now + 3600, roles: ['CUSTOMER'] });

    AuthService.setToken(token);
    expect(listener).toHaveBeenCalledWith(token, expect.objectContaining({ sub: 'u1' }));

    AuthService.clear();
    expect(listener).toHaveBeenCalledWith(null, null);

    unsubscribe();
    listener.mockClear();
    AuthService.setToken(token);
    expect(listener).not.toHaveBeenCalled();
  });
});
