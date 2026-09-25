import { useMutation } from '@tanstack/react-query';
import { generateStatement, type ApiError } from '@ble-frontend/api-client';
import {
  mapStatementResponseToDomain,
  type AccountStatement,
  type GenerateStatementParams,
} from '../types';

export function useGenerateStatementMutation() {
  return useMutation<AccountStatement, Error | ApiError, GenerateStatementParams>({
    mutationFn: async ({ accountId, fromDate, toDate }) => {
      try {
        const resp = await generateStatement({
          accountId,
          requestBody: {
            fromDate,
            toDate,
          },
        });
        return mapStatementResponseToDomain(resp);
      } catch (err) {
        throw err instanceof Error ? err : new Error('Failed to generate statement');
      }
    },
  });
}
