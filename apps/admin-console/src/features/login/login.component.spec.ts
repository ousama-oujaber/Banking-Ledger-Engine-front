import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Router } from '@angular/router';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { LoginComponent } from './login.component';

function createMockToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadStr = btoa(JSON.stringify(payload));
  return `${header}.${payloadStr}.fake_sig`;
}

describe('LoginComponent (Admin Console)', () => {
  let component: LoginComponent;
  let mockRouter: Router;

  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();
    vi.restoreAllMocks();

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    } as unknown as Router;

    component = new LoginComponent(mockRouter);
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should initialize with default signal values', () => {
    expect(component.username()).toBe('');
    expect(component.password()).toBe('');
    expect(component.error()).toBeNull();
    expect(component.loading()).toBe(false);
    expect(component.lockoutSeconds()).toBe(0);
    expect(component.isLockedOut()).toBe(false);
  });

  it('should successfully log in an operator and navigate to dashboard', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockToken({
      sub: 'op-01',
      preferred_username: 'teller_dan',
      roles: ['OPERATOR'],
      permissions: ['account:read'],
      exp: future,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    component.username.set('teller_dan');
    component.password.set('valid_pass');

    await component.onSubmit();

    expect(AuthService.getToken()).toBe(token);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    expect(component.error()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('should reject login if user only possesses CUSTOMER role', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockToken({
      sub: 'cust-99',
      preferred_username: 'retail_customer',
      roles: ['CUSTOMER'],
      permissions: [],
      exp: future,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    component.username.set('retail_customer');
    component.password.set('password');

    await component.onSubmit();

    expect(AuthService.getToken()).toBeNull();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.error()).toBe(
      'Access denied. Customer accounts cannot access the Back-Office Console.',
    );
  });

  it('should display error on HTTP 401 invalid credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BAD_CREDENTIALS' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    component.username.set('wrong');
    component.password.set('creds');

    await component.onSubmit();

    expect(component.error()).toBe('Invalid username or password.');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(component.loading()).toBe(false);
  });

  it('should activate lockout countdown timer on HTTP 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'BRUTE_FORCE_BLOCKED', retryAfter: 45 }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    component.username.set('attacker');
    component.password.set('brute');

    await component.onSubmit();

    expect(component.lockoutSeconds()).toBe(45);
    expect(component.isLockedOut()).toBe(true);
    expect(component.error()).toContain('Too many attempts');
    expect(component.error()).toContain('45s');
  });

  it('should correctly format countdown seconds into minutes and seconds', () => {
    expect(component.formatCountdown(125)).toBe('2m 05s');
    expect(component.formatCountdown(60)).toBe('1m 00s');
    expect(component.formatCountdown(30)).toBe('30s');
  });
});
