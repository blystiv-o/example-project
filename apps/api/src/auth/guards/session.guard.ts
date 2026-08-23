import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '@money-tracker/shared';

import type { RequestWithTrace } from '@/common/request-context';

import { AuthService } from '../auth.service';
import { AuthError } from '../auth.error';

export interface AuthenticatedRequest extends RequestWithTrace {
  authUser: AuthUser;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.authService.authenticate(
      this.authService.readToken(request),
      request.traceId,
    );
    if (!user) {
      throw new AuthError('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED, 'Потрібна авторизація');
    }
    request.authUser = user;
    return true;
  }
}
