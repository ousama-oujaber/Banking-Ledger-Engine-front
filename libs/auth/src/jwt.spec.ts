import { describe, it, expect } from 'vitest';
import {
  decodeJwt,
  isJwtExpired,
  getJwtExpirationDate,
  getJwtRemainingSeconds,
  base64UrlToBase64,
  decodeBase64ToUtf8,
} from './jwt';

function createMockToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${payloadStr}.fake_signature`;
}

describe('JWT Utilities', () => {
  describe('base64UrlToBase64', () => {
    it('should convert url-safe characters and add padding', () => {
      expect(base64UrlToBase64('ab-cd_ef')).toBe('ab+cd/ef');
      expect(base64UrlToBase64('abc')).toBe('abc=');
      expect(base64UrlToBase64('ab')).toBe('ab==');
    });
  });

  describe('decodeBase64ToUtf8', () => {
    it('should decode UTF-8 multi-byte characters accurately', () => {
      const utf8String = 'Hello, Jürgen! Currency: €100 — 🏦';
      const base64 = Buffer.from(utf8String, 'utf8').toString('base64');
      expect(decodeBase64ToUtf8(base64)).toBe(utf8String);
    });
  });

  describe('decodeJwt', () => {
    it('should decode a valid 3-part JWT token', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockToken({
        sub: 'usr-1234',
        preferred_username: 'johndoe',
        roles: ['CUSTOMER'],
        permissions: ['account:read'],
        iat: now,
        exp: now + 3600,
      });

      const claims = decodeJwt(token);
      expect(claims).not.toBeNull();
      expect(claims?.sub).toBe('usr-1234');
      expect(claims?.preferred_username).toBe('johndoe');
      expect(claims?.roles).toEqual(['CUSTOMER']);
      expect(claims?.permissions).toEqual(['account:read']);
    });

    it('should normalize Keycloak realm_access.roles if roles is missing', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = createMockToken({
        sub: 'admin-1',
        realm_access: {
          roles: ['ADMIN', 'OPERATOR'],
        },
        iat: now,
        exp: now + 3600,
      });

      const claims = decodeJwt(token);
      expect(claims?.roles).toEqual(['ADMIN', 'OPERATOR']);
      expect(claims?.permissions).toEqual([]);
    });

    it('should return null for invalid, non-string, or malformed tokens', () => {
      expect(decodeJwt('')).toBeNull();
      expect(decodeJwt(null)).toBeNull();
      expect(decodeJwt(undefined)).toBeNull();
      expect(decodeJwt('not.a.valid.jwt.with.five.parts')).toBeNull();
      expect(decodeJwt('single-part-token')).toBeNull();
      expect(decodeJwt('invalid_base64.!!!invalid_base64!!!.sig')).toBeNull();
      expect(decodeJwt('header.bm90LWpzb24=.sig')).toBeNull(); // "not-json"
    });
  });

  describe('isJwtExpired', () => {
    it('should return true if claims or exp are missing or not a number', () => {
      expect(isJwtExpired(null)).toBe(true);
      expect(isJwtExpired(undefined)).toBe(true);
      expect(isJwtExpired({})).toBe(true);
      expect(isJwtExpired({ exp: NaN })).toBe(true);
    });

    it('should return true if exp is in the past', () => {
      const past = Math.floor(Date.now() / 1000) - 60;
      expect(isJwtExpired({ exp: past })).toBe(true);
      expect(isJwtExpired(past)).toBe(true);
    });

    it('should return false if exp is in the future', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      expect(isJwtExpired({ exp: future })).toBe(false);
      expect(isJwtExpired(future)).toBe(false);
    });

    it('should respect clockSkewSeconds tolerance', () => {
      const now = Math.floor(Date.now() / 1000);
      // Expired 5 seconds in the future, but with 10s skew tolerance, it should be treated as expired
      const closeToExpiry = now + 5;
      expect(isJwtExpired({ exp: closeToExpiry }, 0)).toBe(false);
      expect(isJwtExpired({ exp: closeToExpiry }, 10)).toBe(true);
    });
  });

  describe('getJwtExpirationDate', () => {
    it('should return Date instance corresponding to exp timestamp', () => {
      const expEpoch = 1770000000;
      const date = getJwtExpirationDate({ exp: expEpoch });
      expect(date).toBeInstanceOf(Date);
      expect(date?.getTime()).toBe(expEpoch * 1000);
    });

    it('should return null if exp is invalid or missing', () => {
      expect(getJwtExpirationDate(null)).toBeNull();
      expect(getJwtExpirationDate({})).toBeNull();
      expect(getJwtExpirationDate({ exp: NaN })).toBeNull();
    });
  });

  describe('getJwtRemainingSeconds', () => {
    it('should return remaining seconds if token is still valid', () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = getJwtRemainingSeconds({ exp: now + 120 });
      expect(remaining).toBeGreaterThanOrEqual(118);
      expect(remaining).toBeLessThanOrEqual(120);
    });

    it('should return 0 if token is already expired or invalid', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(getJwtRemainingSeconds({ exp: now - 50 })).toBe(0);
      expect(getJwtRemainingSeconds(null)).toBe(0);
      expect(getJwtRemainingSeconds({})).toBe(0);
    });
  });
});
