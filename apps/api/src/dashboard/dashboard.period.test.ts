import { afterEach, describe, expect, it } from 'vitest';

import { DashboardClock } from './dashboard.clock';
import { DashboardConfig } from './dashboard.config';
import { DashboardPeriodService } from './dashboard.period';

class FixedClock extends DashboardClock {
  constructor(private readonly value: string) {
    super();
  }

  override now(): Date {
    return new Date(this.value);
  }
}

describe('DashboardPeriodService', () => {
  afterEach(() => delete process.env.APP_TIME_ZONE);

  it('uses Kyiv month and Monday-based week across a month boundary', () => {
    process.env.APP_TIME_ZONE = 'Europe/Kyiv';
    const service = new DashboardPeriodService(
      new FixedClock('2026-08-02T12:00:00.000Z'),
      new DashboardConfig(),
    );

    expect(service.current()).toEqual({
      month: '2026-08',
      monthStartsOn: '2026-08-01',
      monthEndsBefore: '2026-09-01',
      weekStartsOn: '2026-07-27',
      weekEndsBefore: '2026-08-03',
      timeZone: 'Europe/Kyiv',
    });
  });

  it('uses local time across the daylight-saving and year boundaries', () => {
    process.env.APP_TIME_ZONE = 'Europe/Kyiv';
    const summer = new DashboardPeriodService(
      new FixedClock('2026-03-29T21:30:00.000Z'),
      new DashboardConfig(),
    );
    const newYear = new DashboardPeriodService(
      new FixedClock('2026-12-31T22:30:00.000Z'),
      new DashboardConfig(),
    );

    expect(summer.current()).toMatchObject({
      month: '2026-03',
      weekStartsOn: '2026-03-30',
      weekEndsBefore: '2026-04-06',
    });
    expect(newYear.current()).toMatchObject({
      month: '2027-01',
      monthStartsOn: '2027-01-01',
      monthEndsBefore: '2027-02-01',
      weekStartsOn: '2026-12-28',
      weekEndsBefore: '2027-01-04',
    });
  });
});
