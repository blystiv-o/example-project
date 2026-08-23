export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface ExpenseRecord {
  id: string;
  userId: string;
  title: string;
  amountMinor: number;
  expenseDate: string;
  version: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: ExpenseCategoryRecord;
}

export interface ExpenseListResult {
  expenses: ExpenseRecord[];
  total: number;
  filteredAmountMinor: number;
  currentMonthAmountMinor: number;
}
