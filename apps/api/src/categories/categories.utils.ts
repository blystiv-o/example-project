import { randomUUID } from 'node:crypto';

export function parseSafeInteger(value: unknown, field: string): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Invalid ${field}: expected safe integer, received ${String(value)}`);
  }
  return parsed;
}

export function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildTraceId(): string {
  return randomUUID();
}
