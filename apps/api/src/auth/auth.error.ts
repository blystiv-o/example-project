import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@money-tracker/shared';

export class AuthError extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    status: HttpStatus,
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly retryAfter?: number,
  ) {
    super(message, status);
  }
}
