import { Injectable } from '@nestjs/common';

@Injectable()
export class ExpensesCalendar {
  readonly timeZone: string;

  constructor() {
    this.timeZone = process.env.APP_TIME_ZONE ?? 'Europe/Kyiv';
    try {
      this.format(new Date());
    } catch {
      throw new Error(`APP_TIME_ZONE must be a valid IANA time zone, received "${this.timeZone}"`);
    }
  }

  today(now = new Date()): string {
    return this.format(now);
  }

  currentMonth(now = new Date()): { startsOn: string; endsBefore: string } {
    const today = this.today(now);
    const [yearValue, monthValue] = today.split('-');
    const year = Number(yearValue);
    const month = Number(monthValue);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return {
      startsOn: `${yearValue}-${monthValue}-01`,
      endsBefore: `${nextYear.toString().padStart(4, '0')}-${nextMonth
        .toString()
        .padStart(2, '0')}-01`,
    };
  }

  private format(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (!year || !month || !day) throw new Error('Could not format the current date');
    return `${year}-${month}-${day}`;
  }
}
