import { AppShell } from '@/components/app-shell';
import { DashboardScreen } from '@/components/dashboard/dashboard-screen';

export default function DashboardPage() {
  return (
    <AppShell
      title="Місяць під контролем"
      description="Актуальні витрати місяця, бюджет і останні операції."
      showHeader={false}
    >
      <DashboardScreen />
    </AppShell>
  );
}
