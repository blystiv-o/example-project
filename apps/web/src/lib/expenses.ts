import {
  apiErrorSchema,
  createExpenseRequestSchema,
  expenseListResponseSchema,
  expenseResponseSchema,
  updateExpenseRequestSchema,
  type CreateExpenseRequest,
  type Expense,
  type ExpenseListResponse,
  type UpdateExpenseRequest,
} from '@money-tracker/shared';

export interface ExpenseFilters {
  query?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}

export class ExpensesApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

async function expensesRequest<T>(
  path: string,
  options: RequestInit,
  parser: (value: unknown) => { success: true; data: T } | { success: false },
): Promise<T> {
  const response = await fetch(`/api/v1/expenses${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.method && options.method !== 'GET' && options.method !== 'DELETE'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      throw new ExpensesApiError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.fields ?? {},
      );
    }
    throw new ExpensesApiError('Не вдалося виконати запит', 'INTERNAL_ERROR');
  }
  if (response.status === 204) return undefined as T;
  const parsed = parser(await response.json());
  if (!parsed.success) {
    throw new ExpensesApiError('Отримано некоректну відповідь', 'INTERNAL_ERROR');
  }
  return parsed.data;
}

export function getExpenses(filters: ExpenseFilters = {}): Promise<ExpenseListResponse> {
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set('query', filters.query.trim());
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 20));
  return expensesRequest(
    `?${params.toString()}`,
    { method: 'GET' },
    expenseListResponseSchema.safeParse,
  );
}

export function createExpense(input: CreateExpenseRequest): Promise<{ expense: Expense }> {
  return expensesRequest(
    '',
    { method: 'POST', body: JSON.stringify(createExpenseRequestSchema.parse(input)) },
    expenseResponseSchema.safeParse,
  );
}

export function updateExpense(
  expenseId: string,
  version: number,
  input: UpdateExpenseRequest,
): Promise<{ expense: Expense }> {
  return expensesRequest(
    `/${expenseId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateExpenseRequestSchema.parse(input)),
      headers: { 'If-Match': `"${version}"` },
    },
    expenseResponseSchema.safeParse,
  );
}

export function deleteExpense(expenseId: string, version: number): Promise<void> {
  return expensesRequest(
    `/${expenseId}`,
    { method: 'DELETE', headers: { 'If-Match': `"${version}"` } },
    () => ({ success: true, data: undefined }),
  );
}

export function parseAmountInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [hryvnias = '', kopecks = ''] = normalized.split('.');
  const minor = Number(hryvnias) * 100 + Number(kopecks.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function amountToInput(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2).replace('.', ',');
}

export function currentDateInKyiv(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatExpenseDate(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
