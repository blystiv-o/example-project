import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';

import type { RequestWithTrace } from '@/common/request-context';

import { AuthConfig } from '../auth.config';
import { AuthError } from '../auth.error';

@Injectable()
export class AuthRequestGuard implements CanActivate {
  constructor(@Inject(AuthConfig) private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    if (request.method !== 'POST') return true;

    const origin = request.header('origin');
    const browserRequest = Boolean(request.header('sec-fetch-site'));
    if ((origin && !this.config.allowedOrigins.has(origin)) || (!origin && browserRequest)) {
      throw new AuthError('INVALID_ORIGIN', HttpStatus.FORBIDDEN, 'Недозволене джерело запиту');
    }

    if (!request.path.endsWith('/logout') && !request.is('application/json')) {
      throw new AuthError(
        'UNSUPPORTED_MEDIA_TYPE',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'Потрібен Content-Type application/json',
      );
    }
    return true;
  }
}
