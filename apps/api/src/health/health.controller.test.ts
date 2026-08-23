import { describe, expect, it } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns service health', () => {
    expect(new HealthController().getHealth()).toEqual({
      status: 'ok',
      service: 'money-tracker-api',
      version: 'v1',
    });
  });
});
