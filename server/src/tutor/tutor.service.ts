import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tutorConfig } from './tutor.config';
import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  type Exercise,
  type ExerciseAttemptInput,
  type GameState,
  type SectionRef,
} from '@calendar/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import type { SyncBatchDto } from '../sync/dto/sync-batch.dto';
import type { Catalog } from './catalog';
import type { TutorTurnDto } from './dto/tutor-turn.dto';
import { TutorGameService, type SectionGame, type SectionGameView } from './tutor-game.service';
import {
  TUTOR_MODEL,
  TutorInvalidReplyError,
  TutorUnavailableError,
  type TutorModel,
} from './tutor-model';
import { buildTurnPrompt, type TutorExercise } from './tutor-prompt';
import { parseTutorReply, type TutorAction } from './tutor-reply';

export interface TutorNoteSummary {
  noteCode: string;
  title: string;
  /** Relative to the vault, e.g. "Fundamentos/Analisis/AN1_analisis_real.md". */
  path: string;
  sections: { section: string; title: string; exercises: number }[];
}

export interface TutorTurnResult {
  sessionId: string;
  mensaje: string;
  accion: TutorAction;
  /** The exercise on the table after this turn; null while the engine waits for a generated one. */
  current: TutorExercise | null;
  /** Set when the next turn must ask Claude for a generated exercise at this b. */
  generateAt: number | null;
  attempt:
    (ExerciseAttemptInput & { xpGained: number; thetaBefore: number; thetaAfter: number }) | null;
  game: SectionGame;
  warnings: string[];
  durationMs: number;
}

function fromCatalog(exercise: Exercise): TutorExercise {
  return {
    exerciseId: exercise.id,
    source: 'nota',
    noteCode: exercise.noteCode,
    section: exercise.section,
    kind: exercise.kind,
    b: exercise.b0,
    title: exercise.title,
    statement: exercise.statement,
    answer: exercise.answer,
    hint: exercise.hint,
  };
}

/**
 * One tutor turn (study-tutor-game D30): the code picks the exercise, Claude talks and grades, the
 * code checks the grade and records it. Stateless apart from which user owns which Claude session.
 */
@Injectable()
export class TutorService {
  /**
   * Claude session id -> user id. Kept on disk since 2026-11-11 so a server restart no longer
   * wipes the tutor's memory (Claude keeps the transcript itself; this only checks ownership).
   */
  private readonly sessionsFile = join(tutorConfig().workDir, 'sessions.json');
  private readonly sessions = this.loadSessions();

  private loadSessions(): Map<string, string> {
    try {
      return new Map(Object.entries(JSON.parse(readFileSync(this.sessionsFile, 'utf8')) as Record<string, string>));
    } catch {
      return new Map();
    }
  }

  private rememberSession(sessionId: string, userId: string) {
    this.rememberSession(sessionId, userId);
    // Keep the newest 500 conversations.
    while (this.sessions.size > 500) this.sessions.delete(this.sessions.keys().next().value as string);
    try {
      mkdirSync(tutorConfig().workDir, { recursive: true });
      writeFileSync(this.sessionsFile, JSON.stringify(Object.fromEntries(this.sessions)));
    } catch {
      // Memory only until the next restart.
    }
  }
  private readonly busy = new Set<string>();

  constructor(
    @Inject(TUTOR_MODEL) private readonly model: TutorModel,
    private readonly game: TutorGameService,
    private readonly sync: SyncService,
    private readonly prisma: PrismaService,
  ) {}

  state(userId: string, ref: SectionRef): Promise<SectionGameView> {
    return this.game.sectionView(userId, ref);
  }

  /** The notes with exercises and their sections: the web has no vault, so this is its menu (D38). */
  notes(): TutorNoteSummary[] {
    const catalog = this.game.loadCatalog();
    return [...catalog.notes.values()]
      .map((note) => ({
        noteCode: note.noteCode,
        title: note.title,
        path: note.relativePath,
        sections: note.sections
          .map((s) => ({
            section: s.section,
            title: s.title,
            exercises: catalog.exercises.filter(
              (e) => e.noteCode === note.noteCode && e.section === s.section,
            ).length,
          }))
          .filter((s) => s.exercises > 0),
      }))
      .sort((a, b) => a.path.localeCompare(b.path, 'es', { numeric: true }));
  }

