import { OpenAPI } from './generated/core/OpenAPI';

/**
 * Base HTTP client wrapper.
 * The actual generated endpoints live in ./generated/
 * This class provides shared configuration and the interceptor pipeline.
 * It reuses OpenAPI.interceptors so auth/idempotency headers are applied consistently.
 */
export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = '/api/v1') {
    this.baseURL = baseURL;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let request: RequestInit = {
      ...options,
      headers: new Headers({
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      }),
    };

    for (const fn of OpenAPI.interceptors.request._fns) {
      request = await fn(request);
    }

    let response = await fetch(`${this.baseURL}${path}`, request);

    for (const fn of OpenAPI.interceptors.response._fns) {
      response = await fn(response);
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
