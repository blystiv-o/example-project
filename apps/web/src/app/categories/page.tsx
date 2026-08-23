import { AppShell } from '@/components/app-shell';
import { CategoriesScreen } from '@/components/categories/categories-screen';

export default function CategoriesPage() {
  return (
    <AppShell
      title="Категорії"
      description="Керуйте категоріями витрат і відстежуйте місячні бюджети без переходу між екранами."
    >
      <CategoriesScreen />
    </AppShell>
  );
}
