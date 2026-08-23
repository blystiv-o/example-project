import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

import { DatabaseService } from '@/database/database.service';
import { parseSafeInteger, toIsoString } from '@/categories/categories.utils';

import type { ExpenseListResult, ExpenseRecord } from './expenses.types';

interface ExpenseRow {
  id: string | null;
  user_id: string | null;
  title: string | null;
  amount_minor: string | number | null;
  expense_date: Date | string | null;
  version: number | null;
  deleted_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  category_id: string | null;
  category_name: string | null;
  category_archived_at: Date | string | null;
  total: string | number;
  filtered_amount_minor: string | number;
  current_month_amount_minor: string | number;
}

interface CategoryRow {
  id: string;
  name: string;
  archived_at: Date | string | null;
}

interface CreateExpenseInput {
  userId: string;
  title: string;
  amountMinor: number;
  categoryId: string;
  expenseDate: string;
}

interface UpdateExpenseInput {
  title?: string;
  amountMinor?: number;
  categoryId?: string;
  expenseDate?: string;
}

@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async list(
    userId: string,
    query: string | undefined,
    categoryId: string | undefined,
    page: number,
    pageSize: number,
    monthStartsOn: string,
    monthEndsBefore: string,
  ): Promise<ExpenseListResult> {
    const offset = (page - 1) * pageSize;
    const result = await this.database.query<ExpenseRow>(
      `
        WITH filtered AS (
          SELECT
            e.id,
            e.user_id,
            e.title,
            e.amount_minor,
            e.expense_date,
            e.version,
            e.deleted_at,
            e.created_at,
            e.updated_at,
            c.id AS category_id,
            c.name AS category_name,
            c.archived_at AS category_archived_at
          FROM expenses e
          JOIN categories c ON c.id = e.category_id AND c.user_id = e.user_id
          WHERE e.user_id = $1
            AND e.deleted_at IS NULL
            AND ($2::text IS NULL OR strpos(lower(e.title), lower($2::text)) > 0)
            AND ($3::uuid IS NULL OR e.category_id = $3::uuid)
        ),
        metrics AS (
          SELECT COUNT(*)::bigint AS total, COALESCE(SUM(amount_minor), 0)::bigint AS filtered_amount_minor
          FROM filtered
        ),
        current_month AS (
          SELECT COALESCE(SUM(amount_minor), 0)::bigint AS current_month_amount_minor
          FROM expenses
          WHERE user_id = $1
            AND deleted_at IS NULL
            AND expense_date >= $6::date
            AND expense_date < $7::date
        ),
        requested_page AS (
          SELECT *
          FROM filtered
          ORDER BY expense_date DESC, created_at DESC, id DESC
          LIMIT $4 OFFSET $5
        )
        SELECT
          p.*,
          m.total,
          m.filtered_amount_minor,
          cm.current_month_amount_minor
        FROM metrics m
        CROSS JOIN current_month cm
        LEFT JOIN requested_page p ON true
        ORDER BY p.expense_date DESC, p.created_at DESC, p.id DESC
      `,
      [userId, query || null, categoryId ?? null, pageSize, offset, monthStartsOn, monthEndsBefore],
    );

    const metrics = result.rows[0];
    if (!metrics) throw new Error('Expense list metrics are required');
    return {
      expenses: result.rows.filter((row) => row.id !== null).map((row) => this.mapRow(row)),
      total: parseSafeInteger(metrics.total, 'total'),
      filteredAmountMinor: parseSafeInteger(metrics.filtered_amount_minor, 'filtered_amount_minor'),
      currentMonthAmountMinor: parseSafeInteger(
        metrics.current_month_amount_minor,
        'current_month_amount_minor',
      ),
    };
  }

  async findCategoryForUpdate(
    client: PoolClient,
    userId: string,
    categoryId: string,
  ): Promise<CategoryRow | null> {
    const result = await client.query<CategoryRow>(
      `SELECT id, name, archived_at FROM categories WHERE id = $1 AND user_id = $2 FOR SHARE`,
      [categoryId, userId],
    );
    return result.rows[0] ?? null;
  }

  async create(client: PoolClient, input: CreateExpenseInput): Promise<ExpenseRecord> {
    const result = await client.query<ExpenseRow>(
      `
        WITH inserted AS (
          INSERT INTO expenses (id, user_id, category_id, title, amount_minor, expense_date)
          VALUES ($1, $2, $3, $4, $5, $6::date)
          RETURNING *
        )
        SELECT
          e.id,
          e.user_id,
          e.title,
          e.amount_minor,
          e.expense_date,
          e.version,
          e.deleted_at,
          e.created_at,
          e.updated_at,
          c.id AS category_id,
          c.name AS category_name,
          c.archived_at AS category_archived_at,
          0::bigint AS total,
          0::bigint AS filtered_amount_minor,
          0::bigint AS current_month_amount_minor
        FROM inserted e
        JOIN categories c ON c.id = e.category_id
      `,
      [
        randomUUID(),
        input.userId,
        input.categoryId,
        input.title,
        input.amountMinor,
        input.expenseDate,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findByIdForUpdate(
    client: PoolClient,
    userId: string,
    expenseId: string,
  ): Promise<ExpenseRecord | null> {
    const result = await client.query<ExpenseRow>(
      `
        SELECT
          e.id,
          e.user_id,
          e.title,
          e.amount_minor,
          e.expense_date,
          e.version,
          e.deleted_at,
          e.created_at,
          e.updated_at,
          c.id AS category_id,
          c.name AS category_name,
          c.archived_at AS category_archived_at,
          0::bigint AS total,
          0::bigint AS filtered_amount_minor,
          0::bigint AS current_month_amount_minor
        FROM expenses e
        JOIN categories c ON c.id = e.category_id AND c.user_id = e.user_id
        WHERE e.id = $1 AND e.user_id = $2
        FOR UPDATE OF e
      `,
      [expenseId, userId],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async update(
    client: PoolClient,
    expenseId: string,
    input: UpdateExpenseInput,
  ): Promise<ExpenseRecord> {
    const sets: string[] = [];
    const values: unknown[] = [expenseId];
    let position = 2;
    if (input.title !== undefined) {
      sets.push(`title = $${position++}`);
      values.push(input.title);
    }
    if (input.amountMinor !== undefined) {
      sets.push(`amount_minor = $${position++}`);
      values.push(input.amountMinor);
    }
    if (input.categoryId !== undefined) {
      sets.push(`category_id = $${position++}`);
      values.push(input.categoryId);
    }
    if (input.expenseDate !== undefined) {
      sets.push(`expense_date = $${position++}::date`);
      values.push(input.expenseDate);
    }
    sets.push('version = version + 1');

    const result = await client.query<ExpenseRow>(
      `
        WITH updated AS (
          UPDATE expenses
          SET ${sets.join(', ')}
          WHERE id = $1
          RETURNING *
        )
        SELECT
          e.id,
          e.user_id,
          e.title,
          e.amount_minor,
          e.expense_date,
          e.version,
          e.deleted_at,
          e.created_at,
          e.updated_at,
          c.id AS category_id,
          c.name AS category_name,
          c.archived_at AS category_archived_at,
          0::bigint AS total,
          0::bigint AS filtered_amount_minor,
          0::bigint AS current_month_amount_minor
        FROM updated e
        JOIN categories c ON c.id = e.category_id
      `,
      values,
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(client: PoolClient, expenseId: string): Promise<void> {
    await client.query(
      `UPDATE expenses SET deleted_at = now(), version = version + 1 WHERE id = $1`,
      [expenseId],
    );
  }

  private mapRow(row: ExpenseRow | undefined): ExpenseRecord {
    if (
      !row?.id ||
      !row.user_id ||
      !row.title ||
      row.amount_minor === null ||
      !row.expense_date ||
      row.version === null ||
      !row.created_at ||
      !row.updated_at ||
      !row.category_id ||
      !row.category_name
    ) {
      throw new Error('Complete expense row is required');
    }
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      amountMinor: parseSafeInteger(row.amount_minor, 'amount_minor'),
      expenseDate:
        row.expense_date instanceof Date
          ? row.expense_date.toISOString().slice(0, 10)
          : row.expense_date,
      version: row.version,
      deletedAt: row.deleted_at ? toIsoString(row.deleted_at) : null,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      category: {
        id: row.category_id,
        name: row.category_name,
        archivedAt: row.category_archived_at ? toIsoString(row.category_archived_at) : null,
      },
    };
  }
}
