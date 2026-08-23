import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { DashboardResponse } from '@money-tracker/shared';

import { AuthError } from '@/auth/auth.error';
import { SessionGuard, type AuthenticatedRequest } from '@/auth/guards/session.guard';
import { NoStoreInterceptor } from '@/common/no-store.interceptor';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(SessionGuard)
@UseInterceptors(NoStoreInterceptor)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ): Promise<DashboardResponse> {
    if (Object.keys(query).length > 0) {
      throw new AuthError(
        'VALIDATION_ERROR',
        HttpStatus.BAD_REQUEST,
        'Дашборд не приймає параметрів запиту',
      );
    }
    return this.dashboard.get(request.authUser.id, request.traceId);
  }
}
