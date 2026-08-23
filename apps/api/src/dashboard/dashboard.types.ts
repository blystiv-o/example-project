import type { DashboardWeeklyExpense } from '@money-tracker/shared';

import type { CategoryWithSpentRecord } from '@/categories/categories.types';
import type { ExpenseRecord } from '@/expenses/expenses.types';

export interface DashboardSnapshot {
  totalSpentMinor: number;
  totalBudgetMinor: number;
  weeklyExpenses: DashboardWeeklyExpense[];
  recentExpenses: ExpenseRecord[];
  categoryHighlights: CategoryWithSpentRecord[];
}
