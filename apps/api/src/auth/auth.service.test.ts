import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '@/database/database.service';

import type { PasswordHasher } from './adapters/password-hasher';
import type { AuthConfig } from './auth.config';
import { AuthService, EmailAlreadyExistsError } from './auth.service';
import type { SessionRepository } from './repositories/session.repository';
import type { UserRepository, UserRecord } from './repositories/user.repository';

const user: UserRecord = {
  id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
  name: 'Володимир',
  email: 'Volodymyr@example.com',
  emailNormalized: 'volodymyr@example.com',
  passwordHash: '$argon2id$hash',
};

function createService(overrides?: {
  createUserError?: unknown;
  existingUser?: UserRecord | null;
}) {
  const existingUser = overrides && 'existingUser' in overrides ? overrides.existingUser : user;
  const create = overrides?.createUserError
    ? vi.fn().mockRejectedValue(overrides.createUserError)
    : vi.fn().mockResolvedValue(user);
  const users = {
    create,
    findByNormalizedEmail: vi.fn().mockResolvedValue(existingUser),
  };
  const sessions = {
    create: vi.fn().mockResolvedValue(undefined),
    createStandalone: vi.fn().mockResolvedValue(undefined),
    findUserByTokenHash: vi
      .fn()
      .mockResolvedValue({ id: user.id, name: user.name, email: user.email }),
    deleteByTokenHash: vi.fn().mockResolvedValue(undefined),
  };
  const passwordHasher = {
    hash: vi.fn().mockResolvedValue('$argon2id$hash'),
    verify: vi.fn().mockResolvedValue(true),
    verifyUnknownPassword: vi.fn().mockResolvedValue(undefined),
  };
  const database = {
    transaction: vi.fn(async (work: (client: object) => Promise<unknown>) => work({})),
  };
  const config = { sessionTtlSeconds: 86_400, cookieName: 'mt_session' };
  const service = new AuthService(
    database as unknown as DatabaseService,
    users as unknown as UserRepository,
    sessions as unknown as SessionRepository,
    passwordHasher as unknown as PasswordHasher,
    config as unknown as AuthConfig,
  );
  return { service, users, sessions, passwordHasher };
}

describe('AuthService', () => {
  it('atomically creates a user and a hashed session token', async () => {
    const { service, users, sessions, passwordHasher } = createService();
    const result = await service.register(
      { name: 'Володимир', email: 'Volodymyr@example.com', password: 'secret123' },
      'trace-id',
    );

    expect(passwordHasher.hash).toHaveBeenCalledWith('secret123');
    expect(users.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: 'Volodymyr@example.com',
        emailNormalized: 'volodymyr@example.com',
        passwordHash: '$argon2id$hash',
      }),
    );
    expect(sessions.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: user.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.user).toEqual({ id: user.id, name: user.name, email: user.email });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('maps the email unique constraint to a domain conflict', async () => {
    const { service } = createService({
      createUserError: { code: '23505', constraint: 'users_email_normalized_key' },
    });
    await expect(
      service.register(
        { name: 'Володимир', email: 'user@example.com', password: 'secret123' },
        'trace-id',
      ),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('performs a dummy verification for an unknown email', async () => {
    const { service, passwordHasher } = createService({ existingUser: null });
    await expect(
      service.login({ email: 'missing@example.com', password: 'secret123' }, 'trace-id'),
    ).resolves.toBeNull();
    expect(passwordHasher.verifyUnknownPassword).toHaveBeenCalledWith('secret123');
  });
});
