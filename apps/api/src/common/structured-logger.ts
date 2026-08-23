import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { LoggerService } from '@nestjs/common';

interface StructuredLoggerOptions {
  environment?: string;
  filePath?: string;
  service?: string;
}

type LogPayload = Record<string, unknown>;

const PROJECT_ROOT = resolve(__dirname, '../../../..');

export class StructuredLogger implements LoggerService {
  readonly filePath: string;

  private readonly environment: string;
  private readonly fileDescriptor: number;
  private readonly service: string;
  private closed = false;

  constructor(options: StructuredLoggerOptions = {}) {
    const configuredPath = options.filePath ?? process.env.LOG_FILE ?? 'logs/api.log';
    this.filePath = isAbsolute(configuredPath)
      ? configuredPath
      : resolve(PROJECT_ROOT, configuredPath);
    this.environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    this.service = options.service ?? 'money-tracker-api';

    mkdirSync(dirname(this.filePath), { recursive: true });
    this.fileDescriptor = openSync(this.filePath, 'a');
  }

  log(...parameters: unknown[]): void {
    void parameters;
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const context = this.contextFrom(optionalParams);
    const possibleStack =
      optionalParams.length > 1
        ? optionalParams[0]
        : typeof optionalParams[0] === 'string' && this.looksLikeStack(optionalParams[0])
          ? optionalParams[0]
          : undefined;
    this.write('error', message, context, {
      ...(typeof possibleStack === 'string' ? { error_stack: possibleStack } : {}),
    });
  }

  warn(...parameters: unknown[]): void {
    void parameters;
  }

  debug(...parameters: unknown[]): void {
    void parameters;
  }

  verbose(...parameters: unknown[]): void {
    void parameters;
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.error(message, ...optionalParams);
  }

  close(): void {
    if (this.closed) return;
    closeSync(this.fileDescriptor);
    this.closed = true;
  }

  private write(
    level: 'error',
    message: unknown,
    context?: string,
    extra: LogPayload = {},
  ): void {
    if (this.closed) return;
    const payload = this.toPayload(message);
    const record = {
      ...payload,
      ...extra,
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      ...(context ? { context } : {}),
    };

    writeSync(this.fileDescriptor, `${JSON.stringify(record)}\n`);
  }

  private toPayload(message: unknown): LogPayload {
    if (typeof message === 'string') {
      try {
        const parsed: unknown = JSON.parse(message);
        if (this.isRecord(parsed)) return parsed;
      } catch {
        // A regular text message remains a structured `message` field.
      }
      return { message };
    }
    if (message instanceof Error) {
      return { message: message.message, error_name: message.name, error_stack: message.stack };
    }
    if (this.isRecord(message)) return message;
    return { message: String(message) };
  }

  private isRecord(value: unknown): value is LogPayload {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private contextFrom(optionalParams: unknown[]): string | undefined {
    const last = optionalParams.at(-1);
    if (typeof last !== 'string') return undefined;
    if (optionalParams.length === 1 && this.looksLikeStack(last)) return undefined;
    return last;
  }

  private looksLikeStack(value: string): boolean {
    return value.includes('\n    at ') || /^[A-Za-z]+Error:/.test(value);
  }
}
