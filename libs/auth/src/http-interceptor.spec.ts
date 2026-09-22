import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { MemoryStorage } from './storage';
import { getAuthorizationHeader, withAuthHeaders, createFetchWithAuth } from './http-interceptor';

function createMockToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${payloadStr}.fake_sig`;
}

describe('HTTP Auth Interceptor Helpers', () => {
  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
  });

  describe('getAuthorizationHeader', () => {
    it('should return empty object when no token exists or token is expired', () => {
      expect(getAuthorizationHeader()).toEqual({});

      const now = Math.floor(Date.now() / 1000);
      const expiredToken = createMockToken({ sub: 'user-1', exp: now - 30 });
      expect(getAuthorizationHeader(expiredToken)).toEqual({});
    });

    it('should return Authorization Bearer header when token is valid', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockToken({ sub: 'user-1', exp: now + 3600 });
      AuthService.setToken(token);

      expect(getAuthorizationHeader()).toEqual({
        Authorization: `Bearer ${token}`,
      });
    });

    it('should allow overriding token explicitly', () => {
      const now = Math.floor(Date.now() / 1000);
      const explicitToken = createMockToken({ sub: 'explicit', exp: now + 3600 });

      expect(getAuthorizationHeader(explicitToken)).toEqual({
        Authorization: `Bearer ${explicitToken}`,
      });
    });
  });

  describe('withAuthHeaders', () => {
    it('should inject Authorization header into existing HeadersInit', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockToken({ sub: 'user-1', exp: now + 3600 });
      AuthService.setToken(token);

      const headers = withAuthHeaders({ 'Content-Type': 'application/json' });
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
    });

    it('should preserve existing explicit Authorization header', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockToken({ sub: 'user-1', exp: now + 3600 });
      AuthService.setToken(token);

      const headers = withAuthHeaders({ Authorization: 'Custom-API-Key secret' });
      expect(headers.get('Authorization')).toBe('Custom-API-Key secret');
    });
  });

  describe('createFetchWithAuth', () => {
    it('should wrap fetch and inject Authorization header on outgoing requests', async () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockToken({ sub: 'user-1', exp: now + 3600 });
      AuthService.setToken(token);

      const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      const fetchWithAuth = createFetchWithAuth(mockFetch as unknown as typeof fetch);

      await fetchWithAuth('/api/v1/accounts', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/v1/accounts');
      const sentHeaders = init.headers as Headers;
      expect(sentHeaders.get('Authorization')).toBe(`Bearer ${token}`);
      expect(sentHeaders.get('Accept')).toBe('application/json');
    });
  });
});
