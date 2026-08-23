import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module';

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

function kyivToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

databaseDescribe('expenses with PostgreSQL', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let schema: string;
  let firstCookie: string;
  let secondCookie: string;
  let foodId: string;
  let transportId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    schema = `expenses_test_${randomUUID().replaceAll('-', '')}`;
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

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const firstAuth = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Перший', email: 'expenses-first@example.com', password: 'secret123' })
      .expect(201);
    const secondAuth = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Другий', email: 'expenses-second@example.com', password: 'secret123' })
      .expect(201);
    firstCookie = firstAuth.headers['set-cookie']?.[0] ?? '';
    secondCookie = secondAuth.headers['set-cookie']?.[0] ?? '';

    const food = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ name: 'Їжа', type: 'Обов’язкові', monthlyBudgetMinor: 100000 })
      .expect(201);
    const transport = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ name: 'Транспорт', type: 'Щоденні', monthlyBudgetMinor: 50000 })
      .expect(201);
    foodId = food.body.category.id;
    transportId = transport.body.category.id;
  }, 30_000);

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await app.close();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  it('creates, searches, combines filters and paginates newest expenses first', async () => {
    const date = kyivToday();
    const first = await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({
        title: '  Кава   з командою ',
        amountMinor: 1,
        categoryId: foodId,
        expenseDate: date,
      })
      .expect(201)
      .expect('Cache-Control', 'private, no-store');
    expect(first.body.expense).toMatchObject({
      title: 'Кава з командою',
      amountMinor: 1,
      account: 'Monobank',
      version: 1,
    });

    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({
        title: 'Кава в метро',
        amountMinor: 4200,
        categoryId: transportId,
        expenseDate: date,
      })
      .expect(201);
    const maximum = await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({
        title: 'Велика покупка',
        amountMinor: 99_999_999_999,
        categoryId: foodId,
        expenseDate: date,
      })
      .expect(201);

    const combined = await request(app.getHttpServer())
      .get('/api/v1/expenses')
      .query({ query: 'кАвА', categoryId: foodId, page: 1, pageSize: 1 })
      .set('Cookie', firstCookie)
      .expect(200);
    expect(combined.body.total).toBe(1);
    expect(combined.body.expenses[0].id).toBe(first.body.expense.id);
    expect(combined.body.pagination).toEqual({ page: 1, pageSize: 1, totalPages: 1 });

    const page = await request(app.getHttpServer())
      .get('/api/v1/expenses?page=1&pageSize=2')
      .set('Cookie', firstCookie)
      .expect(200);
    expect(page.body.total).toBe(3);
    expect(page.body.expenses).toHaveLength(2);
    expect(page.body.expenses[0].id).toBe(maximum.body.expense.id);
    expect(page.body.summary.currentMonthAmountMinor).toBe(100_000_004_200);
  }, 30_000);

  it('rejects invalid inputs, future dates and categories belonging to another user', async () => {
    const tomorrow = new Date(`${kyivToday()}T12:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const futureDate = tomorrow.toISOString().slice(0, 10);

    const invalid = await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ title: '', amountMinor: 0, categoryId: foodId, expenseDate: futureDate, extra: true })
      .expect(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const future = await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ title: 'Завтра', amountMinor: 100, categoryId: foodId, expenseDate: futureDate })
      .expect(400);
    expect(future.body.error.fields.expenseDate).toBeTruthy();

    const foreignCategory = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', secondCookie)
      .send({ name: 'Чужа', type: 'Інше', monthlyBudgetMinor: 1000 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({
        title: 'Чужий зв’язок',
        amountMinor: 100,
        categoryId: foreignCategory.body.category.id,
        expenseDate: kyivToday(),
      })
      .expect(422);
  }, 30_000);

  it('protects updates with ownership and optimistic locking', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ title: 'Сільпо', amountMinor: 10000, categoryId: foodId, expenseDate: kyivToday() })
      .expect(201);
    const id = created.body.expense.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', secondCookie)
      .set('If-Match', '"1"')
      .send({ title: 'Чуже редагування' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ title: 'Без версії' })
      .expect(428);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"1"')
      .send({ title: 'Сільпо ввечері', amountMinor: 12500 })
      .expect(200);
    expect(updated.body.expense.version).toBe(2);
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"1"')
      .send({ amountMinor: 13000 })
      .expect(409);
  }, 30_000);

  it('keeps an archived category visible and makes repeated deletion idempotent', async () => {
    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({ name: 'Тимчасова', type: 'Інше', monthlyBudgetMinor: 10000 })
      .expect(201);
    const created = await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({
        title: 'Старий запис',
        amountMinor: 500,
        categoryId: category.body.category.id,
        expenseDate: kyivToday(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${category.body.category.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"1"')
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .send({
        title: 'Не можна',
        amountMinor: 500,
        categoryId: category.body.category.id,
        expenseDate: kyivToday(),
      })
      .expect(422);
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.body.expense.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"1"')
      .send({ title: 'Старий запис оновлено', categoryId: category.body.category.id })
      .expect(200);
    expect(updated.body.expense.category.archived).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.body.expense.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"2"')
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.body.expense.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', firstCookie)
      .set('If-Match', '"2"')
      .expect(204);
  }, 30_000);

  it('requires authentication for every expense endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/expenses').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/expenses')
      .set('Origin', 'http://localhost:3000')
      .send({ title: 'Без сесії', amountMinor: 100, categoryId: foodId, expenseDate: kyivToday() })
      .expect(401);
  });
});
