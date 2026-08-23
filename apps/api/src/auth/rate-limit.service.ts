import { HttpStatus, Injectable } from '@nestjs/common';

import { AuthError } from './auth.error';

interface Counter {
  count: number;
  resetsAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly counters = new Map<string, Counter>();

  assertLoginAllowed(ip: string, email: string): void {
    this.assertBelow(`login:${ip}:${email}`, 5);
  }

  recordLoginFailure(ip: string, email: string): void {
    this.increment(`login:${ip}:${email}`, 15 * 60);
  }

  resetLogin(ip: string, email: string): void {
    this.counters.delete(`login:${ip}:${email}`);
  }

  recordRegistration(ip: string, email: string): void {
    this.incrementAndAssert(`register:ip:${ip}`, 3, 60 * 60);
    try {
      this.incrementAndAssert(`register:email:${email}`, 3, 60 * 60);
    } catch (error) {
      this.decrement(`register:ip:${ip}`);
      throw error;
    }
  }

  private incrementAndAssert(key: string, limit: number, windowSeconds: number): void {
    this.assertBelow(key, limit);
    this.increment(key, windowSeconds);
  }

  private assertBelow(key: string, limit: number): void {
    const now = Date.now();
    const counter = this.counters.get(key);
    if (!counter || counter.resetsAt <= now) {
      if (counter) this.counters.delete(key);
      return;
    }
    if (counter.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((counter.resetsAt - now) / 1000));
      throw new AuthError(
        'RATE_LIMITED',
        HttpStatus.TOO_MANY_REQUESTS,
        'Забагато спроб. Спробуйте пізніше',
        undefined,
        retryAfter,
      );
    }
  }

  private increment(key: string, windowSeconds: number): void {
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.resetsAt <= now) {
      this.counters.set(key, { count: 1, resetsAt: now + windowSeconds * 1000 });
      return;
    }
    current.count += 1;
  }

  private decrement(key: string): void {
    const counter = this.counters.get(key);
    if (counter) counter.count = Math.max(0, counter.count - 1);
  }
}
