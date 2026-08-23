import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '@/app.module';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

databaseDescribe('auth with PostgreSQL', () => {
  let app: INestApplication;
  let adminPool: Pool;
  let schema: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
    adminPool = new Pool({ connectionString: testDatabaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    const migrationClient = await adminPool.connect();
    try {
      await migrationClient.query(`SET search_path TO "${schema}"`);
      await migrationClient.query(
        await readFile(resolve(process.cwd(), 'migrations/001_auth.sql'), 'utf8'),
      );
    } finally {
      migrationClient.release();
    }

    const scopedUrl = new URL(testDatabaseUrl);
    scopedUrl.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = scopedUrl.toString();
    process.env.AUTH_COOKIE_NAME = 'mt_session';
    process.env.AUTH_COOKIE_SECURE = 'false';
    process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:3000';

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

  it('runs registration, session verification and logout against migrated tables', async () => {
    const password = 'secret123';
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Володимир', email: 'Volodymyr@example.com', password })
      .expect(201);
    const registrationCookies = registration.headers['set-cookie'];
    if (!registrationCookies?.[0]) throw new Error('Registration did not set a cookie');
    const cookie = registrationCookies[0];

    const users = await adminPool.query<{
      email_normalized: string;
      password_hash: string;
    }>(`SELECT email_normalized, password_hash FROM "${schema}".users`);
    expect(users.rows[0]?.email_normalized).toBe('volodymyr@example.com');
    expect(users.rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
    expect(users.rows[0]?.password_hash).not.toContain(password);

    const sessions = await adminPool.query<{ token_hash: string }>(
      `SELECT token_hash FROM "${schema}".sessions`,
    );
    expect(sessions.rows[0]?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(cookie).not.toContain(sessions.rows[0]?.token_hash);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ name: 'Інший', email: 'volodymyr@EXAMPLE.com', password })
      .expect(409);

    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookie)
      .expect(204);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  }, 30_000);

  it('uses one error for unknown email and wrong password and rejects expired sessions', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'missing@example.com', password: 'secret123' })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'Volodymyr@example.com', password: 'wrong-password' })
      .expect(401);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'volodymyr@example.com', password: 'secret123' })
      .expect(200);
    const loginCookies = login.headers['set-cookie'];
    if (!loginCookies?.[0]) throw new Error('Login did not set a cookie');
    const cookie = loginCookies[0];
    await adminPool.query(
      `UPDATE "${schema}".sessions SET expires_at = now() - interval '1 second'`,
    );
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  }, 30_000);
});
