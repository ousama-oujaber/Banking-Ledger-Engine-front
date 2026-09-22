import { AuthService } from '@ble-frontend/auth';
import { AppError, parseBackendError } from '@ble-frontend/domain-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interceptor chain for the OpenAPI generated client.
 * - Injects Authorization: Bearer token
 * - Generates X-Idempotency-Key for mutating requests
 * - Appends X-Trace-Id for distributed tracing
 * - Normalizes backend ErrorResponse into typed AppError
 */
export class ApiInterceptors {
  private static generateTraceId(): string {
    return uuidv4();
  }

  private static generateIdempotencyKey(): string {
    return uuidv4();
  }

  /**
   * Returns headers to attach to every request.
   */
  static getRequestHeaders(method: string): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Trace-Id': this.generateTraceId(),
    };

    const token = AuthService.getToken();
    if (token && !AuthService.isTokenExpired()) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (mutatingMethods.includes(method.toUpperCase())) {
      headers['X-Idempotency-Key'] = this.generateIdempotencyKey();
    }

    return headers;
  }

  /**
   * Wraps a fetch response and throws a typed AppError on failure.
   */
  static async handleResponse(response: Response): Promise<Response> {
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error: any = {
        response: { status: response.status, data },
      };
      throw parseBackendError(error);
    }
    return response;
  }
}

export { parseBackendError } from '@ble-frontend/domain-types';
export type { AppError } from '@ble-frontend/domain-types';
