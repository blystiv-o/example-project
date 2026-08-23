'use client';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { loginRequestSchema, registerRequestSchema } from '@money-tracker/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { z } from 'zod';

import { AuthApiError, login, register, safeReturnTo } from '@/lib/auth';

type AuthMode = 'login' | 'register';
type FieldName = 'name' | 'email' | 'password';
type FormErrors = Partial<Record<FieldName, string>>;

function issuesFor(result: z.SafeParseReturnType<unknown, unknown>): FormErrors {
  if (result.success) return {};
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as FieldName | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const [mode, setMode] = useState<AuthMode>(requestedMode === 'register' ? 'register' : 'login');
  const [loginValues, setLoginValues] = useState({ email: '', password: '' });
  const [registerValues, setRegisterValues] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [clientErrors, setClientErrors] = useState<FormErrors>({});
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const values = mode === 'login' ? loginValues : registerValues;
  const schema = mode === 'login' ? loginRequestSchema : registerRequestSchema;
  const visibleErrors = useMemo(
    () => ({ ...clientErrors, ...serverErrors }),
    [clientErrors, serverErrors],
  );

  useEffect(() => {
    setMode(requestedMode === 'register' ? 'register' : 'login');
  }, [requestedMode]);

  const validate = (nextValues = values): FormErrors => issuesFor(schema.safeParse(nextValues));

  const focusFirstError = (errors: FormErrors): void => {
    const order: FieldName[] =
      mode === 'register' ? ['name', 'email', 'password'] : ['email', 'password'];
    const first = order.find((field) => errors[field]);
    ({ name: nameRef, email: emailRef, password: passwordRef })[first ?? 'email'].current?.focus();
  };

  const switchMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setLoginValues((current) => ({ ...current, password: '' }));
    setRegisterValues((current) => ({ ...current, password: '' }));
    setTouched({});
    setSubmitted(false);
    setClientErrors({});
    setServerErrors({});
    setFormError('');
    const query = new URLSearchParams(searchParams.toString());
    query.set('mode', nextMode);
    router.replace(`/login?${query.toString()}`, { scroll: false });
  };

  const updateField = (field: FieldName, value: string): void => {
    const nextValues = { ...values, [field]: value };
    if (mode === 'login') {
      setLoginValues(nextValues as typeof loginValues);
    } else {
      setRegisterValues(nextValues as typeof registerValues);
    }
    setServerErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
    if (touched[field] || submitted) setClientErrors(validate(nextValues));
  };

  const blurField = (field: FieldName): void => {
    setTouched((current) => ({ ...current, [field]: true }));
    setClientErrors(validate());
  };

  const helperText = (field: FieldName): string => {
    if ((touched[field] || submitted) && visibleErrors[field]) return visibleErrors[field] ?? '';
    if (field === 'password') return 'Від 6 до 128 символів';
    return ' ';
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerErrors({});
    setFormError('');
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errors = issuesFor(parsed);
      setClientErrors(errors);
      focusFirstError(errors);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await register(registerRequestSchema.parse(values));
        router.replace('/dashboard');
      } else {
        await login(loginRequestSchema.parse(values));
        router.replace(safeReturnTo(searchParams.get('returnTo')) ?? '/dashboard');
      }
      router.refresh();
    } catch (error) {
      if (error instanceof AuthApiError) {
        const fields = Object.fromEntries(
          Object.entries(error.fields).map(([field, messages]) => [field, messages[0]]),
        ) as FormErrors;
        setServerErrors(fields);
        if (Object.keys(fields).length === 0) setFormError(error.message);
        window.setTimeout(() => focusFirstError(fields), 0);
      } else {
        setFormError('Не вдалося з’єднатися із сервером. Спробуйте ще раз');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="main" className="auth-layout">
      <Box component="section" className="auth-hero">
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box className="brand-mark" aria-hidden="true">
            ₴
          </Box>
          <Box>
            <Typography fontSize={18} fontWeight={700}>
              Money Tracker
            </Typography>
            <Typography variant="caption" color="text.secondary" textTransform="uppercase">
              Домашні фінанси
            </Typography>
          </Box>
        </Stack>
        <Typography component="h1" className="auth-title">
          Фінанси без шуму
        </Typography>
        <Typography className="auth-copy">
          Простий облік витрат і бюджетів, щоб бачити головне та впевнено планувати місяць.
        </Typography>
      </Box>

      <Paper component="section" variant="outlined" className="auth-card">
        <Tabs
          value={mode}
          onChange={(_, nextMode: AuthMode) => switchMode(nextMode)}
          variant="fullWidth"
          aria-label="Перемикач входу та реєстрації"
        >
          <Tab value="login" label="Вхід" />
          <Tab value="register" label="Реєстрація" />
        </Tabs>
        <Stack component="form" onSubmit={submit} noValidate spacing={2} sx={{ mt: 3 }}>
          {formError && (
            <Alert severity="error" role="alert">
              {formError}
            </Alert>
          )}
          {mode === 'register' && (
            <TextField
              inputRef={nameRef}
              label="Ім'я"
              name="name"
              autoComplete="name"
              value={registerValues.name}
              onChange={(event) => updateField('name', event.target.value)}
              onBlur={() => blurField('name')}
              error={Boolean((touched.name || submitted) && visibleErrors.name)}
              helperText={helperText('name')}
              slotProps={{
                formHelperText: {
                  role: (touched.name || submitted) && visibleErrors.name ? 'alert' : undefined,
                },
              }}
              disabled={loading}
            />
          )}
          <TextField
            inputRef={emailRef}
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => updateField('email', event.target.value)}
            onBlur={() => blurField('email')}
            error={Boolean((touched.email || submitted) && visibleErrors.email)}
            helperText={helperText('email')}
            slotProps={{
              formHelperText: {
                role: (touched.email || submitted) && visibleErrors.email ? 'alert' : undefined,
              },
            }}
            disabled={loading}
          />
          <TextField
            inputRef={passwordRef}
            label="Пароль"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={values.password}
            onChange={(event) => updateField('password', event.target.value)}
            onBlur={() => blurField('password')}
            error={Boolean((touched.password || submitted) && visibleErrors.password)}
            helperText={helperText('password')}
            slotProps={{
              formHelperText: {
                role:
                  (touched.password || submitted) && visibleErrors.password ? 'alert' : undefined,
              },
            }}
            disabled={loading}
          />
          <Button type="submit" variant="contained" size="large" disabled={loading}>
            {loading ? (
              <CircularProgress size={24} color="inherit" aria-label="Завантаження" />
            ) : mode === 'login' ? (
              'Увійти'
            ) : (
              'Створити акаунт'
            )}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
