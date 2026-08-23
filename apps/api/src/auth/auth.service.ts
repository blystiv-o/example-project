import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthUser, LoginRequest, RegisterRequest } from '@money-tracker/shared';
import { normalizeEmail } from '@money-tracker/shared';
import type { Request } from 'express';

import { DatabaseService } from '@/database/database.service';

import { PasswordHasher } from './adapters/password-hasher';
import { createSessionToken, hashSessionToken } from './adapters/session-token';
import { AuthConfig } from './auth.config';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository, type UserRecord } from './repositories/user.repository';

interface AuthResult {
  user: AuthUser;
  token: string;
}

interface DatabaseError {
  code?: string;
  constraint?: string;
}

export class EmailAlreadyExistsError extends Error {}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(PasswordHasher) private readonly passwordHasher: PasswordHasher,
    @Inject(AuthConfig) private readonly config: AuthConfig,
  ) {}

  async register(input: RegisterRequest, traceId: string): Promise<AuthResult> {
    const started = Date.now();
    try {
      const passwordHash = await this.passwordHasher.hash(input.password);
      const token = createSessionToken();
      const tokenHash = hashSessionToken(token);
      const expiresAt = this.expirationDate();
      const user = await this.database.transaction(async (client) => {
        const created = await this.users.create(client, {
          name: input.name,
          email: input.email,
          emailNormalized: normalizeEmail(input.email),
          passwordHash,
        });
        await this.sessions.create(client, { userId: created.id, tokenHash, expiresAt });
        return created;
      });
      this.log('auth.register.succeeded', 'success', traceId, started, user.id);
      return { user: this.toAuthUser(user), token };
    } catch (error) {
      const databaseError = error as DatabaseError;
      this.log('auth.register.failed', 'failed', traceId, started);
      if (
        databaseError.code === '23505' &&
        databaseError.constraint === 'users_email_normalized_key'
      ) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async login(input: LoginRequest, traceId: string): Promise<AuthResult | null> {
    const started = Date.now();
    const emailNormalized = normalizeEmail(input.email);
    const user = await this.users.findByNormalizedEmail(emailNormalized);
    if (!user) {
      await this.passwordHasher.verifyUnknownPassword(input.password);
      this.log('auth.login.failed', 'invalid_credentials', traceId, started);
      return null;
    }
    if (!(await this.passwordHasher.verify(user.passwordHash, input.password))) {
      this.log('auth.login.failed', 'invalid_credentials', traceId, started, user.id);
      return null;
    }

    const token = createSessionToken();
    await this.sessions.createStandalone({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: this.expirationDate(),
    });
    this.log('auth.login.succeeded', 'success', traceId, started, user.id);
    return { user: this.toAuthUser(user), token };
  }

  async authenticate(token: string | null, traceId: string): Promise<AuthUser | null> {
    if (!token) {
      this.log('auth.session.rejected', 'missing', traceId, Date.now());
      return null;
    }
    const user = await this.sessions.findUserByTokenHash(hashSessionToken(token), new Date());
    if (!user) this.log('auth.session.rejected', 'unknown_or_expired', traceId, Date.now());
    return user;
  }

  async logout(token: string | null, traceId: string): Promise<void> {
    const started = Date.now();
    if (token) await this.sessions.deleteByTokenHash(hashSessionToken(token));
    this.log('auth.logout.succeeded', 'success', traceId, started);
  }

  readToken(request: Pick<Request, 'headers'>): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0) continue;
      const name = part.slice(0, separator).trim();
      if (name !== this.config.cookieName) continue;
      try {
        return decodeURIComponent(part.slice(separator + 1));
      } catch {
        return null;
      }
    }
    return null;
  }

  private expirationDate(): Date {
    return new Date(Date.now() + this.config.sessionTtlSeconds * 1000);
  }

  private toAuthUser(user: UserRecord): AuthUser {
    return { id: user.id, name: user.name, email: user.email };
  }

  private log(
    event: string,
    outcome: string,
    traceId: string,
    started: number,
    userId?: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        trace_id: traceId,
        event,
        outcome,
        duration_ms: Date.now() - started,
        ...(userId ? { user_id: userId } : {}),
      }),
    );
  }
}
