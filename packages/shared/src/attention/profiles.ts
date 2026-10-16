import type { SequenceSegment } from '../plan/sequence.js';

// Attention profiles (docs/planning/normas-de-atencion.md). A task is rated on two observable
// traits, 0-3 each: R, how costly it is to get back into it after a pause, and C, how many ideas it
// needs held at once. A fixed table turns (R, C) into one of three profiles, so a model only ever
// classifies -- the minutes come from here.

export const ATTENTION_PROFILES = ['MECHANICAL', 'LIGHT', 'DEEP'] as const;
export type AttentionProfile = (typeof ATTENTION_PROFILES)[number];

export interface AttentionProfileSpec {
  /** Spanish name shown to the user. */
  name: string;
  focusMin: number;
  breakMin: number;
  /** How long a block of this profile lasts, from its scheduled start. */
  blockMin: number;
}

// Set by the user (2026-10-01): mechanical work gets a shorter, 60-minute block; light and deep
// work fill the 90-minute blocks. All three divide their block exactly.
export const ATTENTION_PROFILE_SPECS: Record<AttentionProfile, AttentionProfileSpec> = {
  MECHANICAL: { name: 'Mecánico', focusMin: 15, breakMin: 5, blockMin: 60 },
  LIGHT: { name: 'Ligero', focusMin: 25, breakMin: 5, blockMin: 90 },
  DEEP: { name: 'Profundo', focusMin: 40, breakMin: 5, blockMin: 90 },
};

/** Profile used when a block has no rated task in it. */
export const DEFAULT_ATTENTION_PROFILE: AttentionProfile = 'LIGHT';

/** A trimmed last pomodoro shorter than this isn't worth starting; the block ends on a break. */
export const MIN_TRIMMED_FOCUS_MIN = 10;

// Rows are R (reentry cost), columns C (mental load).
const PROFILE_TABLE: AttentionProfile[][] = [
  ['MECHANICAL', 'MECHANICAL', 'LIGHT', 'LIGHT'],
  ['MECHANICAL', 'LIGHT', 'LIGHT', 'LIGHT'],
  ['LIGHT', 'LIGHT', 'LIGHT', 'DEEP'],
  ['LIGHT', 'DEEP', 'DEEP', 'DEEP'],
];

export function attentionProfileFor(reentry: number, load: number): AttentionProfile {
  const clamp = (n: number) => Math.min(3, Math.max(0, Math.round(n)));
  return PROFILE_TABLE[clamp(reentry)][clamp(load)];
}

/** A block takes the profile of its most demanding task (the one that goes first). */
export function blockAttentionProfile(profiles: Array<AttentionProfile | null | undefined>): AttentionProfile {
  const rated = profiles.filter((p): p is AttentionProfile => !!p);
  if (rated.length === 0) return DEFAULT_ATTENTION_PROFILE;
  return rated.reduce((a, b) => (ATTENTION_PROFILES.indexOf(b) > ATTENTION_PROFILES.indexOf(a) ? b : a));
}

/** Where a block of this profile ends: its own length from the start, never past the schedule's end. */
export function profileBlockEndMinute(profile: AttentionProfile, startMinute: number, scheduleEndMinute: number): number {
  return Math.min(scheduleEndMinute, startMinute + ATTENTION_PROFILE_SPECS[profile].blockMin);
}

export interface AttentionSegment {
  type: 'focus' | 'break';
  startMinute: number;
  endMinute: number;
  /** A focus segment cut short by the block's end. */
  trimmed: boolean;
}

/**
 * Splits [startMinute, endMinute) into focus/break segments for a profile. Pomodoro and break
 * alternate; the block ends at its fixed time, so the last pomodoro is trimmed to what's left, or
 * skipped when that's under MIN_TRIMMED_FOCUS_MIN. Starting late is the same call with a later
 * start: fewer pomodoros, same end.
 */
export function attentionBlockPlan(profile: AttentionProfile, startMinute: number, endMinute: number): AttentionSegment[] {
  const { focusMin, breakMin } = ATTENTION_PROFILE_SPECS[profile];
  const segments: AttentionSegment[] = [];
  let t = startMinute;
  while (endMinute - t >= MIN_TRIMMED_FOCUS_MIN) {
    const focusEnd = Math.min(t + focusMin, endMinute);
    segments.push({ type: 'focus', startMinute: t, endMinute: focusEnd, trimmed: focusEnd - t < focusMin });
    t = focusEnd;
    if (t >= endMinute) break;
    const breakEnd = Math.min(t + breakMin, endMinute);
    segments.push({ type: 'break', startMinute: t, endMinute: breakEnd, trimmed: false });
    t = breakEnd;
  }
  if (t < endMinute) segments.push({ type: 'break', startMinute: t, endMinute, trimmed: false });
  return segments;
}

