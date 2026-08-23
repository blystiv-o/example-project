import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '@/database/database.service';

import { parseSafeInteger, toIsoString } from './categories.utils';
import type { CategoryRecord, CategoryWithSpentRecord } from './categories.types';

interface CreateCategoryInput {
  userId: string;
  name: string;
  nameNormalized: string;
  type: string;
  monthlyBudgetMinor: number;
}

interface UpdateCategoryInput {
  name?: string;
  nameNormalized?: string;
  type?: string;
  monthlyBudgetMinor?: number;
}

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  monthly_budget_minor: string | number;
  version: number;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CategoryWithSpentRow extends CategoryRow {
  spent_minor: string | number;
}

@Injectable()
export class CategoryRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async listActiveWithSpent(
    userId: string,
    startsOn: string,
    endsBefore: string,
  ): Promise<CategoryWithSpentRecord[]> {
    const result = await this.database.query<CategoryWithSpentRow>(
      `
        SELECT
          c.id,
          c.user_id,
          c.name,
          c.type,
          c.monthly_budget_minor,
          c.version,
          c.archived_at,
          c.created_at,
          c.updated_at,
          COALESCE(spent.spent_minor, 0) AS spent_minor
        FROM categories c
        LEFT JOIN (
          SELECT category_id, SUM(amount_minor)::bigint AS spent_minor
          FROM expenses
          WHERE user_id = $1
            AND deleted_at IS NULL
            AND expense_date >= $2::date
            AND expense_date < $3::date
          GROUP BY category_id
        ) spent ON spent.category_id = c.id
        WHERE c.user_id = $1
          AND c.archived_at IS NULL
        ORDER BY c.created_at DESC, c.id DESC
      `,
      [userId, startsOn, endsBefore],
    );

    return result.rows.map((row) => ({
      ...this.mapRow(row),
      spentMinor: parseSafeInteger(row.spent_minor, 'spent_minor'),
    }));
  }

  async totalSpentForPeriod(userId: string, startsOn: string, endsBefore: string): Promise<number> {
    const result = await this.database.query<{ total_spent_minor: string | number }>(
      `
        SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total_spent_minor
        FROM expenses
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND expense_date >= $2::date
          AND expense_date < $3::date
      `,
      [userId, startsOn, endsBefore],
    );
    return parseSafeInteger(result.rows[0]?.total_spent_minor, 'total_spent_minor');
  }

  async create(client: PoolClient, input: CreateCategoryInput): Promise<CategoryRecord> {
    const result = await client.query<CategoryRow>(
      `
        INSERT INTO categories (
          id,
          user_id,
          name,
          name_normalized,
          type,
          monthly_budget_minor
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, name, type, monthly_budget_minor, version, archived_at, created_at, updated_at
      `,
      [
        randomUUID(),
        input.userId,
        input.name,
        input.nameNormalized,
        input.type,
        input.monthlyBudgetMinor,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByIdForUpdate(
    client: PoolClient,
    userId: string,
    categoryId: string,
  ): Promise<CategoryRecord | null> {
    const result = await client.query<CategoryRow>(
      `
        SELECT id, user_id, name, type, monthly_budget_minor, version, archived_at, created_at, updated_at
        FROM categories
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [categoryId, userId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(
    client: PoolClient,
    categoryId: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryRecord> {
    const sets: string[] = [];
    const values: unknown[] = [categoryId];
    let position = values.length + 1;

    if (input.name !== undefined) {
      sets.push(`name = $${position++}`);
      values.push(input.name);
    }
    if (input.nameNormalized !== undefined) {
      sets.push(`name_normalized = $${position++}`);
      values.push(input.nameNormalized);
    }
    if (input.type !== undefined) {
      sets.push(`type = $${position++}`);
      values.push(input.type);
    }
    if (input.monthlyBudgetMinor !== undefined) {
      sets.push(`monthly_budget_minor = $${position++}`);
      values.push(input.monthlyBudgetMinor);
    }

    sets.push(`version = version + 1`);

    const result = await client.query<CategoryRow>(
      `
        UPDATE categories
        SET ${sets.join(', ')}
        WHERE id = $1
        RETURNING id, user_id, name, type, monthly_budget_minor, version, archived_at, created_at, updated_at
      `,
      values,
    );
    return this.mapRow(result.rows[0]);
  }

  async archive(client: PoolClient, categoryId: string): Promise<void> {
    await client.query(
      `
        UPDATE categories
        SET archived_at = now(), version = version + 1
        WHERE id = $1
      `,
      [categoryId],
    );
  }

  private mapRow(row: CategoryRow | undefined): CategoryRecord {
    if (!row) throw new Error('Category row is required');
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      monthlyBudgetMinor: parseSafeInteger(row.monthly_budget_minor, 'monthly_budget_minor'),
      version: row.version,
      archivedAt: row.archived_at ? toIsoString(row.archived_at) : null,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }
}
