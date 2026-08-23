import { describe, expect, it } from 'vitest';

import { ExpensesCalendar } from './expenses.calendar';

describe('ExpensesCalendar', () => {
  it('uses the Europe/Kyiv calendar date across a UTC month boundary', () => {
    process.env.APP_TIME_ZONE = 'Europe/Kyiv';
    const calendar = new ExpensesCalendar();
    const now = new Date('2026-07-31T21:30:00.000Z');

    expect(calendar.today(now)).toBe('2026-08-01');
    expect(calendar.currentMonth(now)).toEqual({
      startsOn: '2026-08-01',
      endsBefore: '2026-09-01',
    });
  });
});
