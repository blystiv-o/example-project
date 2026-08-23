import { z } from 'zod';

export const API_VERSION = 'v1' as const;

export enum Currency {
  UAH = 'UAH',
}

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('money-tracker-api'),
  version: z.literal(API_VERSION),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

const nameSchema = z
  .string({ required_error: "Вкажіть ім'я" })
  .trim()
  .min(1, "Вкажіть ім'я")
  .max(80, "Ім'я має містити не більше 80 символів");

const emailSchema = z
  .string({ required_error: 'Вкажіть email' })
  .trim()
  .min(1, 'Вкажіть email')
  .max(254, 'Email має містити не більше 254 символів')
  .email('Вкажіть коректний email');

const passwordSchema = z
  .string({ required_error: 'Вкажіть пароль' })
  .min(6, 'Пароль має містити щонайменше 6 символів')
  .max(128, 'Пароль має містити не більше 128 символів');

export const registerRequestSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    email: z.string().email().max(254),
  })
  .strict();

export type AuthUser = z.infer<typeof authUserSchema>;

export const authResponseSchema = z.object({ user: authUserSchema }).strict();

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const authErrorCodes = [
  'VALIDATION_ERROR',
  'EMAIL_ALREADY_EXISTS',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'RATE_LIMITED',
  'INVALID_ORIGIN',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL_ERROR',
] as const;

export const authErrorCodeSchema = z.enum(authErrorCodes);

export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>;

export const categoryErrorCodes = [
  'CATEGORY_NAME_ALREADY_EXISTS',
  'CATEGORY_NOT_FOUND',
  'CATEGORY_VERSION_CONFLICT',
  'VERSION_REQUIRED',
] as const;

export const categoryErrorCodeSchema = z.enum(categoryErrorCodes);

export type CategoryErrorCode = z.infer<typeof categoryErrorCodeSchema>;

export const expenseErrorCodes = [
  'EXPENSE_NOT_FOUND',
  'EXPENSE_VERSION_CONFLICT',
  'EXPENSE_VERSION_REQUIRED',
  'EXPENSE_CATEGORY_NOT_AVAILABLE',
] as const;

export const expenseErrorCodeSchema = z.enum(expenseErrorCodes);

export type ExpenseErrorCode = z.infer<typeof expenseErrorCodeSchema>;

export const apiErrorCodes = [
  ...authErrorCodes,
  ...categoryErrorCodes,
  ...expenseErrorCodes,
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().min(1),
        fields: z.record(z.array(z.string().min(1)).min(1)).optional(),
        traceId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type ApiError = z.infer<typeof apiErrorSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

const categoryNameSchema = z
  .string({ required_error: 'Вкажіть назву' })
  .transform(normalizeText)
  .refine((value) => value.length >= 1, 'Вкажіть назву')
  .refine((value) => value.length <= 80, 'Назва має містити не більше 80 символів');

const categoryTypeSchema = z
  .string({ required_error: 'Вкажіть тип' })
  .transform(normalizeText)
  .refine((value) => value.length >= 1, 'Вкажіть тип')
  .refine((value) => value.length <= 50, 'Тип має містити не більше 50 символів');

const monthlyBudgetMinorSchema = z
  .number({
    required_error: 'Вкажіть місячний бюджет',
    invalid_type_error: 'Вкажіть місячний бюджет',
  })
  .int('Бюджет має бути цілим числом копійок')
  .min(1, 'Бюджет має бути більшим за нуль')
  .max(99_999_999_999, 'Бюджет перевищує допустимий максимум');

export const createCategoryRequestSchema = z
  .object({
    name: categoryNameSchema,
    type: categoryTypeSchema,
    monthlyBudgetMinor: monthlyBudgetMinorSchema,
  })
  .strict();

export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;

export const updateCategoryRequestSchema = z
  .object({
    name: categoryNameSchema.optional(),
    type: categoryTypeSchema.optional(),
    monthlyBudgetMinor: monthlyBudgetMinorSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хоча б одне поле для оновлення',
    path: ['form'],
  });

export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

const categoryBaseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    type: z.string().min(1).max(50),
    monthlyBudgetMinor: monthlyBudgetMinorSchema,
    version: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const categorySchema = categoryBaseSchema;

export type Category = z.infer<typeof categorySchema>;

export const categoryWithBudgetUsageSchema = categoryBaseSchema
  .extend({
    spentMinor: z.number().int(),
    remainingMinor: z.number().int(),
    usagePercent: z.number().int().min(0),
  })
  .strict();

export type CategoryWithBudgetUsage = z.infer<typeof categoryWithBudgetUsageSchema>;

export const categoryPeriodSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeZone: z.string().min(1),
  })
  .strict();

export type CategoryPeriod = z.infer<typeof categoryPeriodSchema>;

