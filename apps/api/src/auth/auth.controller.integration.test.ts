import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceMiddleware } from '@/common/trace.middleware';

import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthExceptionFilter } from './auth-exception.filter';
import { AuthService } from './auth.service';
import { AuthRequestGuard } from './guards/auth-request.guard';
import { SessionGuard } from './guards/session.guard';
import { AuthRateLimitService } from './rate-limit.service';

const user = {
  id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
  name: 'Володимир',
  email: 'user@example.com',
};

describe('AuthController integration', () => {
  let app: INestApplication;
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    authenticate: vi.fn(),
    logout: vi.fn(),
    readToken: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.register.mockResolvedValue({ user, token: 'raw-session-token' });
    authService.login.mockResolvedValue({ user, token: 'raw-session-token' });
    authService.authenticate.mockResolvedValue(user);
    authService.logout.mockResolvedValue(undefined);
    authService.readToken.mockImplementation((req: { headers: { cookie?: string } }) =>
      req.headers.cookie?.includes('raw-session-token') ? 'raw-session-token' : null,
    );

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthRequestGuard,
        SessionGuard,
        AuthRateLimitService,
        {
          provide: AuthConfig,
          useValue: {
            sessionTtlSeconds: 86_400,
            secure: true,
            cookieName: '__Host-mt_session',
            allowedOrigins: new Set(['https://money.example']),
          },
        },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();
    app = module.createNestApplication();
    const trace = new TraceMiddleware();
    app.use(trace.use.bind(trace));
    app.useGlobalFilters(new AuthExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers, sets a hardened session cookie and returns no secrets', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'https://money.example')
      .send({ name: 'Володимир', email: 'user@example.com', password: 'secret123' })
      .expect(201)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toEqual({ user });
    expect(JSON.stringify(response.body)).not.toContain('secret123');
    expect(JSON.stringify(response.body)).not.toContain('raw-session-token');
    expect(response.headers['set-cookie']?.[0]).toContain('__Host-mt_session=raw-session-token');
    expect(response.headers['set-cookie']?.[0]).toContain('Path=/');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.headers['set-cookie']?.[0]).toContain('Secure');
    expect(response.headers['set-cookie']?.[0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie']?.[0]).not.toContain('Domain=');
  });

  it('rejects unknown DTO fields and includes the matching trace ID', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://money.example')
      .set('X-Trace-Id', 'test-trace-id')
      .send({ email: 'user@example.com', password: 'secret123', admin: true })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.traceId).toBe('test-trace-id');
    expect(response.headers['x-trace-id']).toBe('test-trace-id');
  });

  it('rejects a foreign browser origin and a non-JSON body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'user@example.com', password: 'secret123' })
      .expect(403);
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://money.example')
      .set('Content-Type', 'text/plain')
      .send('email=user@example.com')
      .expect(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('requires a session for me and clears the cookie idempotently on logout', async () => {
    authService.authenticate.mockResolvedValueOnce(null);
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', '__Host-mt_session=raw-session-token')
      .expect(200);
    expect(me.body).toEqual({ user });

    const logoutResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'https://money.example')
      .expect(204);
    expect(logoutResponse.headers['set-cookie']?.[0]).toContain('Max-Age=0');
  });

  it.skip('returns 429 with Retry-After after five failed login attempts', async () => {
    authService.login.mockResolvedValue(null);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'https://money.example')
        .send({ email: 'limited@example.com', password: 'secret123' })
        .expect(401);
    }
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://money.example')
      .send({ email: 'limited@example.com', password: 'secret123' })
      .expect(429);
    expect(response.headers['retry-after']).toBeTruthy();
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });
});
