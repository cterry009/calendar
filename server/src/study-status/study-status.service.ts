import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { Subscription } from 'rxjs';
import {
  buildStudyStatus,
  STUDY_STATUS_EVENTS_DAYS,
  STUDY_STATUS_JSON_FILE,
  STUDY_STATUS_MD_FILE,
  type StudyStatusFocusEvent,
  type StudyStatusSnapshot,
} from '@calendar/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SyncEventsService } from '../realtime/sync-events.service';
import type { SyncEntityType } from '../sync/sync.types';
import { SyncService } from '../sync/sync.service';
import { TutorCatalog } from '../tutor/catalog';

// The vault's study status written by the server itself (dynamic-study-blocks D18, 2026-10-22): until
// then Estado_estudio.md was only as fresh as the last manual run of scripts/export-study-status.mjs.
// A sync batch that changes study data schedules a rewrite for that user; a burst of batches (a
// pomodoro's transitions, a flush after being offline) becomes one write, `debounceMs` after the last.
// Only the user whose email is STUDY_STATUS_EMAIL is written -- the dev database holds many test
// accounts -- and without it nothing is.

export interface StudyStatusConfig {
  email: string | null;
  vault: string;
  debounceMs: number;
}

export function studyStatusConfig(env: NodeJS.ProcessEnv = process.env): StudyStatusConfig {
  return {
    email: env.STUDY_STATUS_EMAIL?.trim().toLowerCase() || null,
    vault: env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica'),
    debounceMs: Number(env.STUDY_STATUS_DEBOUNCE_MS) || 30_000,
  };
}

/** What the status shows: study sessions, pomodoros, ratings and check-ins, the game, the plan. */
const STUDY_ENTITIES: ReadonlySet<SyncEntityType> = new Set<SyncEntityType>([
  'tasks',
  'pomodoroSessions',
  'focusEvents',
  'exerciseAttempts',
  'schedules',
  'studyPlan',
] as SyncEntityType[]);

const DAY_MS = 24 * 60 * 60 * 1000;

export const STUDY_STATUS_CONFIG = Symbol('STUDY_STATUS_CONFIG');

@Injectable()
export class StudyStatusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StudyStatusService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private subscription: Subscription | null = null;
  private userId: string | null | undefined;
  private readonly catalog: TutorCatalog;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly syncEvents: SyncEventsService,
    @Inject(STUDY_STATUS_CONFIG) private readonly config: StudyStatusConfig,
  ) {
    this.catalog = new TutorCatalog(config.vault);
  }

  onModuleInit() {
    if (!this.config.email) return;
    this.subscription = this.syncEvents.batchesApplied$.subscribe(({ userId, entities }) => {
      if (entities.some((e) => STUDY_ENTITIES.has(e))) void this.schedule(userId);
    });
  }

  onModuleDestroy() {
    this.subscription?.unsubscribe();
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  /** The configured user's id, looked up once. */
  private async configuredUserId(): Promise<string | null> {
    if (this.userId === undefined) {
      const user = this.config.email
        ? await this.prisma.user.findFirst({
            where: { email: { equals: this.config.email, mode: 'insensitive' } },
            select: { id: true },
          })
        : null;
      this.userId = user?.id ?? null;
    }
    return this.userId;
  }

  private async schedule(userId: string) {
    if ((await this.configuredUserId()) !== userId) return;
    const pending = this.timers.get(userId);
    if (pending) clearTimeout(pending);
    this.timers.set(
      userId,
      setTimeout(() => {
        this.timers.delete(userId);
        void this.write(userId).catch((error: unknown) => {
          // Never the sync's problem: the file just stays as it was.
          this.logger.warn(
            `No se pudo escribir el estado del estudio: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }, this.config.debounceMs),
    );
  }

  /** Builds and writes both files now (also used by tests). */
  async write(userId: string): Promise<void> {
    const vault = this.config.vault;
    if (!existsSync(vault)) throw new Error(`no existe el vault ${vault}`);
    // The builder reads the rows as the pull's JSON (ISO strings), like the script does.
    const snapshot = JSON.parse(
      JSON.stringify(await this.sync.pullSnapshot(userId)),
    ) as StudyStatusSnapshot;
    const focusEvents = JSON.parse(
      JSON.stringify(
        await this.sync.listFocusEvents(
          userId,
          new Date(Date.now() - STUDY_STATUS_EVENTS_DAYS * DAY_MS),
        ),
      ),
    ) as StudyStatusFocusEvent[];
    const { exercises, notes } = this.catalog.load();
    const noteFiles = new Map(
      [...notes.values()].map((note) => [note.noteCode, basename(note.path).replace(/\.md$/, '')]),
    );
    const mdPath = join(vault, STUDY_STATUS_MD_FILE);
    const { markdown, json } = buildStudyStatus({
      snapshot,
      focusEvents,
      catalog: exercises,
      noteFiles,
      now: new Date(),
      previousMarkdown: existsSync(mdPath) ? readFileSync(mdPath, 'utf8') : null,
      source: 'server',
    });
    writeAtomically(mdPath, markdown);
    writeAtomically(join(vault, STUDY_STATUS_JSON_FILE), `${JSON.stringify(json, null, 2)}\n`);
  }
}

/** Obsidian (or a sync tool) never sees a half-written file: write a sibling, then rename over. */
function writeAtomically(path: string, content: string) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, path);
}