export const categoryListResponseSchema = z
  .object({
    period: categoryPeriodSchema,
    categories: z.array(categoryWithBudgetUsageSchema),
    summary: z
      .object({
        activeCount: z.number().int().min(0),
        totalBudgetMinor: z.number().int().min(0),
        totalSpentMinor: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;

export const categoryResponseSchema = z.object({ category: categorySchema }).strict();

export type CategoryResponse = z.infer<typeof categoryResponseSchema>;

export function normalizeCategoryText(value: string): string {
  return normalizeText(value);
}

export function normalizeCategoryNameForLookup(value: string): string {
  return normalizeText(value).toLocaleLowerCase('uk-UA');
}

const expenseTitleSchema = z
  .string({ required_error: 'Вкажіть назву' })
  .transform(normalizeText)
  .refine((value) => value.length >= 1, 'Вкажіть назву')
  .refine((value) => value.length <= 120, 'Назва має містити не більше 120 символів');

const expenseAmountMinorSchema = z
  .number({
    required_error: 'Вкажіть суму',
    invalid_type_error: 'Вкажіть коректну суму',
  })
  .int('Сума має бути цілим числом копійок')
  .min(1, 'Сума має бути не меншою за 0,01 грн')
  .max(99_999_999_999, 'Сума має бути не більшою за 999 999 999,99 грн');

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === (month ?? 0) - 1 &&
    parsed.getUTCDate() === day
  );
}

const expenseDateSchema = z
  .string({ required_error: 'Вкажіть дату' })
  .refine(isCalendarDate, 'Вкажіть коректну дату у форматі РРРР-ММ-ДД');

export const createExpenseRequestSchema = z
  .object({
    title: expenseTitleSchema,
    amountMinor: expenseAmountMinorSchema,
    categoryId: z.string({ required_error: 'Виберіть категорію' }).uuid('Виберіть категорію'),
    expenseDate: expenseDateSchema,
  })
  .strict();

export type CreateExpenseRequest = z.infer<typeof createExpenseRequestSchema>;

export const updateExpenseRequestSchema = z
  .object({
    title: expenseTitleSchema.optional(),
    amountMinor: expenseAmountMinorSchema.optional(),
    categoryId: z.string().uuid('Виберіть категорію').optional(),
    expenseDate: expenseDateSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Передайте хоча б одне поле для оновлення',
    path: ['form'],
  });

export type UpdateExpenseRequest = z.infer<typeof updateExpenseRequestSchema>;

export const expenseListQuerySchema = z
  .object({
    query: z
      .string()
      .transform(normalizeText)
      .refine((value) => value.length <= 120)
      .optional(),
    categoryId: z.string().uuid('Виберіть категорію').optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

export const expenseCategorySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80),
    archived: z.boolean(),
  })
  .strict();

export const expenseSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(120),
    amountMinor: expenseAmountMinorSchema,
    expenseDate: expenseDateSchema,
    account: z.literal('Monobank'),
    category: expenseCategorySchema,
    version: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type Expense = z.infer<typeof expenseSchema>;

export const expenseResponseSchema = z.object({ expense: expenseSchema }).strict();

export type ExpenseResponse = z.infer<typeof expenseResponseSchema>;

export const expenseListResponseSchema = z
  .object({
    expenses: z.array(expenseSchema),
    total: z.number().int().min(0),
    pagination: z
      .object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1).max(100),
        totalPages: z.number().int().min(0),
      })
      .strict(),
    summary: z
      .object({
        filteredAmountMinor: z.number().int().min(0),
        currentMonthAmountMinor: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type ExpenseListResponse = z.infer<typeof expenseListResponseSchema>;

export enum DashboardDayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export const dashboardDayOfWeekSchema = z.nativeEnum(DashboardDayOfWeek);

export const dashboardPeriodSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    monthStartsOn: expenseDateSchema,
    monthEndsBefore: expenseDateSchema,
    weekStartsOn: expenseDateSchema,
    weekEndsBefore: expenseDateSchema,
    timeZone: z.string().min(1),
  })
  .strict();

export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;

export const dashboardWeeklyExpenseSchema = z
  .object({
    date: expenseDateSchema,
    dayOfWeek: dashboardDayOfWeekSchema,
    amountMinor: z.number().int().min(0),
  })
  .strict();

export type DashboardWeeklyExpense = z.infer<typeof dashboardWeeklyExpenseSchema>;

const dashboardSummarySchema = z
  .object({
    totalSpentMinor: z.number().int().min(0),
    totalBudgetMinor: z.number().int().min(0),
    remainingMinor: z.number().int(),
  })
  .strict();

const dashboardDayOrder = Object.values(DashboardDayOfWeek);

export const dashboardResponseSchema = z
  .object({
    period: dashboardPeriodSchema,
    summary: dashboardSummarySchema,
    weeklyExpenses: z.array(dashboardWeeklyExpenseSchema).length(7),
    recentExpenses: z.array(expenseSchema).max(4),
    categoryHighlights: z.array(categoryWithBudgetUsageSchema).max(3),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.summary.remainingMinor !==
      value.summary.totalBudgetMinor - value.summary.totalSpentMinor
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['summary', 'remainingMinor'],
        message: 'Залишок не відповідає бюджету та витратам',
      });
    }

    value.weeklyExpenses.forEach((point, index) => {
      const expectedDate = new Date(`${value.period.weekStartsOn}T00:00:00.000Z`);
      expectedDate.setUTCDate(expectedDate.getUTCDate() + index);
      if (point.date !== expectedDate.toISOString().slice(0, 10)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['weeklyExpenses', index, 'date'],
          message: 'Тижневі дати мають бути унікальними та послідовними',
        });
      }
      if (point.dayOfWeek !== dashboardDayOrder[index]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['weeklyExpenses', index, 'dayOfWeek'],
          message: 'День тижня не відповідає позиції',
        });
      }
    });
  });

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export function normalizeExpenseText(value: string): string {
  return normalizeText(value);
}
