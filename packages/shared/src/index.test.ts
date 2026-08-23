import { describe, expect, it } from 'vitest';

import {
  API_VERSION,
  Currency,
  DashboardDayOfWeek,
  apiErrorSchema,
  authResponseSchema,
  categoryListResponseSchema,
  categoryResponseSchema,
  createCategoryRequestSchema,
  createExpenseRequestSchema,
  dashboardResponseSchema,
  expenseListQuerySchema,
  expenseListResponseSchema,
  healthResponseSchema,
  loginRequestSchema,
  normalizeCategoryNameForLookup,
  normalizeCategoryText,
  normalizeEmail,
  registerRequestSchema,
  updateCategoryRequestSchema,
  updateExpenseRequestSchema,
} from './index';

describe('shared contracts', () => {
  it('validates a health response and exports common values', () => {
    expect(
      healthResponseSchema.parse({
        status: 'ok',
        service: 'money-tracker-api',
        version: API_VERSION,
      }),
    ).toEqual({ status: 'ok', service: 'money-tracker-api', version: 'v1' });
    expect(Currency.UAH).toBe('UAH');
  });
});

describe('auth contracts', () => {
  it('normalizes name and email without changing the password', () => {
    expect(
      registerRequestSchema.parse({
        name: '  Володимир  ',
        email: '  Volodymyr@Example.com ',
        password: ' secret ',
      }),
    ).toEqual({
      name: 'Володимир',
      email: 'Volodymyr@Example.com',
      password: ' secret ',
    });
    expect(normalizeEmail(' Volodymyr@Example.com ')).toBe('volodymyr@example.com');
  });

  it('accepts field boundaries', () => {
    expect(
      registerRequestSchema.safeParse({
        name: 'а'.repeat(80),
        email: `${'a'.repeat(242)}@example.com`,
        password: 'p'.repeat(128),
      }).success,
    ).toBe(true);
    expect(
      loginRequestSchema.safeParse({ email: 'user@example.com', password: '123456' }).success,
    ).toBe(true);
  });

  it.each([
    { name: '', email: 'user@example.com', password: '123456' },
    { name: 'а'.repeat(81), email: 'user@example.com', password: '123456' },
    { name: 'User', email: 'not-an-email', password: '123456' },
    { name: 'User', email: 'user@example.com', password: '12345' },
    { name: 'User', email: 'user@example.com', password: 'p'.repeat(129) },
  ])('rejects invalid registration data %#', (input) => {
    expect(registerRequestSchema.safeParse(input).success).toBe(false);
  });

  it('rejects unknown DTO fields', () => {
    expect(
      loginRequestSchema.safeParse({
        email: 'user@example.com',
        password: '123456',
        role: 'admin',
      }).success,
    ).toBe(false);
  });

  it('validates safe auth responses and API errors', () => {
    const response = {
      user: {
        id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
        name: 'Володимир',
        email: 'volodymyr@example.com',
      },
    };
    expect(authResponseSchema.parse(response)).toEqual(response);
    expect(
      apiErrorSchema.safeParse({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Перевірте введені дані',
          fields: { email: ['Вкажіть коректний email'] },
          traceId: 'trace-id',
        },
      }).success,
    ).toBe(true);
  });
});

describe('category contracts', () => {
  it('normalizes category text consistently for create and update', () => {
    expect(
      createCategoryRequestSchema.parse({
        name: '  Їжа   та   кафе  ',
        type: '  Обовʼязкові   витрати ',
        monthlyBudgetMinor: 1250000,
      }),
    ).toEqual({
      name: 'Їжа та кафе',
      type: 'Обовʼязкові витрати',
      monthlyBudgetMinor: 1250000,
    });
    expect(normalizeCategoryText('  Дім\t\tі  побут ')).toBe('Дім і побут');
    expect(normalizeCategoryNameForLookup('  ЇЖА  ')).toBe('їжа');
  });

  it('requires at least one update field and rejects unknown properties', () => {
    expect(updateCategoryRequestSchema.safeParse({}).success).toBe(false);
    expect(
      updateCategoryRequestSchema.safeParse({ name: 'Їжа', spentMinor: 100 } as object).success,
    ).toBe(false);
  });

  it('validates category list and mutation responses', () => {
    const category = {
      id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
      name: 'Їжа',
      type: "Обов'язкові",
      monthlyBudgetMinor: 1250000,
      version: 1,
      createdAt: '2026-08-01T08:30:00.000Z',
      updatedAt: '2026-08-01T08:30:00.000Z',
    };

    expect(categoryResponseSchema.parse({ category })).toEqual({ category });
    expect(
      categoryListResponseSchema.parse({
        period: {
          month: '2026-08',
          startsOn: '2026-08-01',
          endsBefore: '2026-09-01',
          timeZone: 'Europe/Kyiv',
        },
        categories: [
          {
            ...category,
            spentMinor: 824000,
            remainingMinor: 426000,
            usagePercent: 66,
          },
        ],
        summary: {
          activeCount: 1,
          totalBudgetMinor: 1250000,
          totalSpentMinor: 824000,
        },
      }),
    ).toBeTruthy();
  });
});

