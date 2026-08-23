// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  searchParams: new URLSearchParams('mode=login'),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('@/lib/auth', () => ({
  AuthApiError: class AuthApiError extends Error {
    constructor(
      message: string,
      readonly code: string,
      readonly fields: Record<string, string[]> = {},
    ) {
      super(message);
    }
  },
  login: mocks.login,
  register: mocks.register,
  safeReturnTo: (value: string | null) => (value?.startsWith('/') ? value : null),
}));

import { AuthApiError } from '@/lib/auth';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.login.mockReset();
    mocks.register.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.searchParams = new URLSearchParams('mode=login');
  });

  it('switches tabs, synchronizes the query and does not transfer the password', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Реєстрація' }));

    expect(mocks.replace).toHaveBeenCalledWith('/login?mode=register', { scroll: false });
    expect(screen.getByLabelText("Ім'я")).toBeInTheDocument();
    expect(screen.getByLabelText('Пароль')).toHaveValue('');
  });

  it('shows client errors and focuses the first invalid field on submit', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByText('Вкажіть email')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('blocks duplicate submit while the request is pending', async () => {
    let finish: ((value: unknown) => void) | undefined;
    mocks.login.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret123' } });
    const button = screen.getByRole('button', { name: 'Увійти' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    finish?.({ user: {} });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a server field error without losing name or email', async () => {
    mocks.searchParams = new URLSearchParams('mode=register');
    mocks.register.mockRejectedValue(
      new AuthApiError('Email уже використовується', 'EMAIL_ALREADY_EXISTS', {
        email: ['Обліковий запис із таким email уже існує'],
      }),
    );
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Ім'я"), { target: { value: 'Володимир' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Створити акаунт' }));

    expect(await screen.findByText('Обліковий запис із таким email уже існує')).toBeInTheDocument();
    expect(screen.getByLabelText("Ім'я")).toHaveValue('Володимир');
    expect(screen.getByLabelText('Email')).toHaveValue('user@example.com');
    await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
  });
});
