import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiRequestException } from './client';
import { initApiClient } from './interceptors';

describe('ApiClient wrapper', () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    initApiClient('http://localhost:8080');
    client = new ApiClient('/api/v1');
  });

  describe('baseURL configuration', () => {
    it('should set and get base URL', () => {
      client.setBaseURL('https://api.ledger.internal');
      expect(client.getBaseURL()).toBe('https://api.ledger.internal');
    });
  });

  describe('HTTP operations', () => {
    it('should execute GET requests and return parsed JSON', async () => {
      const mockData = [{ id: 'acc-1', currency: 'EUR' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });

      const result = await client.get('/accounts');
      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/accounts',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should execute POST requests with JSON payload', async () => {
      const payload = { amount: 100, currency: 'USD' };
      const responseData = { id: 'tx-123' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData,
      });

      const result = await client.post('/transfers', payload);
      expect(result).toEqual(responseData);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/transfers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('should handle 204 No Content gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Headers(),
      });

      const result = await client.delete('/accounts/acc-1');
      expect(result).toBeUndefined();
    });

    it('should normalize HTTP errors into ApiRequestException with typed AppError', async () => {
      const errorBody = {
        code: 'ACCOUNT_FROZEN',
        message: 'Account is currently frozen.',
        traceId: 'trace-freeze-123',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: new Headers({
          'content-type': 'application/json',
          'x-trace-id': 'trace-freeze-123',
        }),
        json: async () => errorBody,
      });

      try {
        await client.post('/transfers', { from: 'acc-frozen' });
        expect.fail('Should have thrown ApiRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestException);
        const apiEx = err as ApiRequestException;
        expect(apiEx.appError.status).toBe(422);
        expect(apiEx.appError.code).toBe('ACCOUNT_FROZEN');
        expect(apiEx.appError.traceId).toBe('trace-freeze-123');
        expect(apiEx.message).toContain('ACCOUNT_FROZEN');
      }
    });

    it('should handle network drops as ApiRequestException with status 0', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      try {
        await client.get('/accounts');
        expect.fail('Should have thrown ApiRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiRequestException);
        const apiEx = err as ApiRequestException;
        expect(apiEx.appError.status).toBe(0);
        expect(apiEx.appError.isNetworkError).toBe(true);
        expect(apiEx.appError.code).toBe('NETWORK_ERROR');
      }
    });
  });
});
