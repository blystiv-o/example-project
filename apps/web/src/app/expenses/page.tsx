import { AppShell } from '@/components/app-shell';
import { ExpensesScreen } from '@/components/expenses/expenses-screen';

export default function ExpensesPage() {
  return (
    <AppShell
      title="Витрати"
      description="Додавайте, знаходьте та редагуйте записи, не втрачаючи зв’язок із категоріями й місячними підсумками."
    >
      <ExpensesScreen />
    </AppShell>
  );
}
