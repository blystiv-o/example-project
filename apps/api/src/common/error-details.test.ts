import { describe, expect, it } from 'vitest';

import { errorDetails } from './error-details';

describe('errorDetails', () => {
  it('extracts the origin and first application location from a stack', () => {
    const error = new Error('connection refused');
    error.name = 'DatabaseError';
    error.stack = [
      'DatabaseError: connection refused',
      '    at Pool.connect (/project/node_modules/pg-pool/index.js:45:11)',
      '    at async DatabaseService.transaction (/project/apps/api/src/database/database.service.ts:28:24)',
      '    at async AuthService.register (/project/apps/api/src/auth/auth.service.ts:49:26)',
    ].join('\n');

    expect(errorDetails(error)).toEqual({
      name: 'DatabaseError',
      message: 'connection refused',
      stack: error.stack,
      location: {
        function: 'Pool.connect',
        file: '/project/node_modules/pg-pool/index.js',
        line: 45,
        column: 11,
      },
      application_location: {
        function: 'DatabaseService.transaction',
        file: '/project/apps/api/src/database/database.service.ts',
        line: 28,
        column: 24,
      },
    });
  });

  it('handles non-Error values', () => {
    expect(errorDetails('failure')).toEqual({ name: 'UnknownError', message: 'failure' });
  });
});
