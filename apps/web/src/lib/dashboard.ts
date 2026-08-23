import {
  apiErrorSchema,
  dashboardResponseSchema,
  type DashboardResponse,
} from '@money-tracker/shared';

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function getDashboard(signal?: AbortSignal): Promise<DashboardResponse> {
  const response = await fetch('/api/v1/dashboard', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      throw new DashboardApiError(parsed.data.error.message, parsed.data.error.code);
    }
    throw new DashboardApiError('Не вдалося виконати запит', 'INTERNAL_ERROR');
  }
  const parsed = dashboardResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DashboardApiError('Отримано некоректну відповідь', 'INTERNAL_ERROR');
  }
  return parsed.data;
}

export function formatDashboardMonth(month: string): string {
  const formatted = new Intl.DateTimeFormat('uk-UA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00.000Z`));
  return formatted.charAt(0).toLocaleUpperCase('uk-UA') + formatted.slice(1);
}

export function formatDashboardDay(value: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}
