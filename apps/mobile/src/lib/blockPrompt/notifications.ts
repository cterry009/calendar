import { ATTENTION_PROFILE_SPECS } from '@calendar/shared';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SyncScheduleRecord, SyncTaskRecord } from '../calendar/types';
import { blockToday, localDateAt } from './block';

// A notification at the start of every WORK block asking whether to start it, with three actions.
// All three open the app: with opensAppToForeground false, a killed app never hears the answer
// (expo-notifications' own docs), and every answer is telemetry we want to keep.
//
// Scheduled per date, not weekly: what a block is depends on the tasks in it that day (a mechanical
// block lasts 60 minutes, the others the full window), so each prompt shows that day's profile,
// real end time and first task. The next DAYS_AHEAD days are rescheduled every time schedules or
// tasks change, or the app comes to the front.
export const BLOCK_PROMPT_CATEGORY = 'block-start';
export const BLOCK_PROMPT_START = 'start';
export const BLOCK_PROMPT_SNOOZE = 'snooze';
export const BLOCK_PROMPT_DECLINE = 'decline';
export const SNOOZE_MINUTES = 5;
const DAYS_AHEAD = 14;

/** The Friday block whose label says this is where the week gets planned. */
export const WEEKLY_PLAN_LABEL = /plan de la semana/i;

export interface BlockPromptData {
  kind: 'block-prompt';
  scheduleId: string;
  startMinute: number;
  endMinute: number;
  label: string | null;
  /** Times this prompt was already snoozed today. */
  snoozes: number;
}

export interface WeeklyPlanData {
  kind: 'weekly-plan';
}

export function isBlockPromptData(data: unknown): data is BlockPromptData {
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'block-prompt';
}

export function isWeeklyPlanData(data: unknown): data is WeeklyPlanData {
  return !!data && typeof data === 'object' && (data as { kind?: unknown }).kind === 'weekly-plan';
}

let categoryRegistered = false;

/**
 * Its own channel at high importance, so the prompt pops up over whatever is on screen with sound
 * (expo's fallback channel is default importance: it only lands silently in the shade, easy to
 * miss -- one reason the prompts went unseen, 2026-10-05).
 */
export const BLOCK_PROMPT_CHANNEL = 'block-prompts';

export async function ensureBlockPromptCategory(): Promise<void> {
  if (categoryRegistered) return;
  try {
    await Notifications.setNotificationChannelAsync(BLOCK_PROMPT_CHANNEL, {
      name: 'Inicio de bloques',
      description: 'Avisa al empezar cada bloque de trabajo para iniciarlo.',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationCategoryAsync(BLOCK_PROMPT_CATEGORY, [
      { identifier: BLOCK_PROMPT_START, buttonTitle: 'Iniciar' },
      { identifier: BLOCK_PROMPT_SNOOZE, buttonTitle: `En ${SNOOZE_MINUTES} min` },
      { identifier: BLOCK_PROMPT_DECLINE, buttonTitle: 'Hoy no' },
    ]);
    categoryRegistered = true;
  } catch {
    // No category support on web; left false so a real platform retries.
  }
}

const PREFIX = 'block-prompt-';
const SNOOZE_PREFIX = `${PREFIX}snooze-`;
const PLAN_PREFIX = 'weekly-plan-';

export function hhmm(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function content(data: BlockPromptData, body: string): Notifications.NotificationContentInput {
  return {
    title: data.label ?? 'Bloque de trabajo',
    body,
    categoryIdentifier: BLOCK_PROMPT_CATEGORY,
    data: { ...data },
  };
}

/** What the prompt says for a block on a given day: real hours, profile and first task. */
export function promptBody(schedule: SyncScheduleRecord, tasks: SyncTaskRecord[], day: Date): string {
  const block = blockToday({ scheduleId: schedule.id, startMinute: schedule.startMinute, endMinute: schedule.endMinute }, tasks, day);
  const end = block.endAt.getHours() * 60 + block.endAt.getMinutes();
  const first = block.tasks[0]?.title;
  return `${hhmm(schedule.startMinute)}-${hhmm(end)} · ${ATTENTION_PROFILE_SPECS[block.profile].name}${first ? ` · ${first}` : ''} · ¿Lo inicias?`;
}

/** Replaces every scheduled block prompt with one per WORK block over the next DAYS_AHEAD days. */
export async function scheduleBlockPrompts(schedules: SyncScheduleRecord[], tasks: SyncTaskRecord[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  // A notification posted to a channel that doesn't exist yet is silently dropped.
  await ensureBlockPromptCategory();

  const scheduled =await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      // A pending snooze stays: it's today's answer, not part of the schedule.
      .filter((n) => (n.identifier.startsWith(PREFIX) && !n.identifier.startsWith(SNOOZE_PREFIX)) || n.identifier.startsWith(PLAN_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );

  const now = new Date();
  const work = schedules.filter((s) => s.kind === 'WORK' && s.enabled);
  const jobs: Promise<unknown>[] = [];
  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    for (const s of work) {
      if (!s.daysOfWeek.includes(day.getDay())) continue;
      const at = localDateAt(s.startMinute, day);
      if (at.getTime() <= now.getTime()) continue;
      const data: BlockPromptData = { kind: 'block-prompt', scheduleId: s.id, startMinute: s.startMinute, endMinute: s.endMinute, label: s.label, snoozes: 0 };
      jobs.push(
        Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${s.id}-${dateKey(day)}`,
          content: content(data, promptBody(s, tasks, day)),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: BLOCK_PROMPT_CHANNEL },
        }),
      );
      // The week gets planned in the block the user's own rules reserve for it.
      if (s.label && WEEKLY_PLAN_LABEL.test(s.label)) {
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `${PLAN_PREFIX}${dateKey(day)}`,
            content: { title: 'Plan de la semana', body: 'Toca para que la IA arme tu próxima semana y la revises.', data: { kind: 'weekly-plan' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: BLOCK_PROMPT_CHANNEL },
          }),
        );
      }
    }
  }
  await Promise.all(jobs.map((j) => j.catch(() => undefined)));
}

/** The same prompt again in a few minutes. */
export async function snoozeBlockPrompt(data: BlockPromptData, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: `${SNOOZE_PREFIX}${data.scheduleId}`,
    content: content({ ...data, snoozes: data.snoozes + 1 }, body),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MINUTES * 60, channelId: BLOCK_PROMPT_CHANNEL },
  });
}
