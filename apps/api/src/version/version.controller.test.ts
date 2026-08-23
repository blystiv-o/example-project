import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VersionController } from './version.controller';

describe('VersionController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [VersionController],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => app.close());

  it('returns the hardcoded app version', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/version').expect(200);

    expect(response.body).toEqual({ version: 1 });
  });
});
