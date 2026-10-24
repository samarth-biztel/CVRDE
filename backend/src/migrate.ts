import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './db.js';

const folder = join(process.cwd(), 'migrations');
const client = await pool.connect();
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const file of readdirSync(folder).filter(x => x.endsWith('.sql')).sort()) {
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [file]);
    if (exists.rowCount) continue;
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(join(folder, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
