import { describe, expect, it } from 'vitest';

import { CategoriesClock } from './categories.clock';
import { CategoriesConfig } from './categories.config';
import { CategoriesPeriodService } from './categories.period';

describe('CategoriesPeriodService', () => {
  it('uses Europe/Kyiv boundaries on the month edge', () => {
    process.env.APP_TIME_ZONE = 'Europe/Kyiv';

    class FixedClock extends CategoriesClock {
      override now(): Date {
        return new Date('2026-07-31T21:30:00.000Z');
      }
    }

    const service = new CategoriesPeriodService(new FixedClock(), new CategoriesConfig());

    expect(service.currentMonth()).toEqual({
      month: '2026-08',
      startsOn: '2026-08-01',
      endsBefore: '2026-09-01',
      timeZone: 'Europe/Kyiv',
    });
  });
});
