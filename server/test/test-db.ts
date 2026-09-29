import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Integration tests run against a real Postgres (the docker-compose service), never mocks: the
// point is to catch divergence between Prisma's upsert/unique-key behaviour and the sync rules,
// which a mocked client would happily hide (task 12.9).
//
// They use their own database, `calendar_test`, next to the dev one -- same server and
// credentials as DATABASE_URL in server/.env, so there is nothing extra to configure, and the
// dev data is never touched.
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8');
  const match = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
  if (!match) throw new Error('DATABASE_URL not found in server/.env (or set TEST_DATABASE_URL)');
  const url = new URL(match[1]);
  url.pathname = '/calendar_test';
  return url.toString();
}
