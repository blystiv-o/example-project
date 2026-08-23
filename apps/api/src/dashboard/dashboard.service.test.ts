import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '@/database/database.service';

import type { DashboardPeriodService } from './dashboard.period';
import type { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

const period = {
  month: '2026-08',
  monthStartsOn: '2026-08-01',
  monthEndsBefore: '2026-09-01',
  weekStartsOn: '2026-08-10',
  weekEndsBefore: '2026-08-17',
  timeZone: 'Europe/Kyiv',
} as const;

describe('DashboardService', () => {
  it('builds zero totals and seven empty days without partial client calculations', async () => {
    const weeklyExpenses = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ].map((dayOfWeek, index) => ({
      date: `2026-08-${10 + index}`,
      dayOfWeek,
      amountMinor: 0,
    }));
    const repository = {
      loadSnapshot: vi.fn().mockResolvedValue({
        totalSpentMinor: 0,
        totalBudgetMinor: 0,
        weeklyExpenses,
        recentExpenses: [],
        categoryHighlights: [],
      }),
    };
    const database = {
      readOnlySnapshot: vi.fn((work: (client: object) => unknown) => work({})),
    };
    const service = new DashboardService(
      database as unknown as DatabaseService,
      repository as unknown as DashboardRepository,
      { current: () => period } as DashboardPeriodService,
    );

    await expect(service.get('user-id', 'trace-id')).resolves.toMatchObject({
      period,
      summary: { totalSpentMinor: 0, totalBudgetMinor: 0, remainingMinor: 0 },
      weeklyExpenses,
      recentExpenses: [],
      categoryHighlights: [],
    });
    expect(database.readOnlySnapshot).toHaveBeenCalledTimes(1);
    expect(repository.loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it('keeps an archived-category expense in totals and reports overspending', async () => {
    const repository = {
      loadSnapshot: vi.fn().mockResolvedValue({
        totalSpentMinor: 600000,
        totalBudgetMinor: 500000,
        weeklyExpenses: [
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
          'SUNDAY',
        ].map((dayOfWeek, index) => ({
          date: `2026-08-${10 + index}`,
          dayOfWeek,
          amountMinor: index === 0 ? 600000 : 0,
        })),
        recentExpenses: [
          {
            id: 'c16bbc82-6158-48f3-8719-803e8fb8c217',
            userId: 'user-id',
            title: 'Сільпо',
            amountMinor: 600000,
            expenseDate: '2026-08-10',
            version: 1,
            deletedAt: null,
            createdAt: '2026-08-10T08:30:00.000Z',
            updatedAt: '2026-08-10T08:30:00.000Z',
            category: {
              id: '44638959-f635-4d85-a273-9351c60c7829',
              name: 'Їжа',
              archivedAt: '2026-08-11T08:30:00.000Z',
            },
          },
        ],
        categoryHighlights: [],
      }),
    };
    const service = new DashboardService(
      {
        readOnlySnapshot: (work: (client: object) => unknown) => work({}),
      } as unknown as DatabaseService,
      repository as unknown as DashboardRepository,
      { current: () => period } as DashboardPeriodService,
    );

    const response = await service.get('user-id', 'trace-id');

    expect(response.summary).toEqual({
      totalSpentMinor: 600000,
      totalBudgetMinor: 500000,
      remainingMinor: -100000,
    });
    expect(response.recentExpenses[0]?.category).toMatchObject({
      name: 'Їжа',
      archived: true,
    });
  });
});
