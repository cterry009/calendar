import { useEffect, useMemo, useState } from 'react';
import {
  DYNAMIC_QUESTION,
  DYNAMIC_REASONS,
  dueFixedSlot,
  dynamicReason,
  localDateKey,
  MORNING_EXERCISE_BY_WEEKDAY,
  type DynamicReason,
} from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { sendCheckIn } from '../../lib/checkins/api';
import { useGameBreak } from '../../lib/checkins/gameBreakStore';
import { isDesktop } from '../../lib/desktop';
import { notifySystem } from '../../lib/desktop/notify';

// 2026-11-10: the day's check-ins. Fixed ones at 9, 11, 13, 15 and 17 (weekdays); dynamic ones when a
// WORK block runs 20 min without a pomodoro or games drift into work time. Everything is decided here
// from data the app already has (checked once a minute); only the answer goes to the server.

interface DayState {
  day: string;
  answered: number[];
  lastPromptAt: number | null;
  dynamicCount: number;
  lastEnergy: number | null;
}
type Prompt = { kind: 'fijo'; slot: number } | { kind: 'dinamico'; reason: DynamicReason };

const KEY = 'calendar.checkins.day';

function load(): DayState {
  const day = localDateKey(new Date());
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as DayState | null;
    if (v && v.day === day) return v;
    return { day, answered: [], lastPromptAt: null, dynamicCount: 0, lastEnergy: v?.lastEnergy ?? null };
  } catch {
    return { day, answered: [], lastPromptAt: null, dynamicCount: 0, lastEnergy: null };
  }
}
function save(s: DayState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* per device */
  }
}

