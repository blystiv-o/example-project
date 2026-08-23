import { describe, expect, it } from 'vitest';

import { AuthError } from './auth.error';
import { AuthRateLimitService } from './rate-limit.service';

describe('AuthRateLimitService', () => {
  it('blocks the sixth failed login and resets after success', () => {
    const limiter = new AuthRateLimitService();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.assertLoginAllowed('127.0.0.1', 'user@example.com');
      limiter.recordLoginFailure('127.0.0.1', 'user@example.com');
    }
    expect(() => limiter.assertLoginAllowed('127.0.0.1', 'user@example.com')).toThrow(AuthError);
    limiter.resetLogin('127.0.0.1', 'user@example.com');
    expect(() => limiter.assertLoginAllowed('127.0.0.1', 'user@example.com')).not.toThrow();
  });

  it('limits registrations independently by IP and normalized email', () => {
    const limiter = new AuthRateLimitService();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      limiter.recordRegistration('127.0.0.1', `user${attempt}@example.com`);
    }
    expect(() => limiter.recordRegistration('127.0.0.1', 'other@example.com')).toThrow(AuthError);

    const emailLimiter = new AuthRateLimitService();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      emailLimiter.recordRegistration(`127.0.0.${attempt}`, 'same@example.com');
    }
    expect(() => emailLimiter.recordRegistration('127.0.0.9', 'same@example.com')).toThrow(
      AuthError,
    );
  });
});
