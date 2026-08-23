import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createSessionToken, hashSessionToken } from './session-token';

describe('session token', () => {
  it('creates a unique token with at least 256 bits of entropy', () => {
    const first = createSessionToken();
    const second = createSessionToken();
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(first).not.toBe(second);
  });

  it('stores a SHA-256 hash rather than the raw token', () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
  });
});
