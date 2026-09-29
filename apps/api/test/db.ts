// Each test file gets a schema of its own in the test database, migrated from scratch and dropped afterwards,
// so files can run in parallel and never see each other's rows.
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../src/migrate.ts';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/learning_platform_test';

export interface TestDatabase {
  db: pg.Pool;
  /** Drops the schema and closes the pool. */
  drop(): Promise<void>;
}

export async function testDatabase(): Promise<TestDatabase> {
  const schema = `test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  // Every connection in the pool looks in the new schema first, so unqualified table names land there.
  const db = new pg.Pool({ connectionString: TEST_DATABASE_URL, options: `-c search_path=${schema}` });
  await migrate(db);
  return {
    db,
    async drop() {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}
