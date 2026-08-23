'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type {
  CategoryWithBudgetUsage,
  DashboardResponse,
  DashboardWeeklyExpense,
  Expense,
} from '@money-tracker/shared';
import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { formatMinorCurrency, progressValue, usageColor } from '@/lib/categories';
import { formatDashboardDay, formatDashboardMonth, getDashboard } from '@/lib/dashboard';
import { formatExpenseDate } from '@/lib/expenses';

const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

function Panel({ children, ...props }: React.ComponentProps<typeof Paper>) {
  return (
    <Paper
      variant="outlined"
      {...props}
      sx={{ borderRadius: 4, p: { xs: 2.5, md: 3 }, minWidth: 0, ...props.sx }}
    >
      {children}
    </Paper>
  );
}

function DashboardSkeleton() {
  return (
    <Box
      aria-label="Завантаження фінансового огляду"
      sx={{
        display: 'grid',
        gridTemplateAreas: {
          xs: '"stats" "recent" "chart" "categories"',
          md: '"stats recent" "chart categories"',
        },
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.12fr) minmax(320px, .88fr)' },
        gap: 2.25,
      }}
    >
      <Box
        sx={{
          gridArea: 'stats',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.75,
        }}
      >
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={150} sx={{ borderRadius: 4 }} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={340} sx={{ gridArea: 'chart', borderRadius: 4 }} />
      <Skeleton variant="rounded" height={340} sx={{ gridArea: 'recent', borderRadius: 4 }} />
      <Skeleton variant="rounded" height={340} sx={{ gridArea: 'categories', borderRadius: 4 }} />
    </Box>
  );
}

