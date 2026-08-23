import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { AuthError } from './auth.error';

@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodTypeAny> implements PipeTransform<
  unknown,
  z.infer<TSchema>
> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.infer<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? 'form');
      (fields[field] ??= []).push(issue.message);
    }
    throw new AuthError(
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
      'Перевірте введені дані',
      fields,
    );
  }
}
