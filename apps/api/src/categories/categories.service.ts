import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '@money-tracker/shared';
import { normalizeCategoryNameForLookup } from '@money-tracker/shared';

import { AuthError } from '@/auth/auth.error';
import { DatabaseService } from '@/database/database.service';

import { CategoryRepository } from './categories.repository';
import { CategoriesPeriodService } from './categories.period';
import type { CategoryRecord } from './categories.types';

interface DatabaseError {
  code?: string;
  constraint?: string;
}

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(CategoryRepository) private readonly categories: CategoryRepository,
    @Inject(CategoriesPeriodService) private readonly periodService: CategoriesPeriodService,
  ) {}

  async list(userId: string, traceId: string): Promise<CategoryListResponse> {
    const started = Date.now();
    try {
      const period = this.periodService.currentMonth();
      const [categories, totalSpentMinor] = await Promise.all([
        this.categories.listActiveWithSpent(userId, period.startsOn, period.endsBefore),
        this.categories.totalSpentForPeriod(userId, period.startsOn, period.endsBefore),
      ]);
      const response = {
        period,
        categories: categories.map((category) => ({
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
        summary: {
          activeCount: categories.length,
          totalBudgetMinor: categories.reduce(
            (sum, category) => sum + category.monthlyBudgetMinor,
            0,
          ),
          totalSpentMinor,
        },
      } satisfies CategoryListResponse;
      this.log('category.list.succeeded', 'success', traceId, started, userId);
      return response;
    } catch (error) {
      this.log('category.list.failed', 'failed', traceId, started, userId);
      throw error;
    }
  }

  async create(
    userId: string,
    input: CreateCategoryRequest,
    traceId: string,
  ): Promise<CategoryResponse> {
    const started = Date.now();
    try {
      const category = await this.database.transaction(async (client) =>
        this.categories.create(client, {
          userId,
          name: input.name,
          nameNormalized: normalizeCategoryNameForLookup(input.name),
          type: input.type,
          monthlyBudgetMinor: input.monthlyBudgetMinor,
        }),
      );
      this.log('category.create.succeeded', 'success', traceId, started, userId, category.id);
      return { category: this.toCategoryResponse(category) };
    } catch (error) {
      this.log('category.create.failed', 'failed', traceId, started, userId);
      this.rethrowKnownError(error);
    }
  }

  async update(
    userId: string,
    categoryId: string,
    version: number,
    input: UpdateCategoryRequest,
    traceId: string,
  ): Promise<CategoryResponse> {
    const started = Date.now();
    try {
      const category = await this.database.transaction(async (client) => {
        const existing = await this.categories.findByIdForUpdate(client, userId, categoryId);
        if (!existing || existing.archivedAt) this.notFound();
        if (existing.version !== version) this.versionConflict(traceId, userId, categoryId);

        return this.categories.update(client, categoryId, {
          ...(input.name !== undefined
            ? {
                name: input.name,
                nameNormalized: normalizeCategoryNameForLookup(input.name),
              }
            : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.monthlyBudgetMinor !== undefined
            ? { monthlyBudgetMinor: input.monthlyBudgetMinor }
            : {}),
        });
      });
      this.log('category.update.succeeded', 'success', traceId, started, userId, category.id);
      return { category: this.toCategoryResponse(category) };
    } catch (error) {
      this.log('category.update.failed', 'failed', traceId, started, userId, categoryId);
      this.rethrowKnownError(error);
    }
  }

  async archive(
    userId: string,
    categoryId: string,
    version: number,
    traceId: string,
  ): Promise<void> {
    const started = Date.now();
    try {
      await this.database.transaction(async (client) => {
        const existing = await this.categories.findByIdForUpdate(client, userId, categoryId);
        if (!existing) this.notFound();
        if (existing.archivedAt) return;
        if (existing.version !== version) this.versionConflict(traceId, userId, categoryId);
        await this.categories.archive(client, categoryId);
      });
      this.log('category.archive.succeeded', 'success', traceId, started, userId, categoryId);
    } catch (error) {
      this.log('category.archive.failed', 'failed', traceId, started, userId, categoryId);
      this.rethrowKnownError(error);
    }
  }

  private toCategoryResponse(category: CategoryRecord) {
    return {
      id: category.id,
      name: category.name,
      type: category.type,
      monthlyBudgetMinor: category.monthlyBudgetMinor,
      version: category.version,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private rethrowKnownError(error: unknown): never {
    const databaseError = error as DatabaseError;
    if (
      databaseError.code === '23505' &&
      databaseError.constraint === 'categories_user_id_name_normalized_active_key'
    ) {
      throw new AuthError(
        'CATEGORY_NAME_ALREADY_EXISTS',
        HttpStatus.CONFLICT,
        'Активна категорія з такою назвою вже існує',
        { name: ['Виберіть іншу назву'] },
      );
    }
    throw error;
  }

  private versionConflict(traceId: string, userId: string, categoryId: string): never {
    this.logger.warn(
      JSON.stringify({
        trace_id: traceId,
        event: 'category.version_conflict',
        outcome: 'rejected',
        duration_ms: 0,
        user_id: userId,
        category_id: categoryId,
      }),
    );
    throw new AuthError(
      'CATEGORY_VERSION_CONFLICT',
      HttpStatus.CONFLICT,
      'Категорію вже змінили в іншій вкладці. Оновіть дані й повторіть спробу',
    );
  }

  private notFound(): never {
    throw new AuthError('CATEGORY_NOT_FOUND', HttpStatus.NOT_FOUND, 'Категорію не знайдено');
  }

  private log(
    event: string,
    outcome: string,
    traceId: string,
    started: number,
    userId: string,
    categoryId?: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        trace_id: traceId,
        event,
        outcome,
        duration_ms: Date.now() - started,
        user_id: userId,
        ...(categoryId ? { category_id: categoryId } : {}),
      }),
    );
  }
}
