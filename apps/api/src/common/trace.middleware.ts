import { randomUUID } from 'node:crypto';

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';

import type { RequestWithTrace } from './request-context';

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TraceMiddleware.name);

  use(request: RequestWithTrace, response: Response, next: NextFunction): void {
    const started = process.hrtime.bigint();
    request.traceId = request.header('x-trace-id')?.slice(0, 128) || randomUUID();
    response.setHeader('X-Trace-Id', request.traceId);
    if (request.originalUrl.startsWith('/api/v1/auth')) {
      response.setHeader('Cache-Control', 'no-store');
    }

    let completed = false;
    const logCanonicalLine = (aborted: boolean): void => {
      if (completed) return;
      completed = true;
      const statusCode = response.statusCode;
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const route = this.route(request);
      const contentLength = Number(response.getHeader('content-length'));
      const outcome = aborted
        ? 'aborted'
        : statusCode >= 500
          ? 'server_error'
          : statusCode >= 400
            ? 'client_error'
            : 'success';
      const record = JSON.stringify({
        log_type: 'canonical',
        event: 'http.request.completed',
        trace_id: request.traceId,
        outcome,
        duration_ms: Math.round(durationMs * 100) / 100,
        http: {
          method: request.method,
          path: request.path,
          route,
          status_code: statusCode,
          version: request.httpVersion,
          ...(Number.isFinite(contentLength) ? { response_size_bytes: contentLength } : {}),
        },
        ...(request.authUser ? { user_id: request.authUser.id } : {}),
        ...(request.errorCode ? { error_code: request.errorCode } : {}),
      });

      if (statusCode >= 500 || aborted) this.logger.error(record);
      else if (statusCode >= 400) this.logger.warn(record);
      else this.logger.log(record);
    };

    response.once('finish', () => logCanonicalLine(false));
    response.once('close', () => logCanonicalLine(!response.writableFinished));
    next();
  }

  private route(request: RequestWithTrace): string {
    const routePath: unknown = request.route?.path;
    if (typeof routePath === 'string') return `${request.baseUrl}${routePath}`;
    return request.path;
  }
}
