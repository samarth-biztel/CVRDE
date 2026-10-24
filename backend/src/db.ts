import './env.js';
import { CompiledQuery, Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
pg.types.setTypeParser(20, value => Number(value));
pg.types.setTypeParser(1082, value => value);
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 2 : 10 });
export const db = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool }) });
export type Executor = Pick<typeof db, 'executeQuery'>;
export async function query<T = Record<string, unknown>>(executor: Executor, statement: string, values: unknown[] = []): Promise<T[]> {
  const result = await executor.executeQuery<T>(CompiledQuery.raw(statement, values));
  return result.rows as T[];
}
export async function one<T = Record<string, unknown>>(executor: Executor, statement: string, values: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(executor, statement, values))[0];
}

