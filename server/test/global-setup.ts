import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { testDatabaseUrl } from './test-db';

// Brings calendar_test to the current schema once per run. `migrate deploy` creates the database
// if it doesn't exist and only applies pending migrations, so this is cheap after the first run.
export default function setup() {
  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}
