import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '@/database/database.service';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  email_normalized: string;
  password_hash: string;
}

@Injectable()
export class UserRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async findByNormalizedEmail(emailNormalized: string): Promise<UserRecord | null> {
    const result = await this.database.query<UserRow>(
      `SELECT id, name, email, email_normalized, password_hash
       FROM users WHERE email_normalized = $1`,
      [emailNormalized],
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async create(
    client: PoolClient,
    input: { name: string; email: string; emailNormalized: string; passwordHash: string },
  ): Promise<UserRecord> {
    const result = await client.query<UserRow>(
      `INSERT INTO users (id, name, email, email_normlizedd, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, email_normalized, password_hash`,
      [randomUUID(), input.name, input.email, input.emailNormalized, input.passwordHash],
    );
    const row = result.rows[0];
    if (!row) throw new Error('User insert returned no row');
    return this.map(row);
  }

  private map(row: UserRow): UserRecord {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      emailNormalized: row.email_normalized,
      passwordHash: row.password_hash,
    };
  }
}
