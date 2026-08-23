import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthConfig {
  readonly sessionTtlSeconds = this.positiveInteger('AUTH_SESSION_TTL_SECONDS', 86_400);
  readonly secure = process.env.AUTH_COOKIE_SECURE === 'true';
  readonly cookieName =
    process.env.AUTH_COOKIE_NAME ?? (this.secure ? '__Host-mt_session' : 'mt_session');
  readonly allowedOrigins = new Set(
    (process.env.AUTH_ALLOWED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  readonly trustProxy = process.env.AUTH_TRUST_PROXY === 'true';

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      if (!this.secure) throw new Error('Production requires AUTH_COOKIE_SECURE=true');
      if (this.cookieName !== '__Host-mt_session') {
        throw new Error('Production requires AUTH_COOKIE_NAME=__Host-mt_session');
      }
      if ([...this.allowedOrigins].some((origin) => !origin.startsWith('https://'))) {
        throw new Error('Production AUTH_ALLOWED_ORIGINS must contain only HTTPS origins');
      }
    }
  }

  private positiveInteger(name: string, fallback: number): number {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be positive`);
    return value;
  }
}
