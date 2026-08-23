import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

async function migrate(): Promise<void> {
  loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
  loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const directory = resolve(process.cwd(), 'migrations');
    const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();

    for (const name of files) {
      const existing = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (existing.rowCount) continue;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(await readFile(resolve(directory, name), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

void migrate();
