// Matches "3 pomodoros", "2 poms", "1 pomodoro" -- the primary way to size a task, since the
// calendar already thinks in pomodoro blocks rather than raw minutes.
const POMODORO_COUNT_PATTERN = /(\d+)\s*(pomodoros?|poms?)\b/i;
// Falls back to an explicit duration like "45min", "1h", "2 horas" for people who'd rather type
// clock time than pomodoro count.
const DURATION_PATTERN = /(\d+)\s*(h|hr|horas?|m|min|mins?|minutos?)\b/i;

function stripMatch(text: string, match: RegExpExecArray): string {
  return `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim();
}

export interface ExtractedEstimate {
  title: string;
  // Null means no estimate was typed at all -- the caller decides whether to require one or
  // fall back to a default.
  estimatedMinutes: number | null;
  estimatedPomodoros: number | null;
}

/** Shared by the per-block QuickAddTask (calendar) and the global quick-add (anywhere, Q). */
export function extractEstimate(text: string, pomodoroLengthMin: number): ExtractedEstimate {
  const pomodoroMatch = POMODORO_COUNT_PATTERN.exec(text);
  if (pomodoroMatch) {
    const pomodoroCount = Math.max(1, Number(pomodoroMatch[1]));
    return {
      title: stripMatch(text, pomodoroMatch),
      estimatedMinutes: pomodoroCount * pomodoroLengthMin,
      estimatedPomodoros: pomodoroCount,
    };
  }

  const durationMatch = DURATION_PATTERN.exec(text);
  if (durationMatch) {
    const amount = Number(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    const estimatedMinutes = unit.startsWith('h') ? amount * 60 : amount;
    return {
      title: stripMatch(text, durationMatch),
      estimatedMinutes,
      // No exact pomodoro count was stated -- best-effort round-trip, same fallback used for
      // tasks that predate this field.
      estimatedPomodoros: Math.max(1, Math.round(estimatedMinutes / pomodoroLengthMin)),
    };
  }

  return { title: text.trim(), estimatedMinutes: null, estimatedPomodoros: null };
}
