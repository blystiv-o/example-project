import { describe, expect, it } from 'vitest';

import { safeReturnTo, userInitials } from './auth';

describe('safeReturnTo', () => {
  it.each(['/dashboard', '/expenses?month=2026-08', '/profile#details'])(
    'accepts local path %s',
    (path) => expect(safeReturnTo(path)).toBe(path),
  );

  it.each([
    'https://attacker.example',
    '//attacker.example/path',
    '/\\attacker.example/path',
    'dashboard',
    '',
  ])('rejects unsafe return URL %s', (path) => expect(safeReturnTo(path)).toBeNull());
});

describe('userInitials', () => {
  it('uses the first two words from the authenticated user name', () => {
    expect(userInitials(' Володимир Коваль ')).toBe('ВК');
    expect(userInitials('Олена')).toBe('О');
  });
});
