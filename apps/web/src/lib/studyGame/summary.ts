import { replay, xpForLevel, type ExerciseAttemptInput, type ReviewItem } from '@calendar/shared';

// The game read from the attempts alone (study-tutor-game D43, D44): replay doesn't need the
// catalog for θ, XP and levels, only for the bosses, which stay in the tutor panel.

export interface PomodoroTutorSummary {
  exercises: number;
  xp: number;
  /** θ of the first section touched, before the pomodoro's first attempt and after its last. */
  thetaFrom: number;
  thetaTo: number;
  sectionKey: string;
}

/** What the tutor did during one pomodoro session, or null if it wasn't used. */
export function pomodoroTutorSummary(
  attempts: readonly (ExerciseAttemptInput & { pomodoroSessionId?: string | null })[],
  pomodoroSessionId: string,
): PomodoroTutorSummary | null {
  const inPomodoro = new Set(
    attempts.filter((a) => a.pomodoroSessionId === pomodoroSessionId).map((a) => a.id),
  );
  if (!inPomodoro.size) return null;
  const outcomes = replay(attempts, []).outcomes.filter((o) => inPomodoro.has(o.attemptId));
  if (!outcomes.length) return null;
  const key = outcomes[0].sectionKey;
  const sameSection = outcomes.filter((o) => o.sectionKey === key);
  return {
    exercises: outcomes.length,
    xp: outcomes.reduce((sum, o) => sum + o.xp, 0),
    thetaFrom: sameSection[0].thetaBefore,
    thetaTo: sameSection[sameSection.length - 1].thetaAfter,
    sectionKey: key,
  };
}

export interface GameDashboard {
  xp: number;
  level: number;
  nextLevelXp: number;
  attempts: number;
  notes: {
    noteCode: string;
    sections: { section: string; theta: number; level: number; attempts: number }[];
  }[];
  review: ReviewItem[];
}

export function gameDashboard(attempts: readonly ExerciseAttemptInput[]): GameDashboard {
  const state = replay(attempts, []);
  const byNote = new Map<string, GameDashboard['notes'][number]['sections']>();
  for (const s of Object.values(state.sections)) {
    const list = byNote.get(s.noteCode) ?? [];
    list.push({ section: s.section, theta: s.theta, level: s.level, attempts: s.attempts });
    byNote.set(s.noteCode, list);
  }
  const collator = new Intl.Collator('es', { numeric: true });
  return {
    xp: state.xp,
    level: state.level,
    nextLevelXp: Math.ceil(xpForLevel(state.level + 1)),
    attempts: state.outcomes.length,
    notes: [...byNote.entries()]
      .sort(([a], [b]) => collator.compare(a, b))
      .map(([noteCode, sections]) => ({
        noteCode,
        sections: sections.sort((a, b) => collator.compare(a.section, b.section)),
      })),
    review: state.review,
  };
}
