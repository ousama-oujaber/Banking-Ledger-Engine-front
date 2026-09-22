import { ApiInterceptors } from './interceptors';

/**
 * Base HTTP client wrapper.
 * The actual generated endpoints live in ./generated/
 * This class provides shared configuration and the interceptor pipeline.
 */
export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = '/api/v1') {
    this.baseURL = baseURL;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = options.method ?? 'GET';
    const headers = {
      'Content-Type': 'application/json',
      ...ApiInterceptors.getRequestHeaders(method as string),
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers,
    });

    await ApiInterceptors.handleResponse(response);
    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient();
