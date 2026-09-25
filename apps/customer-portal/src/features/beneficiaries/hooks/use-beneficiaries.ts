import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  list2,
  create2,
  remove,
  type BeneficiaryResponse,
  type ApiError,
} from '@ble-frontend/api-client';
import { useAuth } from '../../../app/providers';
import {
  mapBeneficiaryResponseToDomain,
  type Beneficiary,
  type CreateBeneficiaryCommand,
} from '../types';

export function useBeneficiaries() {
  const { user } = useAuth();
  const ownerId = user?.id || '';

  return useQuery<Beneficiary[], Error>({
    queryKey: ['beneficiaries', ownerId],
    queryFn: async () => {
      try {
        const resp = (await list2({
          ownerId: ownerId || undefined,
          includeRemoved: false,
        })) as BeneficiaryResponse[] | BeneficiaryResponse;

        const list = Array.isArray(resp) ? resp : resp ? [resp] : [];
        return list.map(mapBeneficiaryResponseToDomain).filter((b) => b.status !== 'REMOVED');
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to load beneficiaries');
      }
    },
    enabled: Boolean(ownerId),
  });
}

export function useCreateBeneficiaryMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const ownerId = user?.id || '';

  return useMutation<Beneficiary, Error | ApiError, CreateBeneficiaryCommand>({
    mutationFn: async (command) => {
      const resp = (await create2({
        requestBody: {
          ownerId,
          destinationAccountId: command.destinationAccountId,
          name: command.name,
          currency: command.currency as any,
          iban: command.iban,
          autoActivate: true,
        },
      })) as BeneficiaryResponse;

      return mapBeneficiaryResponseToDomain(resp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
    },
  });
}

export function useDeleteBeneficiaryMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error | ApiError, string>({
    mutationFn: async (id: string) => {
      await remove({ id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
    },
  });
}
