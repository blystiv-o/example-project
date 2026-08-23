import { CircularProgress, Stack } from '@mui/material';
import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Stack minHeight="100vh" alignItems="center" justifyContent="center">
          <CircularProgress aria-label="Перевірка сесії" />
        </Stack>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
