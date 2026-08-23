import { Inject, Injectable } from '@nestjs/common';

import { CategoriesClock } from './categories.clock';
import { CategoriesConfig } from './categories.config';
import type { CategoryPeriod } from './categories.types';

function extractYearMonth(now: Date, timeZone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  return { year, month };
}

function toDatePart(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}

@Injectable()
export class CategoriesPeriodService {
  constructor(
    @Inject(CategoriesClock) private readonly clock: CategoriesClock,
    @Inject(CategoriesConfig) private readonly config: CategoriesConfig,
  ) {}

  currentMonth(): CategoryPeriod {
    const { year, month } = extractYearMonth(this.clock.now(), this.config.timeZone);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;

    return {
      month: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`,
      startsOn: toDatePart(year, month, 1),
      endsBefore: toDatePart(nextYear, nextMonth, 1),
      timeZone: this.config.timeZone,
    };
  }
}
