export interface CategoryRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  monthlyBudgetMinor: number;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithSpentRecord extends CategoryRecord {
  spentMinor: number;
}

export interface CategoryPeriod {
  month: string;
  startsOn: string;
  endsBefore: string;
  timeZone: string;
}
