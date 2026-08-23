import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthExceptionFilter } from '@/auth/auth-exception.filter';
import { AuthService } from '@/auth/auth.service';
import { SessionGuard } from '@/auth/guards/session.guard';
import { NoStoreInterceptor } from '@/common/no-store.interceptor';
import { TraceMiddleware } from '@/common/trace.middleware';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

const user = {
  id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
  name: 'Володимир',
  email: 'user@example.com',
};

const response = {
  period: {
    month: '2026-08',
    monthStartsOn: '2026-08-01',
    monthEndsBefore: '2026-09-01',
    weekStartsOn: '2026-08-10',
    weekEndsBefore: '2026-08-17',
    timeZone: 'Europe/Kyiv',
  },
  summary: { totalSpentMinor: 0, totalBudgetMinor: 0, remainingMinor: 0 },
  weeklyExpenses: [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ].map((dayOfWeek, index) => ({
    date: `2026-08-${10 + index}`,
    dayOfWeek,
    amountMinor: 0,
  })),
  recentExpenses: [],
  categoryHighlights: [],
};

describe('DashboardController integration', () => {
  let app: INestApplication;
  const authService = {
    authenticate: vi.fn(),
    readToken: vi.fn(),
  };
  const dashboardService = { get: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.authenticate.mockResolvedValue(user);
    authService.readToken.mockReturnValue('raw-session-token');
    dashboardService.get.mockResolvedValue(response);
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        SessionGuard,
        NoStoreInterceptor,
        { provide: AuthService, useValue: authService },
        { provide: DashboardService, useValue: dashboardService },
      ],
    }).compile();
    app = module.createNestApplication();
    const trace = new TraceMiddleware();
    app.use(trace.use.bind(trace));
    app.useGlobalFilters(new AuthExceptionFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => app.close());

  it('returns one authenticated no-store snapshot', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Cookie', 'mt_session=raw-session-token')
      .expect(200)
      .expect('Cache-Control', 'private, no-store');

    expect(result.body).toEqual(response);
    expect(dashboardService.get).toHaveBeenCalledWith(user.id, expect.any(String));
    expect(dashboardService.get).toHaveBeenCalledTimes(1);
  });

  it('rejects unauthenticated access and MVP query parameters', async () => {
    authService.authenticate.mockResolvedValueOnce(null);
    await request(app.getHttpServer()).get('/api/v1/dashboard').expect(401);

    const queryResponse = await request(app.getHttpServer())
      .get('/api/v1/dashboard?month=2026-07')
      .expect(400);
    expect(queryResponse.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Дашборд не приймає параметрів запиту',
    });
  });
});