describe('expense contracts', () => {
  it('normalizes titles and accepts the amount boundaries', () => {
    expect(
      createExpenseRequestSchema.parse({
        title: '  Кава   з  командою ',
        amountMinor: 1,
        categoryId: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
        expenseDate: '2026-08-11',
      }),
    ).toEqual({
      title: 'Кава з командою',
      amountMinor: 1,
      categoryId: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
      expenseDate: '2026-08-11',
    });
    expect(
      createExpenseRequestSchema.safeParse({
        title: 'Максимум',
        amountMinor: 99_999_999_999,
        categoryId: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
        expenseDate: '2026-08-11',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid dates, amounts, empty updates and unknown fields', () => {
    const base = {
      title: 'Кава',
      categoryId: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
      expenseDate: '2026-02-29',
    };
    expect(createExpenseRequestSchema.safeParse({ ...base, amountMinor: 0 }).success).toBe(false);
    expect(
      createExpenseRequestSchema.safeParse({
        ...base,
        expenseDate: '2026-08-11',
        amountMinor: 99_999_999_999,
        account: 'Готівка',
      }).success,
    ).toBe(false);
    expect(updateExpenseRequestSchema.safeParse({}).success).toBe(false);
  });

  it('parses pagination defaults and validates a list response', () => {
    expect(expenseListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(expenseListQuerySchema.parse({ page: '2', pageSize: '10' })).toMatchObject({
      page: 2,
      pageSize: 10,
    });
    expect(
      expenseListResponseSchema.safeParse({
        expenses: [],
        total: 0,
        pagination: { page: 1, pageSize: 20, totalPages: 0 },
        summary: { filteredAmountMinor: 0, currentMonthAmountMinor: 0 },
      }).success,
    ).toBe(true);
  });
});

describe('dashboard contracts', () => {
  const response = {
    period: {
      month: '2026-08',
      monthStartsOn: '2026-08-01',
      monthEndsBefore: '2026-09-01',
      weekStartsOn: '2026-08-10',
      weekEndsBefore: '2026-08-17',
      timeZone: 'Europe/Kyiv',
    },
    summary: {
      totalSpentMinor: 126000,
      totalBudgetMinor: 500000,
      remainingMinor: 374000,
    },
    weeklyExpenses: Object.values(DashboardDayOfWeek).map((dayOfWeek, index) => ({
      date: `2026-08-${String(10 + index).padStart(2, '0')}`,
      dayOfWeek,
      amountMinor: index === 0 ? 126000 : 0,
    })),
    recentExpenses: [
      {
        id: 'c16bbc82-6158-48f3-8719-803e8fb8c217',
        title: 'Сільпо',
        amountMinor: 126000,
        expenseDate: '2026-08-10',
        account: 'Monobank' as const,
        category: {
          id: '44638959-f635-4d85-a273-9351c60c7829',
          name: 'Їжа',
          archived: false,
        },
        version: 1,
        createdAt: '2026-08-10T08:30:00.000Z',
        updatedAt: '2026-08-10T08:30:00.000Z',
      },
    ],
    categoryHighlights: [
      {
        id: '44638959-f635-4d85-a273-9351c60c7829',
        name: 'Їжа',
        type: "Обов'язкові",
        monthlyBudgetMinor: 500000,
        spentMinor: 126000,
        remainingMinor: 374000,
        usagePercent: 25,
        version: 1,
        createdAt: '2026-08-01T08:30:00.000Z',
        updatedAt: '2026-08-01T08:30:00.000Z',
      },
    ],
  };

  it('validates a complete coherent dashboard snapshot', () => {
    expect(dashboardResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects incoherent totals and a non-sequential seven-day series', () => {
    expect(
      dashboardResponseSchema.safeParse({
        ...response,
        summary: { ...response.summary, remainingMinor: 1 },
      }).success,
    ).toBe(false);
    expect(
      dashboardResponseSchema.safeParse({
        ...response,
        weeklyExpenses: response.weeklyExpenses.map((point, index) =>
          index === 3 ? { ...point, date: '2026-08-12' } : point,
        ),
      }).success,
    ).toBe(false);
  });

  it('enforces recent-expense and category-highlight limits', () => {
    expect(
      dashboardResponseSchema.safeParse({
        ...response,
        recentExpenses: Array.from({ length: 5 }, (_, index) => ({
          ...response.recentExpenses[0],
          id: `c16bbc82-6158-48f3-8719-803e8fb8c21${index}`,
        })),
      }).success,
    ).toBe(false);
    expect(
      dashboardResponseSchema.safeParse({
        ...response,
        categoryHighlights: Array.from({ length: 4 }, () => response.categoryHighlights[0]),
      }).success,
    ).toBe(false);
  });
});