function SummaryCards({ summary }: Pick<DashboardResponse, 'summary'>) {
  const cards = [
    ['Витрачено', summary.totalSpentMinor, 'За поточний місяць'],
    ['Бюджет', summary.totalBudgetMinor, 'За всіма активними категоріями'],
    ['Залишок', summary.remainingMinor, 'Оновлюється після кожного запису'],
  ] as const;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        gap: 1.75,
      }}
    >
      {cards.map(([label, value, note]) => {
        const overspent = label === 'Залишок' && value < 0;
        return (
          <Card key={label} variant="outlined" sx={{ borderRadius: 4, minWidth: 0 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography color="text.secondary" variant="body2">
                {label}
              </Typography>
              <Typography
                variant="h4"
                color={overspent ? 'error.main' : 'text.primary'}
                fontWeight={700}
                sx={{ mt: 1, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatMinorCurrency(value)}
              </Typography>
              {overspent && (
                <Typography color="error.main" fontWeight={700} variant="body2" sx={{ mt: 0.75 }}>
                  Перевитрата
                </Typography>
              )}
              <Typography
                color="text.secondary"
                variant="caption"
                sx={{ display: 'block', mt: overspent ? 0.5 : 1.25 }}
              >
                {note}
              </Typography>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}

function WeeklyChart({ points }: { points: DashboardWeeklyExpense[] }) {
  const maximum = Math.max(0, ...points.map((point) => point.amountMinor));
  return (
    <Panel>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700}>
          Ритм тижня
        </Typography>
        <Chip label="Витрати" size="small" variant="outlined" />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(24px, 1fr))',
          gap: { xs: 0.75, sm: 1.5 },
          alignItems: 'end',
          height: 230,
          mt: 3,
        }}
      >
        {points.map((point, index) => {
          const description = `${formatDashboardDay(point.date)}: ${formatMinorCurrency(point.amountMinor)}`;
          const height = maximum === 0 ? 0 : (point.amountMinor / maximum) * 100;
          return (
            <Tooltip key={point.date} title={description} arrow>
              <Stack
                tabIndex={0}
                role="img"
                aria-label={description}
                alignItems="center"
                justifyContent="flex-end"
                sx={{
                  height: '100%',
                  minWidth: 0,
                  borderRadius: 2,
                  outlineOffset: 3,
                  '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
                }}
              >
                <Box
                  sx={{
                    width: { xs: 18, sm: 28 },
                    height: `${height}%`,
                    minHeight: point.amountMinor > 0 ? 4 : 0,
                    bgcolor: index === 5 || index === 6 ? 'secondary.main' : 'primary.main',
                    borderRadius: '8px 8px 2px 2px',
                    transition: 'height .2s ease',
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ mt: 1 }}
                >
                  {dayLabels[index]}
                </Typography>
              </Stack>
            </Tooltip>
          );
        })}
      </Box>
      {maximum === 0 && (
        <Typography color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
          Цього тижня витрат ще немає
        </Typography>
      )}
    </Panel>
  );
}

function RecentExpenses({ expenses }: { expenses: Expense[] }) {
  return (
    <Panel>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700}>
          Останні витрати
        </Typography>
        <Button component={Link} href="/expenses" sx={{ minHeight: 44 }}>
          Усі
        </Button>
      </Stack>
      <Divider sx={{ my: 2 }} />
      {expenses.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography fontWeight={700}>Витрат ще немає</Typography>
          <Button
            component={Link}
            href="/expenses?create=1"
            variant="contained"
            sx={{ mt: 2, minHeight: 44 }}
          >
            Додати витрату
          </Button>
        </Box>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {expenses.map((expense) => (
            <Stack
              key={expense.id}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
              sx={{ py: 1.5, minWidth: 0 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} noWrap>
                  {expense.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                  {expense.category.name}
                  {expense.category.archived ? ' · архів' : ''} ·{' '}
                  {formatExpenseDate(expense.expenseDate)}
                </Typography>
              </Box>
              <Typography
                color="error.main"
                fontWeight={700}
                sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
              >
                −{formatMinorCurrency(expense.amountMinor)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function categoryState(category: CategoryWithBudgetUsage): string {
  if (category.usagePercent >= 100) return 'Перевитрата';
  if (category.usagePercent >= 80) return 'Потребує уваги';
  return 'У межах бюджету';
}

function CategoryHighlights({ categories }: { categories: CategoryWithBudgetUsage[] }) {
  return (
    <Panel>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700}>
          Категорії
        </Typography>
        <Button component={Link} href="/categories" sx={{ minHeight: 44 }}>
          Керувати
        </Button>
      </Stack>
      <Divider sx={{ my: 2 }} />
      {categories.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography fontWeight={700}>Категорій ще немає</Typography>
          <Button
            component={Link}
            href="/categories"
            variant="contained"
            sx={{ mt: 2, minHeight: 44 }}
          >
            Створити категорію
          </Button>
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {categories.map((category) => {
            const color = usageColor(category.usagePercent);
            return (
              <Box key={category.id}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {category.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {category.type}
                    </Typography>
                  </Box>
                  <Typography
                    fontWeight={700}
                    sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatMinorCurrency(category.monthlyBudgetMinor)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mt: 1 }}>
                  <Typography variant="caption" color={`${color}.main`} fontWeight={700}>
                    {category.usagePercent}% · {categoryState(category)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    витрачено {formatMinorCurrency(category.spentMinor)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  color={color}
                  value={progressValue(category.usagePercent)}
                  aria-label={`${category.name}: використано ${category.usagePercent}% бюджету, ${categoryState(category)}`}
                  sx={{ mt: 0.75, height: 8, borderRadius: 99 }}
                />
              </Box>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}

export function DashboardScreen() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const response = await getDashboard(controller.signal);
      if (mountedRef.current) setData(response);
    } catch (loadError) {
      if (
        mountedRef.current &&
        !(loadError instanceof DOMException && loadError.name === 'AbortError')
      ) {
        setError('Не вдалося завантажити фінансовий огляд');
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (mountedRef.current) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [load]);

  return (
    <Stack spacing={4} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="overline" color="primary">
            {data ? formatDashboardMonth(data.period.month) : 'Фінансовий огляд'}
          </Typography>
          <Typography variant="h3" component="h1" fontWeight={700} sx={{ mt: 0.5 }}>
            Місяць під контролем
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 680 }}>
            Витрати, доступний бюджет і категорії, які потребують уваги.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/expenses?create=1"
          variant="contained"
          sx={{ minHeight: 44, alignSelf: { xs: 'flex-start', sm: 'center' } }}
        >
          Додати витрату
        </Button>
      </Stack>

      {error && !loading && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => void load()} disabled={loading}>
              Спробувати ще
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateAreas: {
              xs: '"stats" "recent" "chart" "categories"',
              md: '"stats recent" "chart categories"',
            },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(0, 1.12fr) minmax(320px, .88fr)',
            },
            gap: 2.25,
            alignItems: 'start',
          }}
        >
          <Box sx={{ gridArea: 'stats' }}>
            <SummaryCards summary={data.summary} />
          </Box>
          <Box sx={{ gridArea: 'recent' }}>
            <RecentExpenses expenses={data.recentExpenses} />
          </Box>
          <Box sx={{ gridArea: 'chart' }}>
            <WeeklyChart points={data.weeklyExpenses} />
          </Box>
          <Box sx={{ gridArea: 'categories' }}>
            <CategoryHighlights categories={data.categoryHighlights} />
          </Box>
        </Box>
      ) : null}
    </Stack>
  );
}
