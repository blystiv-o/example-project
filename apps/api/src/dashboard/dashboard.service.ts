import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  dashboardResponseSchema,
  type DashboardResponse,
  type Expense,
} from '@money-tracker/shared';

import { DatabaseService } from '@/database/database.service';
import type { ExpenseRecord } from '@/expenses/expenses.types';

import { DashboardPeriodService } from './dashboard.period';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DashboardRepository) private readonly dashboard: DashboardRepository,
    @Inject(DashboardPeriodService) private readonly periods: DashboardPeriodService,
  ) {}

  async get(userId: string, traceId: string): Promise<DashboardResponse> {
    const started = Date.now();
    try {
      const period = this.periods.current();
      const snapshot = await this.database.readOnlySnapshot((client) =>
        this.dashboard.loadSnapshot(
          client,
          userId,
          period.monthStartsOn,
          period.monthEndsBefore,
          period.weekStartsOn,
          period.weekEndsBefore,
        ),
      );
      const response = dashboardResponseSchema.parse({
        period,
        summary: {
          totalSpentMinor: snapshot.totalSpentMinor,
          totalBudgetMinor: snapshot.totalBudgetMinor,
          remainingMinor: snapshot.totalBudgetMinor - snapshot.totalSpentMinor,
        },
        weeklyExpenses: snapshot.weeklyExpenses,
        recentExpenses: snapshot.recentExpenses.map((expense) => this.toExpense(expense)),
        categoryHighlights: snapshot.categoryHighlights.map((category) => ({
          id: category.id,
          name: category.name,
          type: category.type,
          monthlyBudgetMinor: category.monthlyBudgetMinor,
          spentMinor: category.spentMinor,
          remainingMinor: category.monthlyBudgetMinor - category.spentMinor,
          usagePercent: Math.round((category.spentMinor / category.monthlyBudgetMinor) * 100),
          version: category.version,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        })),
      });
      this.log('dashboard.view.succeeded', 'success', traceId, started, userId);
      return response;
    } catch (error) {
      this.log('dashboard.view.failed', 'failed', traceId, started, userId);
      throw error;
    }
  }

  private toExpense(expense: ExpenseRecord): Expense {
    return {
      id: expense.id,
      title: expense.title,
      amountMinor: expense.amountMinor,
      expenseDate: expense.expenseDate,
      account: 'Monobank',
      category: {
        id: expense.category.id,
        name: expense.category.name,
        archived: expense.category.archivedAt !== null,
      },
      version: expense.version,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }

  private log(
    event: string,
    outcome: string,
    traceId: string,
    started: number,
    userId: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        trace_id: traceId,
        event,
        outcome,
        duration_ms: Date.now() - started,
        user_id: userId,
      }),
    );
  }
}
