import { Inject, Injectable } from '@nestjs/common';
import type { DashboardPeriod } from '@money-tracker/shared';

import { DashboardClock } from './dashboard.clock';
import { DashboardConfig } from './dashboard.config';

function dateParts(now: Date, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((value) => value.type === type)?.value);
  return [part('year'), part('month'), part('day')];
}

function toCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

@Injectable()
export class DashboardPeriodService {
  constructor(
    @Inject(DashboardClock) private readonly clock: DashboardClock,
    @Inject(DashboardConfig) private readonly config: DashboardConfig,
  ) {}

  current(): DashboardPeriod {
    const [year, month, day] = dateParts(this.clock.now(), this.config.timeZone);
    const today = utcDate(year, month, day);
    const mondayOffset = (today.getUTCDay() + 6) % 7;
    const weekStart = utcDate(year, month, day - mondayOffset);
    const weekEnd = utcDate(year, month, day - mondayOffset + 7);
    const monthStart = utcDate(year, month, 1);
    const monthEnd = utcDate(year, month + 1, 1);

    return {
      month: `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`,
      monthStartsOn: toCalendarDate(monthStart),
      monthEndsBefore: toCalendarDate(monthEnd),
      weekStartsOn: toCalendarDate(weekStart),
      weekEndsBefore: toCalendarDate(weekEnd),
      timeZone: this.config.timeZone,
    };
  }
}
