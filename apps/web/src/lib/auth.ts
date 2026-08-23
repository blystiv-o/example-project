import { apiErrorSchema, authResponseSchema, type AuthResponse } from '@money-tracker/shared';

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

async function authRequest(path: string, init?: RequestInit): Promise<AuthResponse | null> {
  const response = await fetch(`/api/v1/auth/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      throw new AuthApiError(
        parsed.data.error.message,
        parsed.data.error.code,
        parsed.data.error.fields,
      );
    }
    throw new AuthApiError('Не вдалося виконати запит', 'INTERNAL_ERROR');
  }
  if (response.status === 204) return null;

  const parsed = authResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new AuthApiError('Отримано некоректну відповідь', 'INTERNAL_ERROR');
  return parsed.data;
}

export function register(input: { name: string; email: string; password: string }) {
  return authRequest('register', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: { email: string; password: string }) {
  return authRequest('login', { method: 'POST', body: JSON.stringify(input) });
}

export function getCurrentUser() {
  return authRequest('me');
}

export function logout() {
  return authRequest('logout', { method: 'POST' });
}

export function safeReturnTo(value: string | null, origin = 'http://localhost'): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  try {
    const parsed = new URL(value, origin);
    return parsed.origin === origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('uk-UA') ?? '')
    .join('');
}
