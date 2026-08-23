import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '@money-tracker/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '@/database/database.service';

interface SessionUserRow {
  session_id: string;
  expires_at: Date;
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class SessionRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(
    client: PoolClient,
    input: { userId: string; tokenHash: string; expiresAt: Date },
  ): Promise<void> {
    await client.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), input.userId, input.tokenHash, input.expiresAt],
    );
  }

  async createStandalone(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), input.userId, input.tokenHash, input.expiresAt],
    );
  }

  async findUserByTokenHash(tokenHash: string, now: Date): Promise<AuthUser | null> {
    const result = await this.database.query<SessionUserRow>(
      `SELECT s.id AS session_id, s.expires_at, u.id, u.name, u.email
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.expires_at <= now) {
      await this.deleteByTokenHash(tokenHash);
      return null;
    }
    return { id: row.id, name: row.name, email: row.email };
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.database.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async deleteExpired(now = new Date()): Promise<number> {
    const result = await this.database.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
    return result.rowCount ?? 0;
  }
}