export function CheckInPrompt() {
  const data = useCalendarData();
  const pomodoro = usePomodoro();
  const gameBreak = useGameBreak();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [energy, setEnergy] = useState(60);
  const [napped, setNapped] = useState<boolean | null>(null);
  const [intensity, setIntensity] = useState<'suave' | 'medio' | 'muy-intenso' | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [progress, setProgress] = useState(50);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // The WORK block running now and whether any focus ran in it.
  const block = useMemo(() => {
    const wd = now.getDay();
    const min = now.getHours() * 60 + now.getMinutes();
    const s = data.schedules.find((x) => x.enabled && x.kind === 'WORK' && x.daysOfWeek.includes(wd) && x.startMinute <= min && min < x.endMinute);
    if (!s) return null;
    const start = new Date(now);
    start.setHours(Math.floor(s.startMinute / 60), s.startMinute % 60, 0, 0);
    const focused =
      data.pomodoroSessions.some((p) => p.startedAt && new Date(p.startedAt) >= start) ||
      (!!pomodoro.session?.startedAt && new Date(pomodoro.session.startedAt) >= start);
    return { minutesInto: min - s.startMinute, focused };
  }, [data.schedules, data.pomodoroSessions, pomodoro.session?.startedAt, now]);

  useEffect(() => {
    if (prompt) return;
    const s = load();
    const slot = dueFixedSlot(now, new Set(s.answered));
    let next: Prompt | null = null;
    if (slot !== null && !pomodoro.isBlocking) next = { kind: 'fijo', slot };
    else {
      const r = dynamicReason({
        minutesIntoBlock: block?.minutesInto ?? null,
        focusedInBlock: block?.focused ?? true,
        recentGameMinutes: gameBreak.recentWorkGameMinutes,
        minutesSinceLastPrompt: s.lastPromptAt ? Math.floor((Date.now() - s.lastPromptAt) / 60_000) : null,
        dynamicPromptsToday: s.dynamicCount,
        inFocus: pomodoro.isBlocking,
      });
      if (r) next = { kind: 'dinamico', reason: r };
    }
    if (!next) return;
    save({ ...s, lastPromptAt: Date.now(), dynamicCount: s.dynamicCount + (next.kind === 'dinamico' ? 1 : 0) });
    setEnergy(s.lastEnergy ?? 60);
    setNapped(null);
    setIntensity(null);
    setReason(null);
    setProgress(50);
    setPrompt(next);
    if (isDesktop) void notifySystem('¿Cómo vas?', next.kind === 'fijo' ? 'Registro de energía' : DYNAMIC_QUESTION[next.reason]);
  }, [now, prompt, block, gameBreak.recentWorkGameMinutes, pomodoro.isBlocking]);

  function close(answered: boolean, slot?: number) {
    const s = load();
    save({
      ...s,
      answered: slot !== undefined ? [...new Set([...s.answered, slot])] : s.answered,
      lastEnergy: answered ? energy : s.lastEnergy,
    });
    setPrompt(null);
  }

  async function submit() {
    if (!prompt) return;
    setSending(true);
    await sendCheckIn({
      clientId: crypto.randomUUID(),
      at: new Date().toISOString(),
      kind: prompt.kind,
      energy,
      napped: napped ?? undefined,
      exerciseIntensity: intensity ?? undefined,
      progress: prompt.kind === 'dinamico' ? progress : undefined,
      reason: prompt.kind === 'dinamico' ? (reason ?? undefined) : undefined,
    });
    setSending(false);
    close(true, prompt.kind === 'fijo' ? prompt.slot : undefined);
  }

  if (!prompt) return null;
  const firstOfDay = prompt.kind === 'fijo' && prompt.slot === 9;
  const exerciseDay = ['trote', 'rutina'].includes(MORNING_EXERCISE_BY_WEEKDAY[now.getDay()]);

  return (
    <YStack
      position="fixed"
      right={20}
      bottom={20}
      zIndex={9000}
      width={340}
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$accent"
      borderRadius="$4"
      padding="$4"
      gap="$3"
      shadowColor="$shadowColor"
      shadowRadius={18}
      role="dialog"
      aria-label="Registro"
    >
      <Text fontWeight="700">{prompt.kind === 'fijo' ? `Registro de las ${prompt.slot}:00` : DYNAMIC_QUESTION[prompt.reason]}</Text>
      <YStack gap="$1">
        <XStack justifyContent="space-between">
          <Text fontSize="$2" color="$muted">
            Energía (0–100)
          </Text>
          <Text fontWeight="700">{energy}</Text>
        </XStack>
        <input type="range" min={0} max={100} step={5} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} aria-label="Energía" />
      </YStack>
      {!firstOfDay ? (
        <XStack gap="$2" alignItems="center">
          <Text fontSize="$2" flex={1}>
            ¿Dormiste desde el último registro?
          </Text>
          {([true, false] as const).map((v) => (
            <AppButton key={String(v)} size="$2" variant={napped === v ? 'primary' : 'ghost'} onPress={() => setNapped(v)}>
              {v ? 'Sí' : 'No'}
            </AppButton>
          ))}
        </XStack>
      ) : null}
      {firstOfDay && exerciseDay ? (
        <YStack gap="$1">
          <Text fontSize="$2">¿Qué tal la sesión de ejercicio?</Text>
          <XStack gap="$1" flexWrap="wrap">
            {(['suave', 'medio', 'muy-intenso'] as const).map((v) => (
              <AppButton key={v} size="$2" variant={intensity === v ? 'primary' : 'ghost'} onPress={() => setIntensity(v)}>
                {v === 'muy-intenso' ? 'Muy intenso' : v[0].toUpperCase() + v.slice(1)}
              </AppButton>
            ))}
          </XStack>
        </YStack>
      ) : null}
      {prompt.kind === 'dinamico' ? (
        <YStack gap="$2">
          <XStack gap="$1" flexWrap="wrap">
            {DYNAMIC_REASONS.map((r) => (
              <AppButton key={r} size="$2" variant={reason === r ? 'primary' : 'ghost'} onPress={() => setReason(r)}>
                {r}
              </AppButton>
            ))}
          </XStack>
          <YStack gap="$1">
            <XStack justifyContent="space-between">
              <Text fontSize="$2" color="$muted">
                ¿Cuánto llevas de lo que tenías en este bloque?
              </Text>
              <Text fontWeight="700">{progress} %</Text>
            </XStack>
            <input type="range" min={0} max={100} step={10} value={progress} onChange={(e) => setProgress(Number(e.target.value))} aria-label="Avance del bloque" />
          </YStack>
        </YStack>
      ) : null}
      <XStack gap="$2" justifyContent="flex-end">
        <AppButton variant="ghost" size="$3" disabled={sending} onPress={() => close(false, prompt.kind === 'fijo' ? prompt.slot : undefined)}>
          Ahora no
        </AppButton>
        <AppButton variant="primary" size="$3" disabled={sending} onPress={() => void submit()}>
          Guardar
        </AppButton>
      </XStack>
      {prompt.kind === 'dinamico' ? (
        <Paragraph margin={0} size="$1" color="$muted">
          No es un regaño: sirve para ver en qué momentos el plan no encaja.
        </Paragraph>
      ) : null}
    </YStack>
  );
}
