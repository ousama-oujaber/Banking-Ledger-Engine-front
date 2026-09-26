/**
 * Playwright E2E Auth Helpers: Generate realistic signed/mock JWT tokens
 * conforming to @ble-frontend/auth JwtTokenClaims requirements.
 */

export interface MockTokenOptions {
  sub?: string;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  expiresInSeconds?: number;
}

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Creates a valid base64url-encoded JWT with header, payload, and dummy signature.
 */
export function createMockJwt(options: MockTokenOptions = {}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresIn = options.expiresInSeconds ?? 7200; // 2 hours default

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    sub: options.sub ?? 'user-e2e-001',
    preferred_username: options.username ?? 'e2e_user',
    name: options.username ?? 'E2E Test User',
    email: options.email ?? 'e2e@ble-ledger.local',
    roles: options.roles ?? ['CUSTOMER'],
    permissions: options.permissions ?? ['transfers:read', 'transfers:write', 'accounts:read'],
    iat: nowSeconds,
    exp: nowSeconds + expiresIn,
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const dummySignature = 'mock_signature_for_e2e_test_suite_verification_only';

  return `${headerB64}.${payloadB64}.${dummySignature}`;
}

export const MOCK_TOKENS = {
  customer: createMockJwt({
    sub: 'cust-e2e-01',
    username: 'alice_customer',
    roles: ['CUSTOMER'],
    permissions: ['transfers:execute', 'accounts:view'],
  }),
  operator: createMockJwt({
    sub: 'op-e2e-01',
    username: 'bob_operator',
    roles: ['OPERATOR'],
    permissions: ['accounts:manage', 'recon:manage', 'settlement:manage'],
  }),
  admin: createMockJwt({
    sub: 'admin-e2e-01',
    username: 'carol_admin',
    roles: ['ADMIN', 'OPERATOR'],
    permissions: ['*'],
  }),
};
