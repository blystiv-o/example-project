import { describe, expect, it } from 'vitest';

import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  it('uses Argon2id and verifies without exposing the password', async () => {
    const hasher = new PasswordHasher();
    const hash = await hasher.hash('secret123');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(hash).not.toContain('secret123');
    await expect(hasher.verify(hash, 'secret123')).resolves.toBe(true);
    await expect(hasher.verify(hash, 'different')).resolves.toBe(false);
  });
});
