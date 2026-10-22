import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { SyncEventsService } from '../src/realtime/sync-events.service';
import type { SyncGateway } from '../src/realtime/sync.gateway';
import type { SyncBatchDto } from '../src/sync/dto/sync-batch.dto';
import { SyncService } from '../src/sync/sync.service';
import { StudyStatusService } from '../src/study-status/study-status.service';
import { testDatabaseUrl } from './test-db';

// The server writing the vault's study status by itself (dynamic-study-blocks D18), against a
// temporary vault and the test database.
describe('study status written by the server', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
  const events = new SyncEventsService({ emitToUser: () => undefined } as unknown as SyncGateway);
  const sync = new SyncService(prisma as unknown as PrismaService, events);
  let vault = '';
  let status: StudyStatusService;
  let userId = '';
  let otherId = '';

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  /** Up to 5 s for the debounced write (a busy dev database is slower than the debounce). */
  const waitForFile = async (path: string, test: (text: string) => boolean) => {
    for (let i = 0; i < 50; i++) {
      if (existsSync(path) && test(readFileSync(path, 'utf8'))) return;
      await wait(100);
    }
  };
  const batch = (user: string, dto: Partial<SyncBatchDto>) =>
    sync.processBatch(user, 'pc', dto as SyncBatchDto);
  const task = (id: string) => ({
    clientId: id,
    updatedAt: new Date().toISOString(),
    title: 'AN1 · Axiomas',
    estimatedMinutes: 90,
    priority: 'MEDIUM',
    status: 'PENDING',
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
    userId = (await prisma.user.create({ data: { email: 'Status-Owner@local.test' } })).id;
    otherId = (await prisma.user.create({ data: { email: 'someone-else@local.test' } })).id;
    vault = mkdtempSync(join(tmpdir(), 'study-status-'));
    status = new StudyStatusService(prisma as unknown as PrismaService, sync, events, {
      email: 'status-owner@local.test',
      vault,
      debounceMs: 50,
    });
    status.onModuleInit();
  });

  afterEach(() => {
    status.onModuleDestroy();
    rmSync(vault, { recursive: true, force: true });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rewrites both files once after a burst of study changes, keeping the notes', async () => {
    writeFileSync(
      join(vault, 'Estado_estudio.md'),
      'viejo\n<!-- notas:inicio -->\n- Mi duda\n<!-- notas:fin -->\n',
    );
    await batch(userId, { tasks: [task('a')] });
    await batch(userId, { tasks: [task('b')] });
    await waitForFile(join(vault, 'Estado_estudio.md'), (text) => text.startsWith('# Estado'));
    const markdown = readFileSync(join(vault, 'Estado_estudio.md'), 'utf8');
    expect(markdown).toMatch(/^# Estado del estudio/);
    expect(markdown).toContain('<!-- notas:inicio -->\n- Mi duda\n<!-- notas:fin -->');
    const json = JSON.parse(readFileSync(join(vault, 'estado_estudio.json'), 'utf8'));
    expect(json.comoRegenerar).toMatch(/servidor/);
    expect(existsSync(join(vault, `Estado_estudio.md.${process.pid}.tmp`))).toBe(false);
  });

  it('never writes for another account', async () => {
    await batch(otherId, { tasks: [task('c')] });
    await wait(300);
    expect(existsSync(join(vault, 'Estado_estudio.md'))).toBe(false);
  });

  it('a failed write does not fail the sync', async () => {
    rmSync(vault, { recursive: true, force: true });
    await expect(batch(userId, { tasks: [task('d')] })).resolves.toBeDefined();
    await wait(300);
  });
});
