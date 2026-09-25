import { Currency } from '@ble-frontend/domain-types';
import type { BeneficiaryResponse } from '@ble-frontend/api-client';

export type BeneficiaryStatus = 'ACTIVE' | 'PENDING' | 'BLOCKED' | 'REMOVED';

export interface Beneficiary {
  id: string;
  ownerId: string;
  destinationAccountId: string;
  name: string;
  currency: Currency;
  iban?: string;
  status: BeneficiaryStatus;
  blockReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBeneficiaryCommand {
  name: string;
  destinationAccountId: string;
  currency: Currency;
  iban?: string;
}

export function mapBeneficiaryResponseToDomain(dto: BeneficiaryResponse): Beneficiary {
  return {
    id: dto.id || '',
    ownerId: dto.ownerId || '',
    destinationAccountId: dto.destinationAccountId || '',
    name: dto.name || 'Unnamed Beneficiary',
    currency: (dto.currency as Currency) || Currency.EUR,
    iban: dto.iban,
    status: (dto.status as BeneficiaryStatus) || 'ACTIVE',
    blockReason: dto.blockReason,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
