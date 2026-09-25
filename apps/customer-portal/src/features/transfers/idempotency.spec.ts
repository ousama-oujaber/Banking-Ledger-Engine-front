import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey } from './idempotency';

describe('Idempotency Key Generator (idempotency.ts)', () => {
  it('generates a valid UUID v4 string', () => {
    const key = generateIdempotencyKey();
    expect(key).toBeTypeOf('string');
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('generates distinct keys on subsequent calls', () => {
    const key1 = generateIdempotencyKey();
    const key2 = generateIdempotencyKey();
    const key3 = generateIdempotencyKey();

    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
    expect(key1).not.toBe(key3);
  });
});
