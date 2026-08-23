import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '@/database/database.service';

import { SessionRepository } from './session.repository';

describe('SessionRepository', () => {
  it('returns the user for a valid session', async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            session_id: 'session-id',
            expires_at: new Date(Date.now() + 60_000),
            id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
            name: 'Володимир',
            email: 'user@example.com',
          },
        ],
      }),
    };
    const repository = new SessionRepository(database as unknown as DatabaseService);
    await expect(repository.findUserByTokenHash('hash', new Date())).resolves.toEqual({
      id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
      name: 'Володимир',
      email: 'user@example.com',
    });
  });

  it('deletes and rejects an expired session', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: 'session-id',
            expires_at: new Date(Date.now() - 60_000),
            id: '8e8ec0df-8e02-4d12-a708-b8f4ea0f158e',
            name: 'Володимир',
            email: 'user@example.com',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const repository = new SessionRepository({ query } as unknown as DatabaseService);
    await expect(repository.findUserByTokenHash('hash', new Date())).resolves.toBeNull();
    expect(query).toHaveBeenLastCalledWith('DELETE FROM sessions WHERE token_hash = $1', ['hash']);
  });
});
