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
    for (const name of files) {
      await client.query(await readFile(resolve(directory, name), 'utf8'));
    }
  } finally {
    client.release();
  }
}

databaseDescribe('categories with PostgreSQL', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let schema: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    schema = `categories_test_${randomUUID().replaceAll('-', '')}`;
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
  }, 30_000);

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await app.close();
    await adminPool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await adminPool.end();
  });

  it('creates, lists, updates and archives categories with monthly aggregation', async () => {
    const auth = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Володимир', email: 'volodymyr@example.com', password: 'secret123' })
      .expect(201);
    const cookie = auth.headers['set-cookie']?.[0];
    if (!cookie) throw new Error('Registration did not set a cookie');

    const created = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ name: '  Їжа  ', type: " Обов'язкові ", monthlyBudgetMinor: 1250000 })
      .expect(201);

    expect(created.body.category.name).toBe('Їжа');
    expect(created.body.category.type).toBe("Обов'язкові");
    expect(created.body.category.version).toBe(1);

    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ name: 'їЖА', type: 'Щоденні', monthlyBudgetMinor: 100 })
      .expect(409);

    const userId = created.body.category.id ? auth.body.user.id : null;
    if (!userId) throw new Error('User id is required');
    await adminPool.query(
      `
        INSERT INTO "${schema}".expenses (id, user_id, category_id, title, amount_minor, expense_date)
        VALUES
          ($1, $2, $3, 'Сільпо', 824000, DATE '2026-08-01'),
          ($4, $2, $3, 'Липень', 111000, DATE '2026-07-31')
      `,
      [randomUUID(), userId, created.body.category.id, randomUUID()],
    );

    const list = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Cookie', cookie)
      .expect(200);

    expect(list.body.period).toEqual({
      month: '2026-08',
      startsOn: '2026-08-01',
      endsBefore: '2026-09-01',
      timeZone: 'Europe/Kyiv',
    });
    expect(list.body.summary).toEqual({
      activeCount: 1,
      totalBudgetMinor: 1250000,
      totalSpentMinor: 824000,
    });
    expect(list.body.categories[0]).toMatchObject({
      name: 'Їжа',
      spentMinor: 824000,
      remainingMinor: 426000,
      usagePercent: 66,
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.body.category.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .set('If-Match', '"1"')
      .send({ name: 'Продукти та кафе', monthlyBudgetMinor: 1350000 })
      .expect(200);

    expect(updated.body.category.version).toBe(2);
    expect(updated.body.category.name).toBe('Продукти та кафе');

    await request(app.getHttpServer())
      .patch(`/api/v1/categories/${created.body.category.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .set('If-Match', '"1"')
      .send({ type: 'Планові' })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${created.body.category.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .set('If-Match', '"2"')
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/categories/${created.body.category.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .set('If-Match', '"1"')
      .expect(204);

    const afterArchive = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Cookie', cookie)
      .expect(200);
    expect(afterArchive.body.categories).toEqual([]);
    expect(afterArchive.body.summary.totalSpentMinor).toBe(824000);

    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ name: 'Продукти та кафе', type: 'Новий бюджет', monthlyBudgetMinor: 500000 })
      .expect(201);
  }, 30_000);

  it('rejects category endpoints without a session', async () => {
    await request(app.getHttpServer()).get('/api/v1/categories').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Їжа', type: 'Обов’язкові', monthlyBudgetMinor: 100 })
      .expect(401);
  });
});
