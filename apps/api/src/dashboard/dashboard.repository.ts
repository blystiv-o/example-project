import { Injectable } from '@nestjs/common';
import { DashboardDayOfWeek } from '@money-tracker/shared';
import type { PoolClient } from 'pg';

import { parseSafeInteger, toIsoString } from '@/categories/categories.utils';
import type { CategoryWithSpentRecord } from '@/categories/categories.types';
import type { ExpenseRecord } from '@/expenses/expenses.types';

import type { DashboardSnapshot } from './dashboard.types';

interface SummaryRow {
  total_spent_minor: string | number;
  total_budget_minor: string | number;
}

interface WeeklyRow {
  expense_date: Date | string;
  amount_minor: string | number;
}

interface ExpenseRow {
  id: string;
  user_id: string;
  title: string;
  amount_minor: string | number;
  expense_date: Date | string;
  version: number;
  deleted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  category_id: string;
  category_name: string;
  category_archived_at: Date | string | null;
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
  spent_minor: string | number;
}

const days = Object.values(DashboardDayOfWeek);

function calendarDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

@Injectable()
export class DashboardRepository {
  async loadSnapshot(
    client: PoolClient,
    userId: string,
    monthStartsOn: string,
    monthEndsBefore: string,
    weekStartsOn: string,
    weekEndsBefore: string,
  ): Promise<DashboardSnapshot> {
    const summaryResult = await client.query<SummaryRow>(
      `
        SELECT
          (
            SELECT COALESCE(SUM(e.amount_minor), 0)::bigint
            FROM expenses e
            WHERE e.user_id = $1
              AND e.deleted_at IS NULL
              AND e.expense_date >= $2::date
              AND e.expense_date < $3::date
          ) AS total_spent_minor,
          (
            SELECT COALESCE(SUM(c.monthly_budget_minor), 0)::bigint
            FROM categories c
            WHERE c.user_id = $1
              AND c.archived_at IS NULL
          ) AS total_budget_minor
      `,
      [userId, monthStartsOn, monthEndsBefore],
    );

    const weeklyResult = await client.query<WeeklyRow>(
      `
        WITH days AS (
          SELECT generate_series($2::date, $3::date - 1, interval '1 day')::date AS expense_date
        ), spending AS (
          SELECT e.expense_date, SUM(e.amount_minor)::bigint AS amount_minor
          FROM expenses e
          WHERE e.user_id = $1
            AND e.deleted_at IS NULL
            AND e.expense_date >= $2::date
            AND e.expense_date < $3::date
          GROUP BY e.expense_date
        )
        SELECT days.expense_date, COALESCE(spending.amount_minor, 0)::bigint AS amount_minor
        FROM days
        LEFT JOIN spending USING (expense_date)
        ORDER BY days.expense_date
      `,
      [userId, weekStartsOn, weekEndsBefore],
    );

    const recentResult = await client.query<ExpenseRow>(
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
          c.archived_at AS category_archived_at
        FROM expenses e
        JOIN categories c ON c.id = e.category_id AND c.user_id = e.user_id
        WHERE e.user_id = $1
          AND e.deleted_at IS NULL
        ORDER BY e.expense_date DESC, e.created_at DESC, e.id DESC
        LIMIT 4
      `,
      [userId],
    );

    const highlightsResult = await client.query<CategoryRow>(
      `
        WITH spending AS (
          SELECT e.category_id, SUM(e.amount_minor)::bigint AS spent_minor
          FROM expenses e
          WHERE e.user_id = $1
            AND e.deleted_at IS NULL
            AND e.expense_date >= $2::date
            AND e.expense_date < $3::date
          GROUP BY e.category_id
        )
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
          COALESCE(spending.spent_minor, 0)::bigint AS spent_minor
        FROM categories c
        LEFT JOIN spending ON spending.category_id = c.id
        WHERE c.user_id = $1
          AND c.archived_at IS NULL
        ORDER BY
          ROUND(COALESCE(spending.spent_minor, 0)::numeric * 100 / c.monthly_budget_minor) DESC,
          COALESCE(spending.spent_minor, 0) DESC,
          c.name ASC,
          c.id ASC
        LIMIT 3
      `,
      [userId, monthStartsOn, monthEndsBefore],
    );

    const summary = summaryResult.rows[0];
    if (!summary) throw new Error('Dashboard summary is required');

    return {
      totalSpentMinor: parseSafeInteger(summary.total_spent_minor, 'total_spent_minor'),
      totalBudgetMinor: parseSafeInteger(summary.total_budget_minor, 'total_budget_minor'),
      weeklyExpenses: weeklyResult.rows.map((row, index) => ({
        date: calendarDate(row.expense_date),
        dayOfWeek: days[index] ?? DashboardDayOfWeek.MONDAY,
        amountMinor: parseSafeInteger(row.amount_minor, 'amount_minor'),
      })),
      recentExpenses: recentResult.rows.map((row) => this.mapExpense(row)),
      categoryHighlights: highlightsResult.rows.map((row) => this.mapCategory(row)),
    };
  }

  private mapExpense(row: ExpenseRow): ExpenseRecord {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      amountMinor: parseSafeInteger(row.amount_minor, 'amount_minor'),
      expenseDate: calendarDate(row.expense_date),
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

  private mapCategory(row: CategoryRow): CategoryWithSpentRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      monthlyBudgetMinor: parseSafeInteger(row.monthly_budget_minor, 'monthly_budget_minor'),
      spentMinor: parseSafeInteger(row.spent_minor, 'spent_minor'),
      version: row.version,
      archivedAt: row.archived_at ? toIsoString(row.archived_at) : null,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }
}
