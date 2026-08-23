import { describe, expect, it } from 'vitest';

import { apiVersion, navigationItems } from './navigation';

describe('navigation', () => {
  it('contains all primary routes and uses the shared API version', () => {
    expect(navigationItems.map(({ href }) => href)).toEqual([
      '/dashboard',
      '/expenses',
      '/categories',
      '/profile',
    ]);
    expect(apiVersion).toBe('v1');
  });
});
