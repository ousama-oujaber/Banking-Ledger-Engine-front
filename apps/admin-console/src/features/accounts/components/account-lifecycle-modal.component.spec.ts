import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccountLifecycleModalComponent } from './account-lifecycle-modal.component';
import { AccountAdminService } from '../services/account-admin.service';
import type { AccountResponse } from '@ble-frontend/api-client';

const mockActiveAccount: AccountResponse = {
  id: 'acc-active-01',
  ownerId: 'cust-101',
  label: 'Treasury Primary',
  type: 'CLASSIC',
  currency: 'EUR',
  status: 'ACTIVE',
  derivedBalance: { amount: 1250.0, currency: 'EUR' },
};

const mockFrozenAccount: AccountResponse = {
  id: 'acc-frozen-02',
  ownerId: 'cust-202',
  label: 'Frozen Reserve',
  type: 'SAVINGS',
  currency: 'USD',
  status: 'FROZEN',
  derivedBalance: { amount: 0.0, currency: 'USD' },
};

const mockZeroActiveAccount: AccountResponse = {
  id: 'acc-zero-03',
  ownerId: 'cust-303',
  label: 'Zero Inactive',
  type: 'CLASSIC',
  currency: 'EUR',
  status: 'ACTIVE',
  derivedBalance: { amount: 0.0, currency: 'EUR' },
};

describe('AccountLifecycleModalComponent (S4-T3)', () => {
  let component: AccountLifecycleModalComponent;
  let service: AccountAdminService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AccountAdminService();
    component = new AccountLifecycleModalComponent(service);
  });

  describe('Modal Visibility & Initialization', () => {
    it('should initialize with default states', () => {
      expect(component.reason()).toBe('');
      expect(component.confirmCloseText()).toBe('');
      expect(component.submitting()).toBe(false);
      expect(component.error()).toBeNull();
    });
  });

  describe('Freeze Mode (FR-OPS-ACC-01)', () => {
    beforeEach(() => {
      component.account.set(mockActiveAccount);
      component.mode.set('FREEZE');
      component.isOpen.set(true);
    });

    it('should validate mandatory reason (min 3 chars)', () => {
      component.reason.set('');
      expect(component.isFreezeValid()).toBe(false);

      component.reason.set('ab');
      expect(component.isFreezeValid()).toBe(false);

      component.reason.set('Court freeze order #1234');
      expect(component.isFreezeValid()).toBe(true);
    });

    it('should call service.freezeAccount and emit onSuccess on submit', async () => {
      const freezeSpy = vi.spyOn(service, 'freezeAccount').mockResolvedValueOnce({
        ...mockActiveAccount,
        status: 'FROZEN',
      });
      const successSpy = vi.fn();
      component.onSuccess.subscribe(successSpy);

      component.reason.set('AML investigation flag');
      await component.submit();

      expect(freezeSpy).toHaveBeenCalledWith('acc-active-01', 'AML investigation flag');
      expect(successSpy).toHaveBeenCalledWith({
        accountId: 'acc-active-01',
        status: 'FROZEN',
      });
      expect(component.submitting()).toBe(false);
    });

    it('should capture and display error when freezeAccount fails', async () => {
      vi.spyOn(service, 'freezeAccount').mockRejectedValueOnce(
        new Error('Account already frozen or invalid version'),
      );

      component.reason.set('Valid reason');
      await component.submit();

      expect(component.error()).toBe('Account already frozen or invalid version');
      expect(component.submitting()).toBe(false);
    });
  });

  describe('Unfreeze Mode (FR-OPS-ACC-01)', () => {
    beforeEach(() => {
      component.account.set(mockFrozenAccount);
      component.mode.set('UNFREEZE');
      component.isOpen.set(true);
    });

    it('should allow submit with or without reason', async () => {
      const unfreezeSpy = vi.spyOn(service, 'unfreezeAccount').mockResolvedValueOnce({
        ...mockFrozenAccount,
        status: 'ACTIVE',
      });
      const successSpy = vi.fn();
      component.onSuccess.subscribe(successSpy);

      await component.submit();

      expect(unfreezeSpy).toHaveBeenCalledWith('acc-frozen-02', undefined);
      expect(successSpy).toHaveBeenCalledWith({
        accountId: 'acc-frozen-02',
        status: 'ACTIVE',
      });
    });
  });

  describe('Close Mode & Invariant Check (FR-OPS-ACC-02, BR-F05)', () => {
    it('should reject closure if account has non-zero balance', () => {
      component.account.set(mockActiveAccount); // 1250.00 EUR
      component.mode.set('CLOSE');
      component.isOpen.set(true);

      expect(component.isZeroBalance()).toBe(false);
      expect(component.isCloseValid()).toBe(false);
    });

    it('should require typing "CLOSE" to enable closure of zero-balance account', () => {
      component.account.set(mockZeroActiveAccount); // 0.00 EUR
      component.mode.set('CLOSE');
      component.isOpen.set(true);

      expect(component.isZeroBalance()).toBe(true);

      component.confirmCloseText.set('wrong');
      expect(component.isCloseValid()).toBe(false);

      component.confirmCloseText.set('CLOSE');
      expect(component.isCloseValid()).toBe(true);
    });

    it('should call service.closeAccount and emit onSuccess when confirmed', async () => {
      component.account.set(mockZeroActiveAccount);
      component.mode.set('CLOSE');
      component.isOpen.set(true);
      component.confirmCloseText.set('CLOSE');

      const closeSpy = vi.spyOn(service, 'closeAccount').mockResolvedValueOnce();
      const successSpy = vi.fn();
      component.onSuccess.subscribe(successSpy);

      await component.submit();

      expect(closeSpy).toHaveBeenCalledWith('acc-zero-03');
      expect(successSpy).toHaveBeenCalledWith({
        accountId: 'acc-zero-03',
        status: 'CLOSED',
      });
    });
  });

  describe('Modal Cancel & Close Trigger', () => {
    it('should reset form state and emit onClose', () => {
      const closeSpy = vi.fn();
      component.onClose.subscribe(closeSpy);

      component.reason.set('Some reason');
      component.confirmCloseText.set('CLOSE');
      component.error.set('Previous error');

      component.handleCancel();

      expect(component.reason()).toBe('');
      expect(component.confirmCloseText()).toBe('');
      expect(component.error()).toBeNull();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