  async turn(userId: string, deviceId: string, dto: TutorTurnDto): Promise<TutorTurnResult> {
    if (this.busy.has(userId)) {
      throw new HttpException(
        { error: 'tutor_busy', message: 'El tutor todavía está respondiendo el mensaje anterior.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.busy.add(userId);
    try {
      return await this.runTurn(userId, deviceId, dto);
    } finally {
      this.busy.delete(userId);
    }
  }

  private async runTurn(
    userId: string,
    deviceId: string,
    dto: TutorTurnDto,
  ): Promise<TutorTurnResult> {
    const ref: SectionRef = { noteCode: dto.noteCode, section: dto.section };
    const catalog = this.game.loadCatalog();
    const note = catalog.notes.get(ref.noteCode);
    if (!note)
      throw new BadRequestException(`No hay ejercicios de la nota ${ref.noteCode} en el vault`);
    const noteSection = note.sections.find((s) => s.section === ref.section) ?? null;
    if (!noteSection)
      throw new BadRequestException(`La nota ${ref.noteCode} no tiene la sección ${ref.section}`);

    const warnings: string[] = [];
    let resume = false;
    let sessionId: string = randomUUID();
    if (dto.sessionId) {
      if (this.sessions.get(dto.sessionId) === userId) {
        sessionId = dto.sessionId;
        resume = true;
      } else {
        warnings.push(
          dto.history?.length
            ? 'La sesión del tutor se perdió: sigue la conversación con tus últimos mensajes.'
            : 'El tutor no recuerda esa conversación (¿se reinició el servidor?): empieza una nueva.',
        );
      }
    }

    const before = await this.game.state(userId, catalog);
    let current = dto.current ? this.resolveCurrent(dto, catalog) : null;
    let generateAt: number | null = null;
    if (!current) {
      const next = this.game.next(before, catalog, ref);
      if (next.type === 'catalog') current = fromCatalog(next.exercise);
      else generateAt = next.targetB;
    }

    const view = this.game.view(before, ref);
    const studySession = dto.studyTaskId
      ? await this.studySessionTitle(userId, dto.studyTaskId)
      : null;
    const recentRows = await this.prisma.exerciseAttempt.findMany({
      where: { userId, noteCode: ref.noteCode, section: ref.section },
      orderBy: { occurredAt: 'desc' },
      take: 10,
      select: { exerciseId: true, r: true },
    });
    const prompt = buildTurnPrompt({
      recent: recentRows.map((a) => ({ exerciseId: a.exerciseId, r: Number(a.r) })),
      history: resume ? undefined : dto.history?.slice(-12),
      message: dto.message,
      note,
      section: noteSection,
      theta: view.theta,
      level: view.level,
      attempts: view.attempts,
      studySession,
      current,
      generateAt,
    });

    let output: unknown;
    let durationMs = 0;
    try {
      ({ output, durationMs } = await this.model.run({ prompt, sessionId, resume }));
    } catch (error) {
      if (error instanceof TutorUnavailableError) {
        throw new ServiceUnavailableException({
          error: 'tutor_unavailable',
          message: error.message,
        });
      }
      if (error instanceof TutorInvalidReplyError) {
        throw new BadGatewayException({ error: 'tutor_invalid_reply', message: error.message });
      }
      throw error;
    }
    this.sessions.set(sessionId, userId);

    const reply = parseTutorReply(output);
    if (typeof reply === 'string') {
      throw new BadGatewayException({ error: 'tutor_invalid_reply', message: reply });
    }

    // A generated exercise counts only when the engine asked for one, and at the engine's b (D5).
    if (reply.ejercicioGenerado) {
      if (generateAt !== null) {
        current = {
          exerciseId: `${ref.noteCode}#gen-${randomBytes(4).toString('hex')}`,
          source: 'generado',
          noteCode: ref.noteCode,
          section: ref.section,
          kind: null,
          b: generateAt,
          title: null,
          statement: reply.ejercicioGenerado.enunciado,
          answer: reply.ejercicioGenerado.respuesta || null,
          hint: null,
        };
        generateAt = null;
      } else {
        warnings.push('Claude propuso un ejercicio nuevo sin que el motor lo pidiera; se ignoró.');
      }
    }

    let attempt: TutorTurnResult['attempt'] = null;
    let after: GameState = before;
    if (reply.calificacion) {
      if (!current || reply.calificacion.exerciseId !== current.exerciseId) {
        throw new BadGatewayException({
          error: 'tutor_invalid_reply',
          message: `Claude calificó ${reply.calificacion.exerciseId}, pero el ejercicio en la mesa es ${current?.exerciseId ?? 'ninguno'}`,
        });
      }
      const graded: ExerciseAttemptInput & { generatedStatement: string | null; feedback: string } =
        {
          id: randomUUID(),
          exerciseId: current.exerciseId,
          exerciseSource: current.source,
          noteCode: current.noteCode,
          section: current.section,
          b: current.b,
          r: reply.calificacion.r,
          hints: reply.calificacion.pistas,
          minutes: null,
          gradedBy: 'claude',
          supersedes: null,
          occurredAt: new Date().toISOString(),
          generatedStatement: current.source === 'generado' ? current.statement : null,
          feedback: reply.calificacion.justificacion,
        };
      // Through the sync service, so it is the same idempotent create and other devices re-pull.
      await this.sync.processBatch(userId, deviceId, {
        exerciseAttempts: [
          {
            ...graded,
            studyTaskId: dto.studyTaskId ?? null,
            pomodoroSessionId: dto.pomodoroSessionId ?? null,
          },
        ],
      } as SyncBatchDto);

      after = await this.game.state(userId, catalog);
      const outcome = after.outcomes.find((o) => o.attemptId === graded.id);
      attempt = {
        id: graded.id,
        exerciseId: graded.exerciseId,
        exerciseSource: graded.exerciseSource,
        noteCode: graded.noteCode,
        section: graded.section,
        b: graded.b,
        r: graded.r,
        hints: graded.hints,
        minutes: graded.minutes,
        gradedBy: graded.gradedBy,
        supersedes: graded.supersedes,
        occurredAt: graded.occurredAt,
        xpGained: outcome?.xp ?? 0,
        thetaBefore: outcome?.thetaBefore ?? view.theta,
        thetaAfter: outcome?.thetaAfter ?? view.theta,
      };

      const next = this.game.next(after, catalog, ref);
      current = next.type === 'catalog' ? fromCatalog(next.exercise) : null;
      generateAt = next.type === 'generate' ? next.targetB : null;
    }

    const game = this.game.view(after, ref);
    return {
      sessionId,
      mensaje: reply.mensaje,
      accion: reply.accion,
      current,
      generateAt,
      attempt,
      game,
      warnings,
      durationMs,
    };
  }

  /** The exercise the client says is on the table: a catalog id of this section, or a generated one. */
  private resolveCurrent(dto: TutorTurnDto, catalog: Catalog): TutorExercise {
    const sent = dto.current!;
    if (sent.source === 'nota') {
      const exercise = catalog.exercises.find((e) => e.id === sent.exerciseId);
      if (!exercise || exercise.noteCode !== dto.noteCode || exercise.section !== dto.section) {
        throw new BadRequestException(
          `${sent.exerciseId} no es un ejercicio de ${dto.noteCode} §${dto.section}`,
        );
      }
      return fromCatalog(exercise);
    }
    if (
      !sent.exerciseId.startsWith(`${dto.noteCode}#gen-`) ||
      sent.b === undefined ||
      !sent.statement
    ) {
      throw new BadRequestException('Un ejercicio generado necesita su id, su b y su enunciado');
    }
    return {
      exerciseId: sent.exerciseId,
      source: 'generado',
      noteCode: dto.noteCode,
      section: dto.section,
      kind: null,
      b: sent.b,
      title: null,
      statement: sent.statement,
      answer: sent.answer ?? null,
      hint: null,
    };
  }

  private async studySessionTitle(userId: string, taskId: string): Promise<string | null> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { title: true },
    });
    return task?.title ?? null;
  }
}
