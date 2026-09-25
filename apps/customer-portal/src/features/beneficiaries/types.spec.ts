import { describe, it, expect } from 'vitest';
import { Currency } from '@ble-frontend/domain-types';
import { mapBeneficiaryResponseToDomain } from './types';

describe('Beneficiary Domain Mapping', () => {
  it('maps full DTO correctly', () => {
    const dto = {
      id: 'ben-1',
      ownerId: 'cust-1',
      destinationAccountId: 'acc-2',
      name: 'Alice Smith',
      currency: 'USD' as const,
      iban: 'US1234567890',
      status: 'ACTIVE' as const,
      blockReason: undefined,
      createdAt: '2026-09-01T12:00:00Z',
      updatedAt: '2026-09-02T12:00:00Z',
    };

    const domain = mapBeneficiaryResponseToDomain(dto);
    expect(domain.id).toBe('ben-1');
    expect(domain.ownerId).toBe('cust-1');
    expect(domain.destinationAccountId).toBe('acc-2');
    expect(domain.name).toBe('Alice Smith');
    expect(domain.currency).toBe(Currency.USD);
    expect(domain.iban).toBe('US1234567890');
    expect(domain.status).toBe('ACTIVE');
  });

  it('maps default fallback values when fields are missing', () => {
    const dto = {};
    const domain = mapBeneficiaryResponseToDomain(dto);
    expect(domain.id).toBe('');
    expect(domain.name).toBe('Unnamed Beneficiary');
    expect(domain.currency).toBe(Currency.EUR);
    expect(domain.status).toBe('ACTIVE');
  });
});
