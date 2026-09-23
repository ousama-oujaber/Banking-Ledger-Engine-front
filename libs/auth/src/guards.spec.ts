import { describe, it, expect, beforeEach } from 'vitest';
import { UserRole } from '@ble-frontend/domain-types';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards';
import { MemoryStorage } from './storage';

function createMockToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${payloadStr}.fake_sig`;
}

describe('AuthGuard', () => {
  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
  });

  it('should evaluate requireAuth based on presence and expiration of token', () => {
    expect(AuthGuard.requireAuth()).toBe(false);

    const now = Math.floor(Date.now() / 1000);
    const validToken = createMockToken({ sub: 'user-1', exp: now + 3600 });
    AuthService.setToken(validToken);
    expect(AuthGuard.requireAuth()).toBe(true);

    const expiredToken = createMockToken({ sub: 'user-2', exp: now - 60 });
    AuthService.setToken(expiredToken);
    expect(AuthGuard.requireAuth()).toBe(false);
  });

  it('should enforce role requirements', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'op-1',
      roles: ['OPERATOR'],
      permissions: ['accounts:read', 'accounts:freeze'],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    expect(AuthGuard.requireRole('OPERATOR')).toBe(true);
    expect(AuthGuard.requireRole('ADMIN', 'OPERATOR')).toBe(true);
    expect(AuthGuard.requireRole('CUSTOMER')).toBe(false);

    expect(AuthGuard.requireAllRoles('OPERATOR')).toBe(true);
    expect(AuthGuard.requireAllRoles('OPERATOR', 'ADMIN')).toBe(false);

    expect(AuthGuard.getUserRoles()).toEqual(['OPERATOR']);
    expect(AuthGuard.getUserPermissions()).toEqual(['accounts:read', 'accounts:freeze']);
  });

  it('should enforce permission requirements', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = createMockToken({
      sub: 'audit-1',
      roles: ['AUDITOR'],
      permissions: ['audit:export', 'ledger:read'],
      exp: now + 3600,
    });
    AuthService.setToken(token);

    expect(AuthGuard.requirePermission('audit:export')).toBe(true);
    expect(AuthGuard.requirePermission('accounts:freeze')).toBe(false);

    expect(AuthGuard.requireAllPermissions('audit:export', 'ledger:read')).toBe(true);
    expect(AuthGuard.requireAllPermissions('audit:export', 'accounts:freeze')).toBe(false);
  });

  it('should correctly evaluate domain role helper methods', () => {
    const now = Math.floor(Date.now() / 1000);

    // Customer
    AuthService.setToken(
      createMockToken({ sub: 'c1', roles: [UserRole.CUSTOMER], exp: now + 3600 }),
    );
    expect(AuthGuard.isCustomer()).toBe(true);
    expect(AuthGuard.isOperator()).toBe(false);
    expect(AuthGuard.isAuditor()).toBe(false);
    expect(AuthGuard.isAdmin()).toBe(false);

    // Operator
    AuthService.setToken(
      createMockToken({ sub: 'op1', roles: [UserRole.OPERATOR], exp: now + 3600 }),
    );
    expect(AuthGuard.isCustomer()).toBe(false);
    expect(AuthGuard.isOperator()).toBe(true);
    expect(AuthGuard.isAuditor()).toBe(false);
    expect(AuthGuard.isAdmin()).toBe(false);

    // Auditor
    AuthService.setToken(
      createMockToken({ sub: 'au1', roles: [UserRole.AUDITOR], exp: now + 3600 }),
    );
    expect(AuthGuard.isCustomer()).toBe(false);
    expect(AuthGuard.isOperator()).toBe(false);
    expect(AuthGuard.isAuditor()).toBe(true);
    expect(AuthGuard.isAdmin()).toBe(false);

    // Admin (has operator and auditor privileges)
    AuthService.setToken(createMockToken({ sub: 'ad1', roles: [UserRole.ADMIN], exp: now + 3600 }));
    expect(AuthGuard.isCustomer()).toBe(false);
    expect(AuthGuard.isOperator()).toBe(true);
    expect(AuthGuard.isAuditor()).toBe(true);
    expect(AuthGuard.isAdmin()).toBe(true);
  });
});
