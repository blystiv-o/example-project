import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CreateExpenseRequest,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseResponse,
  UpdateExpenseRequest,
} from '@money-tracker/shared';

import { AuthError } from '@/auth/auth.error';
import { DatabaseService } from '@/database/database.service';

import { ExpensesCalendar } from './expenses.calendar';
import { ExpensesRepository } from './expenses.repository';
import type { ExpenseRecord } from './expenses.types';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ExpensesRepository) private readonly expenses: ExpensesRepository,
    @Inject(ExpensesCalendar) private readonly calendar: ExpensesCalendar,
  ) {}

  async list(
    userId: string,
    input: ExpenseListQuery,
    traceId: string,
  ): Promise<ExpenseListResponse> {
    const started = Date.now();
    try {
      const month = this.calendar.currentMonth();
      const result = await this.expenses.list(
        userId,
        input.query,
        input.categoryId,
        input.page,
        input.pageSize,
        month.startsOn,
        month.endsBefore,
      );
      this.log('expense.list.succeeded', 'success', traceId, started, userId);
      return {
        expenses: result.expenses.map((expense) => this.toExpense(expense)),
        total: result.total,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalPages: result.total === 0 ? 0 : Math.ceil(result.total / input.pageSize),
        },
        summary: {
          filteredAmountMinor: result.filteredAmountMinor,
          currentMonthAmountMinor: result.currentMonthAmountMinor,
        },
      };
    } catch (error) {
      this.log('expense.list.failed', 'failed', traceId, started, userId);
      throw error;
    }
  }

  async create(
    userId: string,
    input: CreateExpenseRequest,
    traceId: string,
  ): Promise<ExpenseResponse> {
    const started = Date.now();
    this.assertDateNotInFuture(input.expenseDate);
    try {
      const expense = await this.database.transaction(async (client) => {
        const category = await this.expenses.findCategoryForUpdate(
          client,
          userId,
          input.categoryId,
        );
        if (!category || category.archived_at) this.categoryNotAvailable();
        return this.expenses.create(client, { userId, ...input });
      });
      this.log('expense.create.succeeded', 'success', traceId, started, userId, expense.id);
      return { expense: this.toExpense(expense) };
    } catch (error) {
      this.log('expense.create.failed', 'failed', traceId, started, userId);
      throw error;
    }
  }

  async update(
    userId: string,
    expenseId: string,
    version: number,
    input: UpdateExpenseRequest,
    traceId: string,
  ): Promise<ExpenseResponse> {
    const started = Date.now();
    if (input.expenseDate !== undefined) this.assertDateNotInFuture(input.expenseDate);
    try {
      const expense = await this.database.transaction(async (client) => {
        const existing = await this.expenses.findByIdForUpdate(client, userId, expenseId);
        if (!existing || existing.deletedAt) this.notFound();
        if (existing.version !== version) this.versionConflict(traceId, userId, expenseId);

        if (input.categoryId !== undefined) {
          const category = await this.expenses.findCategoryForUpdate(
            client,
            userId,
            input.categoryId,
          );
          const keepsArchivedCategory = input.categoryId === existing.category.id;
          if (!category || (category.archived_at && !keepsArchivedCategory)) {
            this.categoryNotAvailable();
          }
        }
        return this.expenses.update(client, expenseId, input);
      });
      this.log('expense.update.succeeded', 'success', traceId, started, userId, expenseId);
      return { expense: this.toExpense(expense) };
    } catch (error) {
      this.log('expense.update.failed', 'failed', traceId, started, userId, expenseId);
      throw error;
    }
  }

  async delete(userId: string, expenseId: string, version: number, traceId: string): Promise<void> {
    const started = Date.now();
    try {
      await this.database.transaction(async (client) => {
        const existing = await this.expenses.findByIdForUpdate(client, userId, expenseId);
        if (!existing) this.notFound();
        if (existing.deletedAt) return;
        if (existing.version !== version) this.versionConflict(traceId, userId, expenseId);
        await this.expenses.delete(client, expenseId);
      });
      this.log('expense.delete.succeeded', 'success', traceId, started, userId, expenseId);
    } catch (error) {
      this.log('expense.delete.failed', 'failed', traceId, started, userId, expenseId);
      throw error;
    }
  }

  private assertDateNotInFuture(expenseDate: string): void {
    if (expenseDate > this.calendar.today()) {
      throw new AuthError('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, 'Перевірте введені дані', {
        expenseDate: ['Дата витрати не може бути в майбутньому'],
      });
    }
  }

  private toExpense(expense: ExpenseRecord) {
    return {
      id: expense.id,
      title: expense.title,
      amountMinor: expense.amountMinor,
      expenseDate: expense.expenseDate,
      account: 'Monobank' as const,
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

  private categoryNotAvailable(): never {
    throw new AuthError(
      'EXPENSE_CATEGORY_NOT_AVAILABLE',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Категорія недоступна для нових витрат',
      { categoryId: ['Виберіть активну категорію'] },
    );
  }

  private notFound(): never {
    throw new AuthError('EXPENSE_NOT_FOUND', HttpStatus.NOT_FOUND, 'Витрату не знайдено');
  }

  private versionConflict(traceId: string, userId: string, expenseId: string): never {
    this.logger.warn(
      JSON.stringify({
        trace_id: traceId,
        event: 'expense.version_conflict',
        outcome: 'rejected',
        duration_ms: 0,
        user_id: userId,
        expense_id: expenseId,
      }),
    );
    throw new AuthError(
      'EXPENSE_VERSION_CONFLICT',
      HttpStatus.CONFLICT,
      'Витрату вже змінили в іншій вкладці. Оновіть дані й повторіть спробу',
    );
  }

  private log(
    event: string,
    outcome: string,
    traceId: string,
    started: number,
    userId: string,
    expenseId?: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        trace_id: traceId,
        event,
        outcome,
        duration_ms: Date.now() - started,
        user_id: userId,
        ...(expenseId ? { expense_id: expenseId } : {}),
      }),
    );
  }
}
