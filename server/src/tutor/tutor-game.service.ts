import { Injectable } from '@nestjs/common';
import {
  nextExercise,
  replay,
  sectionKey,
  sectionLevel,
  sectionTheta,
  type ExerciseAttemptInput,
  type GameState,
  type Grade,
  type NextExercise,
  type SectionRef,
} from '@calendar/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TutorCatalog, type Catalog } from './catalog';

export interface SectionGame {
  noteCode: string;
  section: string;
  theta: number;
  level: number;
  attempts: number;
  xp: number;
  globalLevel: number;
  combo: number;
  review: GameState['review'];
  bosses: GameState['notes'][string]['bosses'];
}

export interface SectionGameView extends SectionGame {
  next: NextExercise;
}

/**
 * The game as the clients see it: never stored, replayed from the user's attempts (study-tutor-game
 * D6) with the shared engine against the vault's catalog.
 */
@Injectable()
export class TutorGameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: TutorCatalog,
  ) {}

  loadCatalog(): Catalog {
    return this.catalog.load();
  }

  async state(userId: string, catalog: Catalog): Promise<GameState> {
    const rows = await this.prisma.exerciseAttempt.findMany({
      where: { userId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    const attempts: ExerciseAttemptInput[] = rows.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      exerciseSource: row.exerciseSource,
      noteCode: row.noteCode,
      section: row.section,
      b: row.b,
      r: row.r as Grade,
      hints: row.hints,
      minutes: row.minutes,
      gradedBy: row.gradedBy,
      supersedes: row.supersedes,
      occurredAt: row.occurredAt.toISOString(),
    }));
    return replay(attempts, catalog.exercises);
  }

  view(state: GameState, ref: SectionRef): SectionGame {
    const section = state.sections[sectionKey(ref.noteCode, ref.section)];
    const theta = sectionTheta(state, ref);
    return {
      noteCode: ref.noteCode,
      section: ref.section,
      theta,
      level: section?.level ?? sectionLevel(theta),
      attempts: section?.attempts ?? 0,
      xp: state.xp,
      globalLevel: state.level,
      combo: state.combo.streak,
      review: state.review.filter((r) => r.noteCode === ref.noteCode),
      bosses: state.notes[ref.noteCode]?.bosses ?? [],
    };
  }

  next(state: GameState, catalog: Catalog, ref: SectionRef): NextExercise {
    return nextExercise(state, catalog.exercises, ref);
  }

  async sectionView(userId: string, ref: SectionRef): Promise<SectionGameView> {
    const catalog = this.loadCatalog();
    const state = await this.state(userId, catalog);
    return { ...this.view(state, ref), next: this.next(state, catalog, ref) };
  }
}
