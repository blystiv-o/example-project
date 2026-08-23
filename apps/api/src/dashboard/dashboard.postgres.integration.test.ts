import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module';

import { DashboardClock } from './dashboard.clock';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

async function applyMigrations(pool: Pool, schema: string): Promise<void> {
  const directory = resolve(process.cwd(), 'migrations');
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const name of files) await client.query(await readFile(resolve(directory, name), 'utf8'));
  } finally {
    client.release();
  }
}

databaseDescribe('dashboard with PostgreSQL', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let schema: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    schema = `dashboard_test_${randomUUID().replaceAll('-', '')}`;
    adminPool = new Pool({ connectionString: testDatabaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    await applyMigrations(adminPool, schema);

    const scopedUrl = new URL(testDatabaseUrl);
    scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = scopedUrl.toString();
    process.env.AUTH_COOKIE_NAME = 'mt_session';
    process.env.AUTH_COOKIE_SECURE = 'false';
    process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:3000';
    process.env.APP_TIME_ZONE = 'Europe/Kyiv';

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DashboardClock)
      .useValue({ now: () => new Date('2026-08-12T09:00:00.000Z') })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 30_000);

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await app.close();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  it('returns an isolated coherent snapshot with archived and deleted records handled', async () => {
    const firstAuth = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Перший', email: 'first@example.com', password: 'secret123' })
      .expect(201);
    const firstCookie = firstAuth.headers['set-cookie']?.[0];
    if (!firstCookie) throw new Error('Registration did not set a cookie');

    const food = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ name: 'Їжа', type: "Обов'язкові", monthlyBudgetMinor: 100000 })
      .expect(201);
    const travel = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ name: 'Подорожі', type: 'Бажані', monthlyBudgetMinor: 50000 })
      .expect(201);
    const archived = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ name: 'Старі витрати', type: 'Архів', monthlyBudgetMinor: 999000 })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${archived.body.category.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"1"')
      .expect(204);

    const secondAuth = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Другий', email: 'second@example.com', password: 'secret123' })
      .expect(201);
    const secondUserId = secondAuth.body.user.id as string;
    const secondCategoryId = randomUUID();

    await adminPool.query(
      `
        INSERT INTO "${schema}".categories
          (id, user_id, name, name_normalized, type, monthly_budget_minor)
        VALUES ($1, $2, 'Чужа', 'чужа', 'Чужий тип', 700000)
      `,
      [secondCategoryId, secondUserId],
    );
    await adminPool.query(
      `
        INSERT INTO "${schema}".expenses
          (id, user_id, category_id, title, amount_minor, expense_date, created_at, deleted_at)
        VALUES
          ($1, $2, $3, 'Початок місяця', 4000, DATE '2026-08-01', TIMESTAMPTZ '2026-08-01 08:00:00Z', NULL),
          ($4, $2, $3, 'Понеділок', 120000, DATE '2026-08-10', TIMESTAMPTZ '2026-08-10 08:00:00Z', NULL),
          ($5, $2, $6, 'Архівна', 10000, DATE '2026-08-11', TIMESTAMPTZ '2026-08-11 08:00:00Z', NULL),
          ($7, $2, $3, 'Видалена', 900000, DATE '2026-08-12', TIMESTAMPTZ '2026-08-12 08:00:00Z', now()),
          ($8, $9, $10, 'Чужа витрата', 700000, DATE '2026-08-10', now(), NULL)
      `,
      [
        randomUUID(),
        firstAuth.body.user.id,
        food.body.category.id,
        randomUUID(),
        randomUUID(),
        archived.body.category.id,
        randomUUID(),
        randomUUID(),
        secondUserId,
        secondCategoryId,
      ],
    );

    const dashboard = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Cookie', firstCookie)
      .expect(200)
      .expect('Cache-Control', 'private, no-store');

    expect(dashboard.body.period).toMatchObject({
      month: '2026-08',
      weekStartsOn: '2026-08-10',
      weekEndsBefore: '2026-08-17',
    });
    expect(dashboard.body.summary).toEqual({
      totalSpentMinor: 134000,
      totalBudgetMinor: 150000,
      remainingMinor: 16000,
    });
    expect(dashboard.body.weeklyExpenses).toHaveLength(7);
    expect(dashboard.body.weeklyExpenses.slice(0, 3)).toMatchObject([
      { date: '2026-08-10', dayOfWeek: 'MONDAY', amountMinor: 120000 },
      { date: '2026-08-11', dayOfWeek: 'TUESDAY', amountMinor: 10000 },
      { date: '2026-08-12', dayOfWeek: 'WEDNESDAY', amountMinor: 0 },
    ]);
    expect(
      dashboard.body.recentExpenses.map((expense: { title: string }) => expense.title),
    ).toEqual(['Архівна', 'Понеділок', 'Початок місяця']);
    expect(dashboard.body.recentExpenses[0].category).toMatchObject({
      name: 'Старі витрати',
      archived: true,
    });
    expect(dashboard.body.categoryHighlights).toMatchObject([
      { name: 'Їжа', spentMinor: 124000, usagePercent: 124 },
      { id: travel.body.category.id, name: 'Подорожі', spentMinor: 0, usagePercent: 0 },
    ]);
    expect(JSON.stringify(dashboard.body)).not.toContain('Чужа витрата');
    expect(JSON.stringify(dashboard.body)).not.toContain('Видалена');
  }, 30_000);
});
