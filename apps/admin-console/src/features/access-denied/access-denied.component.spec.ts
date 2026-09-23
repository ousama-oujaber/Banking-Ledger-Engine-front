import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { AuthService, MemoryStorage } from '@ble-frontend/auth';
import { AccessDeniedComponent } from './access-denied.component';

describe('AccessDeniedComponent (Admin Console)', () => {
  let component: AccessDeniedComponent;
  let mockRouter: Router;

  beforeEach(() => {
    AuthService.setStorageAdapter(new MemoryStorage());
    AuthService.clear();

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    } as unknown as Router;

    component = new AccessDeniedComponent(mockRouter);
  });

  it('should clear authentication state and navigate to /login on logoutAndReturn', () => {
    AuthService.setToken('fake-customer-token');
    expect(AuthService.getToken()).toBe('fake-customer-token');

    component.logoutAndReturn();

    expect(AuthService.getToken()).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
