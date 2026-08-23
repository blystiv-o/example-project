import 'reflect-metadata';

import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { config as loadEnv } from 'dotenv';

import { AppModule } from '@/app.module';
import { AuthConfig } from '@/auth/auth.config';
import { StructuredLogger } from '@/common/structured-logger';

async function bootstrap(): Promise<void> {
  loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
  loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const logger = new StructuredLogger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  app.setGlobalPrefix('api/v1');
  const authConfig = app.get(AuthConfig);
  app.set('trust proxy', authConfig.trustProxy);
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
