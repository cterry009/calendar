import { BadRequestException, Injectable } from '@nestjs/common';
import type { BlockCommitment, BlockListEntry } from '@prisma/client';
import { DEFAULT_PLAN_NIGHT_WINDOW, isNightStartNoLater, nightStartForDay, type CommitmentView, type NightWindowTimes } from '@calendar/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventsService } from '../realtime/sync-events.service';

// "No se puede cerrar" (weekend-mode, user 2026-11-04): a week to start with, then maybe
// indefinitely. While it lasts the night block can only get stricter, from any device -- the
// apps lock their switches too, but a client (or an old build) that skips that check is refused
// here. The answer to a refused change is a sync conflict with the server's row, which every
// client already adopts.

export const COMMITMENT_DAYS_DEFAULT = 7;

export function commitmentView(row: BlockCommitment | null, now = new Date()): CommitmentView | null {
  if (!row) return null;
  return {
    startedAt: row.startedAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    active: isActive(row, now),
  };
}

function isActive(row: BlockCommitment, now: Date): boolean {
  return row.endsAt === null || row.endsAt > now;
}

/** The night window a plan blob carries, or the default. */
export function planNightWindow(planData: unknown): NightWindowTimes {
  const window = (planData as { nightWindow?: Partial<NightWindowTimes> } | null)?.nightWindow;
  if (!window || typeof window.startMinutes !== 'number' || typeof window.endMinutes !== 'number') {
    return DEFAULT_PLAN_NIGHT_WINDOW;
  }
  return {
    startMinutes: window.startMinutes,
    endMinutes: window.endMinutes,
    weekendStartMinutes: window.weekendStartMinutes ?? DEFAULT_PLAN_NIGHT_WINDOW.weekendStartMinutes,
  };
}

/** A new window that blocks no less: starts no later (weeknights and weekend), ends no earlier. */
export function isWindowNoWeaker(next: NightWindowTimes, current: NightWindowTimes): boolean {
  return (
    isNightStartNoLater(next.startMinutes, current.startMinutes, current.startMinutes) &&
    isNightStartNoLater(nightStartForDay(5, next), nightStartForDay(5, current), 0) &&
    next.endMinutes >= current.endMinutes
  );
}

export interface BlockListCandidate {
  deleted?: boolean;
  kind?: string;
  identifier?: string;
  enabled?: boolean;
  scope?: string;
  nightStartMinutes?: number | null;
  weekendNightStartMinutes?: number | null;
}

/**
 * Whether a change to a NIGHT entry weakens it: deleting or disabling it, moving it out of the
 * night list, pointing it at something else, or starting it later. New entries and FOCUS entries
 * are never refused.
 */
export function weakensNightEntry(existing: BlockListEntry, change: BlockListCandidate, window: NightWindowTimes): boolean {
  if (existing.scope !== 'NIGHT' || !existing.enabled) return false;
  if (change.deleted) return true;
  if (change.enabled === false) return true;
  if ((change.scope ?? existing.scope) !== 'NIGHT') return true;
  if (change.kind && change.kind !== existing.kind) return true;
  if (change.identifier && change.identifier.trim().toLowerCase() !== existing.identifier.trim().toLowerCase()) return true;
  const weekday = change.nightStartMinutes === undefined ? existing.nightStartMinutes : change.nightStartMinutes;
  const weekend =
    change.weekendNightStartMinutes === undefined ? existing.weekendNightStartMinutes : change.weekendNightStartMinutes;
  return (
    !isNightStartNoLater(weekday, existing.nightStartMinutes, window.startMinutes) ||
    !isNightStartNoLater(weekend, existing.weekendNightStartMinutes, nightStartForDay(5, window))
  );
}

@Injectable()
export class CommitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncEvents: SyncEventsService,
  ) {}

  async get(userId: string): Promise<BlockCommitment | null> {
    return this.prisma.blockCommitment.findUnique({ where: { userId } });
  }

  async isActive(userId: string, now = new Date()): Promise<boolean> {
    const row = await this.get(userId);
    return row !== null && isActive(row, now);
  }

  /**
   * Starts a commitment, or extends the one running: `days` more from its end (or from now when it
   * has ended), or indefinitely. Never shortens.
   */
  async extend(userId: string, input: { days?: number; indefinite?: boolean }, now = new Date()): Promise<CommitmentView> {
    const days = input.days ?? COMMITMENT_DAYS_DEFAULT;
    if (!input.indefinite && (!Number.isInteger(days) || days < 1 || days > 366)) {
      throw new BadRequestException('days debe ser un entero entre 1 y 366.');
    }
    const existing = await this.get(userId);
    const running = existing !== null && isActive(existing, now);
    let endsAt: Date | null;
    if (input.indefinite || (running && existing!.endsAt === null)) {
      endsAt = null;
    } else {
      const from = running ? existing!.endsAt! : now;
      endsAt = new Date(from.getTime() + days * 24 * 60 * 60_000);
    }
    const row = await this.prisma.blockCommitment.upsert({
      where: { userId },
      create: { userId, startedAt: now, endsAt },
      // A new commitment after one ended starts over; a running one keeps its start.
      update: running ? { endsAt } : { startedAt: now, endsAt },
    });
    // Every device re-pulls and locks its switches. The snapshot carries the commitment, so any
    // entity name that triggers a pull works; studyPlan is the one the night settings listen to.
    this.syncEvents.notifyUser(userId, {
      sourceDeviceId: 'server',
      entities: ['studyPlan', 'blockListEntries'],
      timestamp: now.toISOString(),
    });
    return commitmentView(row, now)!;
  }
}
