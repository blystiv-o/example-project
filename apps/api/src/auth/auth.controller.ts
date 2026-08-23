import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type LoginRequest,
  type RegisterRequest,
} from '@money-tracker/shared';
import type { Response } from 'express';

import type { RequestWithTrace } from '@/common/request-context';

import { AuthConfig } from './auth.config';
import { AuthError } from './auth.error';
import { AuthService, EmailAlreadyExistsError } from './auth.service';
import { AuthRequestGuard } from './guards/auth-request.guard';
import { SessionGuard, type AuthenticatedRequest } from './guards/session.guard';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('auth')
@UseGuards(AuthRequestGuard)
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    // @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
    @Inject(AuthConfig) private readonly config: AuthConfig,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) input: RegisterRequest,
    @Req() request: RequestWithTrace,
    @Res({ passthrough: true }) response: Response,
    // @Ip() ip: string,
  ): Promise<AuthResponse> {
    // Rate limiting is temporarily disabled.
    // const normalizedEmail = normalizeEmail(input.email);
    // this.rateLimit.recordRegistration(ip, normalizedEmail);
    try {
      const result = await this.authService.register(input, request.traceId);
      this.setSessionCookie(response, result.token);
      return { user: result.user };
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new AuthError(
          'EMAIL_ALREADY_EXISTS',
          HttpStatus.CONFLICT,
          'Обліковий запис із таким email уже існує',
          { email: ['Обліковий запис із таким email уже існує'] },
        );
      }
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) input: LoginRequest,
    @Req() request: RequestWithTrace,
    @Res({ passthrough: true }) response: Response,
    // @Ip() ip: string,
  ): Promise<AuthResponse> {
    // Rate limiting is temporarily disabled.
    // const normalizedEmail = normalizeEmail(input.email);
    // this.rateLimit.assertLoginAllowed(ip, normalizedEmail);
    const result = await this.authService.login(input, request.traceId);
    if (!result) {
      // this.rateLimit.recordLoginFailure(ip, normalizedEmail);
      throw new AuthError(
        'INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
        'Неправильний email або пароль',
      );
    }
    // this.rateLimit.resetLogin(ip, normalizedEmail);
    this.setSessionCookie(response, result.token);
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() request: AuthenticatedRequest): AuthResponse {
    return { user: request.authUser };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: RequestWithTrace,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.authService.readToken(request), request.traceId);
    response.cookie(this.config.cookieName, '', {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  private setSessionCookie(response: Response, token: string): void {
    response.cookie(this.config.cookieName, token, {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      path: '/',
    });
  }
}
