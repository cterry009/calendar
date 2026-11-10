// The tutor's working set (2026-11-10, the user's idea): always five topics -- note sections -- in
// pensum order. He switches among them; once one reaches mastery he can retire it and the next
// unmastered topic of the pensum takes its place.

import { MASTERED_SECTION_LEVEL } from './model.js';

export const ACTIVE_TOPICS = 5;

export interface TopicRef {
  noteCode: string;
  section: string;
}

export interface TopicSet {
  active: TopicRef[];
  retired: TopicRef[];
}

export const topicKey = (t: TopicRef): string => `${t.noteCode}#${t.section}`;

/**
 * The working set after topping it up: the active topics still in the pensum, then the next ones in
 * pensum order that are neither active, retired nor already mastered, up to `size`.
 */
export function fillTopics(
  pensum: readonly TopicRef[],
  set: TopicSet,
  levelOf: (t: TopicRef) => number | undefined,
  size: number = ACTIVE_TOPICS,
): TopicSet {
  const inPensum = new Set(pensum.map(topicKey));
  const retired = new Set(set.retired.map(topicKey));
  const active = set.active.filter((t) => inPensum.has(topicKey(t)) && !retired.has(topicKey(t))).slice(0, size);
  const taken = new Set(active.map(topicKey));
  for (const t of pensum) {
    if (active.length >= size) break;
    const k = topicKey(t);
    if (taken.has(k) || retired.has(k)) continue;
    if ((levelOf(t) ?? 0) >= MASTERED_SECTION_LEVEL) continue;
    active.push(t);
    taken.add(k);
  }
  return { active, retired: set.retired };
}

/** Whether a topic may be retired: only once it reaches mastery. */
export function canRetire(level: number | undefined): boolean {
  return (level ?? 0) >= MASTERED_SECTION_LEVEL;
}

/** Retire a mastered topic and top the set up again. Unmastered topics are left as they are. */
export function retireTopic(
  pensum: readonly TopicRef[],
  set: TopicSet,
  topic: TopicRef,
  levelOf: (t: TopicRef) => number | undefined,
  size: number = ACTIVE_TOPICS,
): TopicSet {
  if (!canRetire(levelOf(topic))) return set;
  const k = topicKey(topic);
  return fillTopics(
    pensum,
    { active: set.active.filter((t) => topicKey(t) !== k), retired: [...set.retired.filter((t) => topicKey(t) !== k), topic] },
    levelOf,
    size,
  );
}

/**
 * Share of the way to mastery, 0-100: θ from 2 below the mastery threshold (empty) up to it (full).
 * The threshold is the θ where MASTERED_SECTION_LEVEL starts.
 */
export function masteryPercent(theta: number | undefined, thresholds: readonly number[]): number {
  const target = thresholds[MASTERED_SECTION_LEVEL - 2] ?? 0;
  if (theta === undefined) return 0;
  return Math.round(Math.max(0, Math.min(1, (theta - (target - 2)) / 2)) * 100);
}
