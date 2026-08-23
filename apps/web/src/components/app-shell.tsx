'use client';

import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import type { AuthUser } from '@money-tracker/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { apiVersion, navigationItems } from '@/components/navigation';
import { AuthApiError, getCurrentUser, logout, userInitials } from '@/lib/auth';

interface AppShellProps {
  title: string;
  description: string;
  showHeader?: boolean;
  children?: ReactNode;
}

export function AppShell({
  title,
  description,
  showHeader = true,
  children,
}: Readonly<AppShellProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const loadUser = useCallback(async () => {
    setError('');
    try {
      const response = await getCurrentUser();
      if (response) setUser(response.user);
    } catch (loadError) {
      if (loadError instanceof AuthApiError && loadError.code === 'UNAUTHENTICATED') {
        const returnTo =
          typeof window === 'undefined' ? pathname : `${location.pathname}${location.search}`;
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      setError('Не вдалося перевірити сесію');
    }
  }, [pathname, router]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setUser(null);
      router.replace('/login');
      router.refresh();
    }
  };

  if (!user) {
    return (
      <Stack minHeight="100vh" alignItems="center" justifyContent="center" spacing={2}>
        {error ? (
          <>
            <Alert severity="error" role="alert">
              {error}
            </Alert>
            <Button onClick={() => void loadUser()}>Спробувати ще раз</Button>
          </>
        ) : (
          <CircularProgress aria-label="Перевірка сесії" />
        )}
      </Stack>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 3, flexWrap: 'wrap', py: 1 }}>
          <Typography variant="h6" color="primary" fontWeight={800} sx={{ mr: 'auto' }}>
            Money Tracker
          </Typography>
          <Stack component="nav" direction="row" spacing={0.5} sx={{ overflowX: 'auto' }}>
            {navigationItems.map((item) => (
              <Button
                key={item.href}
                component={Link}
                href={item.href}
                color={pathname === item.href ? 'primary' : 'inherit'}
                aria-current={pathname === item.href ? 'page' : undefined}
                sx={{ minHeight: 44, fontWeight: pathname === item.href ? 700 : 500 }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>
              {userInitials(user.name)}
            </Avatar>
            <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 120 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {user.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Особистий простір
              </Typography>
            </Box>
            <Button color="inherit" onClick={() => void handleLogout()} disabled={loggingOut}>
              Вийти
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        {showHeader && (
          <>
            <Typography variant="overline" color="primary">
              Стартовий екран · API {apiVersion}
            </Typography>
            <Typography variant="h3" component="h1" fontWeight={700} sx={{ mt: 1 }}>
              {title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 680 }}>
              {description}
            </Typography>
          </>
        )}
        {children && <Box sx={{ mt: showHeader ? 4 : 0 }}>{children}</Box>}
      </Container>
    </Box>
  );
}
