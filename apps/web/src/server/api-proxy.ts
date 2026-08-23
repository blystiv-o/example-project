import { randomUUID } from 'node:crypto';

interface ProxyDependencies {
  fetch: typeof fetch;
}

const DEFAULT_DEPENDENCIES: ProxyDependencies = {
  fetch: globalThis.fetch,
};

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
const BODYLESS_STATUSES = new Set([204, 205, 304]);

export async function proxyApiRequest(
  request: Request,
  path: string[],
  dependencies: ProxyDependencies = DEFAULT_DEPENDENCIES,
): Promise<Response> {
  const traceId = request.headers.get('x-trace-id')?.slice(0, 128) || randomUUID();
  const method = request.method.toUpperCase();
  const upstreamUrl = new URL(
    `/api/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`,
    process.env.API_INTERNAL_URL ?? 'http://localhost:3001',
  );
  const headers = new Headers(request.headers);
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('host');
  headers.set('x-trace-id', traceId);

  try {
    const body = BODYLESS_METHODS.has(method) ? undefined : await request.arrayBuffer();
    const upstreamResponse = await dependencies.fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: request.signal,
    });
    const responseBody = await upstreamResponse.arrayBuffer();
    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.delete('connection');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');
    responseHeaders.set('x-trace-id', traceId);
    return new Response(
      method === 'HEAD' || BODYLESS_STATUSES.has(upstreamResponse.status)
        ? null
        : responseBody,
      {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      },
    );
  } catch {
    return Response.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Не вдалося з’єднатися із сервером',
          traceId,
        },
      },
      { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Trace-Id': traceId } },
    );
  }
}
