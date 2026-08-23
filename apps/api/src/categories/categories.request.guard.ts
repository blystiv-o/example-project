import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';

import type { RequestWithTrace } from '@/common/request-context';

import { AuthConfig } from '@/auth/auth.config';
import { AuthError } from '@/auth/auth.error';

@Injectable()
export class CategoriesRequestGuard implements CanActivate {
  constructor(@Inject(AuthConfig) private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return true;

    const origin = request.header('origin');
    const browserRequest = Boolean(request.header('sec-fetch-site'));
    if ((origin && !this.config.allowedOrigins.has(origin)) || (!origin && browserRequest)) {
      throw new AuthError('INVALID_ORIGIN', HttpStatus.FORBIDDEN, 'Недозволене джерело запиту');
    }

    if (['POST', 'PATCH'].includes(request.method) && !request.is('application/json')) {
      throw new AuthError(
        'UNSUPPORTED_MEDIA_TYPE',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'Потрібен Content-Type application/json',
      );
    }
    return true;
  }
}
