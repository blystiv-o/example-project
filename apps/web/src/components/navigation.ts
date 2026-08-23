import { API_VERSION } from '@money-tracker/shared';

export const apiVersion = API_VERSION;

export const navigationItems = [
  { href: '/dashboard', label: 'Огляд' },
  { href: '/expenses', label: 'Витрати' },
  { href: '/categories', label: 'Категорії' },
  { href: '/profile', label: 'Профіль' },
] as const;
