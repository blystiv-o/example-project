// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardDayOfWeek, type DashboardResponse } from '@money-tracker/shared';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getDashboard: vi.fn() }));

vi.mock('@/lib/dashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dashboard')>();
  return { ...actual, getDashboard: mocks.getDashboard };
});

import { DashboardScreen } from './dashboard-screen';

const emptyResponse: DashboardResponse = {
  period: {
    month: '2026-08',
    monthStartsOn: '2026-08-01',
    monthEndsBefore: '2026-09-01',
    weekStartsOn: '2026-08-10',
    weekEndsBefore: '2026-08-17',
    timeZone: 'Europe/Kyiv',
  },
  summary: { totalSpentMinor: 0, totalBudgetMinor: 0, remainingMinor: 0 },
  weeklyExpenses: Object.values(DashboardDayOfWeek).map((dayOfWeek, index) => ({
    date: `2026-08-${10 + index}`,
    dayOfWeek,
    amountMinor: 0,
  })),
  recentExpenses: [],
  categoryHighlights: [],
};

describe('DashboardScreen', () => {
  afterEach(cleanup);

  beforeEach(() => mocks.getDashboard.mockReset());

  it('shows complete skeletons and all empty states after a zero snapshot', async () => {
    let resolveRequest: ((value: DashboardResponse) => void) | undefined;
    mocks.getDashboard.mockReturnValue(
      new Promise<DashboardResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<DashboardScreen />);
    expect(screen.getByLabelText('Завантаження фінансового огляду')).toBeInTheDocument();
    resolveRequest?.(emptyResponse);

    expect(await screen.findByText('Цього тижня витрат ще немає')).toBeInTheDocument();
    expect(screen.getByText('Витрат ще немає')).toBeInTheDocument();
    expect(screen.getByText('Категорій ще немає')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(7);
    expect(screen.getAllByText('0,00 ₴')).toHaveLength(3);
  });

  it('renders negative remaining and explicit category risk text', async () => {
    mocks.getDashboard.mockResolvedValue({
      ...emptyResponse,
      summary: { totalSpentMinor: 600000, totalBudgetMinor: 500000, remainingMinor: -100000 },
      categoryHighlights: [
        {
          id: '44638959-f635-4d85-a273-9351c60c7829',
          name: 'Їжа',
          type: "Обов'язкові",
          monthlyBudgetMinor: 500000,
          spentMinor: 600000,
          remainingMinor: -100000,
          usagePercent: 120,
          version: 1,
          createdAt: '2026-08-01T08:30:00.000Z',
          updatedAt: '2026-08-01T08:30:00.000Z',
        },
      ],
    });

    render(<DashboardScreen />);

    expect(await screen.findByText('-1 000,00 ₴')).toBeInTheDocument();
    expect(screen.getAllByText(/Перевитрата/)).toHaveLength(2);
    expect(screen.getByText(/120%/)).toBeInTheDocument();
  });

  it('shows the safe error and performs only one retry', async () => {
    mocks.getDashboard.mockRejectedValueOnce(new Error('database details'));
    mocks.getDashboard.mockResolvedValueOnce(emptyResponse);
    render(<DashboardScreen />);

    expect(await screen.findByText('Не вдалося завантажити фінансовий огляд')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще' }));

    await waitFor(() => expect(mocks.getDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Витрат ще немає')).toBeInTheDocument();
  });
});
