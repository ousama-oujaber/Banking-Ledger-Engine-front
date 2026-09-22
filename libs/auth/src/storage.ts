import { StorageAdapter } from './types';

/**
 * In-memory fallback storage adapter for SSR, headless environments, or unit tests.
 */
export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Browser sessionStorage wrapper that safely catches access restrictions
 * (e.g. cross-origin iframes, private browsing restrictions, or headless Node).
 */
export class BrowserSessionStorage implements StorageAdapter {
  private memoryFallback = new MemoryStorage();

  private isAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
        return false;
      }
      const testKey = '__ble_storage_test__';
      window.sessionStorage.setItem(testKey, '1');
      window.sessionStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (this.isAvailable()) {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return this.memoryFallback.getItem(key);
      }
    }
    return this.memoryFallback.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (this.isAvailable()) {
      try {
        window.sessionStorage.setItem(key, value);
        return;
      } catch {
        this.memoryFallback.setItem(key, value);
        return;
      }
    }
    this.memoryFallback.setItem(key, value);
  }

  removeItem(key: string): void {
    if (this.isAvailable()) {
      try {
        window.sessionStorage.removeItem(key);
        return;
      } catch {
        this.memoryFallback.removeItem(key);
        return;
      }
    }
    this.memoryFallback.removeItem(key);
  }

  clear(): void {
    if (this.isAvailable()) {
      try {
        window.sessionStorage.clear();
      } catch {
        this.memoryFallback.clear();
      }
    }
    this.memoryFallback.clear();
  }
}

/**
 * Resolves the effective storage adapter: returns custom adapter if provided,
 * otherwise an instance of BrowserSessionStorage.
 */
export function getEffectiveStorage(customAdapter?: StorageAdapter): StorageAdapter {
  if (customAdapter) {
    return customAdapter;
  }
  return new BrowserSessionStorage();
}
