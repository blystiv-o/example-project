import { describe, expect, it, vi } from 'vitest';

import { proxyApiRequest } from './api-proxy';

describe('proxyApiRequest', () => {
  it('returns a traceable error when the API is unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const request = new Request('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Trace-Id': 'browser-trace' },
      body: JSON.stringify({ name: 'Тест', email: 'test@example.com', password: 'secret123' }),
    });

    const response = await proxyApiRequest(request, ['v1', 'auth', 'register'], {
      fetch: fetchMock,
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не вдалося з’єднатися із сервером',
        traceId: 'browser-trace',
      },
    });
  });

  it('forwards the trace ID and upstream response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Помилка', traceId: 'shared-trace' } },
        { status: 500 },
      ),
    );
    const request = new Request('http://localhost:3000/api/v1/dashboard', {
      headers: { 'X-Trace-Id': 'shared-trace' },
    });

    const response = await proxyApiRequest(request, ['v1', 'dashboard'], {
      fetch: fetchMock,
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Помилка', traceId: 'shared-trace' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('http://localhost:3001/api/v1/dashboard'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
    const forwardedHeaders = fetchMock.mock.calls[0]![1]!.headers as Headers;
    expect(forwardedHeaders.get('x-trace-id')).toBe('shared-trace');
  });
});
