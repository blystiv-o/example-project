import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { StructuredLogger } from './structured-logger';

describe('StructuredLogger', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('does not write non-error levels', () => {
    const directory = mkdtempSync(join(tmpdir(), 'money-tracker-logger-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'nested', 'api.log');
    const logger = new StructuredLogger({
      filePath,
      service: 'test-api',
      environment: 'test',
    });

    logger.log(
      JSON.stringify({
        event: 'http.request.completed',
        trace_id: 'trace-1',
        outcome: 'success',
      }),
      'TraceMiddleware',
    );
    logger.warn('Expected client error', 'TraceMiddleware');
    logger.debug('Debug message', 'TraceMiddleware');
    logger.close();

    expect(readFileSync(filePath, 'utf8')).toBe('');
  });

  it('writes only error messages and keeps stacks structured', () => {
    const directory = mkdtempSync(join(tmpdir(), 'money-tracker-logger-'));
    temporaryDirectories.push(directory);
    const filePath = join(directory, 'api.log');
    const logger = new StructuredLogger({ filePath });

    logger.log('Application started', 'NestApplication');
    logger.error('Database failed', 'Error: connection refused', 'DatabaseService');
    logger.close();

    const records = readFileSync(filePath, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      level: 'error',
      context: 'DatabaseService',
      message: 'Database failed',
      error_stack: 'Error: connection refused',
    });
  });
});
