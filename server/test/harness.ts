import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { SyncEventsService } from '../src/realtime/sync-events.service';
import type { SyncBatchDto } from '../src/sync/dto/sync-batch.dto';
import { SyncService } from '../src/sync/sync.service';
import { testDatabaseUrl } from './test-db';

/**
 * Real SyncService on the calendar_test database. Nest's DI isn't needed for this: the service
 * only depends on Prisma and the realtime notifier, so it's built by hand, with the notifier
 * replaced by a recorder so tests can assert what other devices would have been told.
 */
export function useSyncHarness() {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
  const notifications: Array<{ userId: string; entities: string[]; sourceDeviceId: string }> = [];
  const events = {
    notifyUser: (userId: string, payload: { entities: string[]; sourceDeviceId: string }) => {
      notifications.push({ userId, entities: payload.entities, sourceDeviceId: payload.sourceDeviceId });
    },
  } as unknown as SyncEventsService;
  const service = new SyncService(prisma as unknown as PrismaService, events);

  const ctx = {
    prisma,
    service,
    notifications,
    userId: '',
    otherUserId: '',
    /** Batch as the main test user, from device "phone" unless told otherwise. */
    batch: (dto: Partial<SyncBatchDto>, userId = ctx.userId, deviceId = 'phone') =>
      service.processBatch(userId, deviceId, dto as SyncBatchDto),
    pull: (userId = ctx.userId) => service.pullSnapshot(userId),
  };

  beforeEach(async () => {
    // Every synced table hangs off users with ON DELETE CASCADE, so this resets everything.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "users" CASCADE');
    notifications.length = 0;
    ctx.userId = (await prisma.user.create({ data: { email: 'sync-test@local.test' } })).id;
    ctx.otherUserId = (await prisma.user.create({ data: { email: 'other@local.test' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return ctx;
}

/** ISO timestamp `minutes` from a fixed base, so ordering between changes is explicit. */
export function at(minutes: number): string {
  return new Date(Date.UTC(2026, 8, 28, 12, 0, 0) + minutes * 60_000).toISOString();
}