export function focusMinutes(segments: AttentionSegment[]): number {
  return segments.filter((s) => s.type === 'focus').reduce((n, s) => n + s.endMinute - s.startMinute, 0);
}

/** The fields of a task that decide which block it's in and how demanding that block is. */
export interface BlockTaskLike {
  scheduledAt: string | null;
  status: string;
  deletedAt?: string | null;
  attentionProfile?: AttentionProfile | null;
}

export interface BlockOnDay<T extends BlockTaskLike> {
  /** The block's pomodoro sequence (horario 2026-10-19), unlabelled; null when it has none. */
  sequence?: SequenceSegment[] | null;
  startAt: Date;
  /** The block's real end: 60 minutes for a mechanical one, the schedule's end otherwise. */
  endAt: Date;
  /** Pending tasks placed in the block that day, in calendar order. */
  tasks: T[];
  profile: AttentionProfile;
  /** The pomodoro and break the block runs with. */
  focusMin: number;
  breakMin: number;
  /**
   * Where those come from: the rated tasks in it (their profile), the block's own configuration
   * (pomodoroMin / shortBreakMin, what the calendar draws), or the default profile.
   */
  timingSource: 'tasks' | 'schedule' | 'default' | 'sequence';
}

/** The profile whose pomodoro is closest to a configured one, for naming it. */
function profileForFocusMinutes(focusMin: number): AttentionProfile {
  if (focusMin >= ATTENTION_PROFILE_SPECS.DEEP.focusMin) return 'DEEP';
  if (focusMin <= ATTENTION_PROFILE_SPECS.MECHANICAL.focusMin) return 'MECHANICAL';
  return 'LIGHT';
}

/**
 * A WORK schedule on a given local day: its tasks, its pomodoro and its real end (device time).
 * Rated tasks in the block decide (their attention profile); without any, the block's own
 * configuration does -- found 2026-10-06: blocks configured 40/10 ran 25/5 because no task had been
 * placed in them yet.
 */
export function blockOnDay<T extends BlockTaskLike>(
  block: {
    startMinute: number;
    endMinute: number;
    pomodoroMin?: number | null;
    shortBreakMin?: number | null;
    sequence?: SequenceSegment[] | null;
  },
  tasks: T[],
  day: Date,
): BlockOnDay<T> {
  const at = (minute: number) => {
    const d = new Date(day);
    d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    return d;
  };
  const startAt = at(block.startMinute);
  const scheduleEnd = at(block.endMinute).getTime();
  const inBlock = tasks
    .filter((t) => t.scheduledAt && !t.deletedAt && (t.status === 'PENDING' || t.status === 'IN_PROGRESS'))
    .filter((t) => {
      const time = new Date(t.scheduledAt!).getTime();
      return time >= startAt.getTime() && time < scheduleEnd;
    })
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
  const rated = inBlock.some((t) => !!t.attentionProfile);
  // A block with its own sequence runs it, whatever its tasks are: the timetable decided the
  // stretches, and the block always ends at its fixed time.
  if (block.sequence?.length) {
    const focusMin = block.sequence.find((s) => s.tipo === 'foco')?.minutos ?? ATTENTION_PROFILE_SPECS.LIGHT.focusMin;
    return {
      startAt,
      endAt: at(block.endMinute),
      tasks: inBlock,
      profile: rated ? blockAttentionProfile(inBlock.map((t) => t.attentionProfile)) : profileForFocusMinutes(focusMin),
      focusMin,
      breakMin: block.sequence.find((s) => s.tipo === 'pausa')?.minutos ?? ATTENTION_PROFILE_SPECS.LIGHT.breakMin,
      timingSource: 'sequence',
      sequence: block.sequence,
    };
  }
  if (!rated && block.pomodoroMin) {
    const focusMin = block.pomodoroMin;
    return {
      startAt,
      endAt: at(block.endMinute),
      tasks: inBlock,
      profile: profileForFocusMinutes(focusMin),
      focusMin,
      breakMin: block.shortBreakMin ?? ATTENTION_PROFILE_SPECS.LIGHT.breakMin,
      timingSource: 'schedule',
    };
  }
  const profile = blockAttentionProfile(inBlock.map((t) => t.attentionProfile));
  const spec = ATTENTION_PROFILE_SPECS[profile];
  return {
    startAt,
    endAt: at(profileBlockEndMinute(profile, block.startMinute, block.endMinute)),
    tasks: inBlock,
    profile,
    focusMin: spec.focusMin,
    breakMin: spec.breakMin,
    timingSource: rated ? 'tasks' : 'default',
  };
}
