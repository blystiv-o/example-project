import { Module } from '@nestjs/common';

import { PasswordHasher } from './adapters/password-hasher';
import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRequestGuard } from './guards/auth-request.guard';
import { SessionGuard } from './guards/session.guard';
import { AuthRateLimitService } from './rate-limit.service';
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';

@Module({
  controllers: [AuthController],
  providers: [
    AuthConfig,
    AuthService,
    AuthRequestGuard,
    SessionGuard,
    AuthRateLimitService,
    PasswordHasher,
    UserRepository,
    SessionRepository,
  ],
  exports: [AuthConfig, AuthService, SessionGuard],
})
export class AuthModule {}
