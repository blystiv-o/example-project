import {
  apiErrorSchema,
  categoryListResponseSchema,
  categoryResponseSchema,
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
  type Category,
  type CategoryListResponse,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from '@money-tracker/shared';

export class CategoriesApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

async function categoriesRequest<T>(
  path: string,
  options: RequestInit,
  parser: (value: unknown) => { success: true; data: T } | { success: false },
): Promise<T> {
  const response = await fetch(`/api/v1/categories${path}`, {
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
      throw new CategoriesApiError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.fields ?? {},
      );
    }
    throw new CategoriesApiError('Не вдалося виконати запит', 'INTERNAL_ERROR');
  }

  if (response.status === 204) return undefined as T;
  const parsed = parser(await response.json());
  if (!parsed.success)
    throw new CategoriesApiError('Отримано некоректну відповідь', 'INTERNAL_ERROR');
  return parsed.data;
}

export function getCategories(): Promise<CategoryListResponse> {
  return categoriesRequest('', { method: 'GET' }, categoryListResponseSchema.safeParse);
}

export function createCategory(input: CreateCategoryRequest): Promise<{ category: Category }> {
  return categoriesRequest(
    '',
    {
      method: 'POST',
      body: JSON.stringify(createCategoryRequestSchema.parse(input)),
    },
    categoryResponseSchema.safeParse,
  );
}

export function updateCategory(
  categoryId: string,
  version: number,
  input: UpdateCategoryRequest,
): Promise<{ category: Category }> {
  return categoriesRequest(
    `/${categoryId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateCategoryRequestSchema.parse(input)),
      headers: { 'If-Match': `"${version}"` },
    },
    categoryResponseSchema.safeParse,
  );
}

export function archiveCategory(categoryId: string, version: number): Promise<void> {
  return categoriesRequest(
    `/${categoryId}`,
    {
      method: 'DELETE',
      headers: { 'If-Match': `"${version}"` },
    },
    () => ({ success: true, data: undefined }),
  );
}

export function formatMinorCurrency(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
  }).format(value / 100);
}

export function formatActiveCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} активна`;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${count} активні`;
  return `${count} активних`;
}

export function usageColor(usagePercent: number): 'primary' | 'warning' | 'error' {
  if (usagePercent >= 100) return 'error';
  if (usagePercent >= 80) return 'warning';
  return 'primary';
}

export function progressValue(usagePercent: number): number {
  return Math.max(0, Math.min(100, usagePercent));
}

export function parseBudgetInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [hryvnias, kopecks = ''] = normalized.split('.');
  const minor =
    Number.parseInt(hryvnias ?? '', 10) * 100 + Number.parseInt((kopecks ?? '').padEnd(2, '0'), 10);
  return Number.isSafeInteger(minor) ? minor : null;
}
