import { randomUUID } from 'node:crypto';

import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import type { RequestWithTrace } from '@/common/request-context';
import { errorDetails } from '@/common/error-details';

import { AuthError } from './auth.error';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithTrace>();
    const response = context.getResponse<Response>();
    const isAuthError = exception instanceof AuthError;
    const isHttpError = exception instanceof HttpException;
    const status = isHttpError ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = isAuthError
      ? exception.code
      : status === HttpStatus.BAD_REQUEST
        ? 'VALIDATION_ERROR'
        : 'INTERNAL_ERROR';
    const message = isAuthError
      ? exception.message
      : status === HttpStatus.BAD_REQUEST
        ? 'Перевірте введені дані'
        : 'Не вдалося виконати запит';
    const traceId = request.traceId ?? request.header('x-trace-id')?.slice(0, 128) ?? randomUUID();
    request.errorCode = code;
    response.setHeader('X-Trace-Id', traceId);

    if (isAuthError && exception.retryAfter) {
      response.setHeader('Retry-After', exception.retryAfter.toString());
    }
    if (isAuthError && exception.code === 'RATE_LIMITED') {
      this.logger.warn(
        JSON.stringify({
          trace_id: traceId,
          event: 'auth.rate_limited',
          outcome: 'rejected',
          duration_ms: 0,
        }),
      );
    }
    if (!isHttpError) {
      this.logger.error(
        JSON.stringify({
          trace_id: traceId,
          event: 'request.failed',
          outcome: 'error',
          request: {
            method: request.method,
            path: request.path,
            route: this.route(request),
          },
          error: errorDetails(exception),
        }),
      );
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(isAuthError && exception.fields ? { fields: exception.fields } : {}),
        traceId,
      },
    });
  }

  private route(request: RequestWithTrace): string {
    const routePath: unknown = request.route?.path;
    return typeof routePath === 'string' ? `${request.baseUrl}${routePath}` : request.path;
  }
}
