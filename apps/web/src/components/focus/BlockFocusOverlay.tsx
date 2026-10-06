import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import {
  BLOCK_EXIT_REASONS,
  BLOCK_RATINGS,
  BLOCK_REVIEW_TAGS,
  describeOccurrence,
  finishPomodoroPhrase,
  localDayKey,
  nextBlockOccurrence,
  studyLineOf,
  studySessionLine,
} from '@calendar/shared';
import { usePomodoro } from '../../context/PomodoroContext';
import { useSchedules } from '../../hooks/useSchedules';
import { useTasks } from '../../hooks/useTasks';
import { isDesktop } from '../../lib/desktop';
import { logFocusEvent } from '../../lib/focusEvents/log';
import { syncBatch } from '../../lib/offline/sync-client';
import { formatTimer } from '../../lib/pomodoro/timer';

// A WORK block's pomodoro on the PC (user-requested, 2026-10-06/07):
// - While it runs, nothing comes up over other apps -- that broke the concentration it's for. Inside
//   the app's own window a small pill shows the block, the time left and "Salir".
// - "Salir" asks why, then either "vuelvo en un rato" (the session pauses: time stops, the exit
//   counts; a bar offers "Volver al bloque") or "no hago este bloque" (the session ends, the block
//   is marked "no puedo" today with the reason, and its study session moves to the line's next
//   block by staying pending).
// - Once, at its end, the window comes to the front asking how it went: a 1-5 rating, what applied,
//   a comment, and for a study block whether the session got done. Logged as a CHECK_IN event.

async function setOnTop(show: boolean) {
  if (!isDesktop) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('focus_overlay', { show });
  } catch {
    // Older desktop build: the card still shows inside the window.
  }
}

const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9999,
  backgroundColor: 'rgba(18, 21, 27, 0.94)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '$6',
} as const;

const cardStyle = {
  width: '100%',
  maxWidth: 600,
  borderWidth: 2,
  borderColor: '$accent',
  borderRadius: '$8',
  backgroundColor: 'rgba(33, 40, 54, 0.96)',
  padding: '$6',
  gap: '$3',
} as const;

const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent',
  color: 'inherit',
  fontSize: 15,
  fontFamily: 'inherit',
} as const;

interface EndedBlock {
  scheduleId: string;
  taskId: string | null;
}

export function BlockFocusOverlay() {
  const pomodoro = usePomodoro();
  const { schedules } = useSchedules();
  const { tasks, completeTask } = useTasks();
  const session = pomodoro.session;
  const inBlock = !!session?.active && !!session.scheduleId;
  const isOut = inBlock && !!session?.pausedAt;
  const [askingWhy, setAskingWhy] = useState(false);
  const [reason, setReason] = useState('');
  const [ended, setEnded] = useState<EndedBlock | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [sessionDone, setSessionDone] = useState<boolean | null>(null);

  // The block reached its end (not given up): ask how it went, once.
  const previous = useRef(session);
  useEffect(() => {
    const before = previous.current;
    previous.current = session;
    if (!before?.active || !before.scheduleId || !session) return;
    if (session.id !== before.id || session.active || session.interrupted) return;
    setEnded({ scheduleId: before.scheduleId, taskId: before.taskId ?? null });
    setRating(null);
    setTags([]);
    setComment('');
    setSessionDone(null);
  }, [session]);

  useEffect(() => {
    void setOnTop(!!ended);
  }, [ended]);

  if (typeof document === 'undefined') return null;

  if (ended) {
    const schedule = schedules.find((s) => s.id === ended.scheduleId);
    const task = ended.taskId ? tasks.find((t) => t.id === ended.taskId) : null;
    const studyTask = task && studyLineOf(task) && task.status !== 'COMPLETED' ? task : null;
    const toggleTag = (tag: string) => setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
    const finish = (save: boolean) => {
      if (save && rating) {
        logFocusEvent({
          kind: 'CHECK_IN',
          scheduleId: ended.scheduleId,
          taskId: ended.taskId ?? undefined,
          value: rating,
          meta: { review: true, rating, tags, comment: comment.trim() || undefined, sessionDone: sessionDone ?? undefined, device: 'desktop' },
        });
        if (studyTask && sessionDone) void completeTask(studyTask, studyTask.estimatedMinutes);
      }
      setEnded(null);
    };
    return createPortal(
      <YStack {...overlayStyle}>
        <YStack {...cardStyle}>
          <Text color="$accent" fontWeight="700" textTransform="uppercase" letterSpacing={1}>
            Terminó el bloque
          </Text>
          <Text fontSize="$7" fontWeight="800">
            ¿Cómo te fue?
          </Text>
          <Paragraph margin={0} color="$muted">
            {schedule?.label ?? 'Bloque de trabajo'}
          </Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {BLOCK_RATINGS.map((option) => (
              <AppButton key={option.value} variant={rating === option.value ? 'primary' : 'ghost'} onPress={() => setRating(option.value)}>
                {`${option.value} · ${option.label}`}
              </AppButton>
            ))}
          </XStack>
          <Text fontWeight="700">¿Qué pasó?</Text>
          <XStack gap="$2" flexWrap="wrap">
            {BLOCK_REVIEW_TAGS.map((tag) => (
              <AppButton key={tag} variant={tags.includes(tag) ? 'primary' : 'ghost'} onPress={() => toggleTag(tag)}>
                {tag}
              </AppButton>
            ))}
          </XStack>
          {studyTask ? (
            <>
              <Text fontWeight="700">¿Completaste la sesión «{studyTask.title}»?</Text>
              <XStack gap="$2" flexWrap="wrap">
                <AppButton variant={sessionDone === true ? 'primary' : 'ghost'} onPress={() => setSessionDone(true)}>
                  Sí, completada
                </AppButton>
                <AppButton variant={sessionDone === false ? 'primary' : 'ghost'} onPress={() => setSessionDone(false)}>
                  No, pasa al próximo bloque
                </AppButton>
              </XStack>
            </>
          ) : null}
          <Text fontWeight="700">¿Qué pudo haber sido mejor?</Text>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario (opcional)" rows={3} style={inputStyle} />
          <XStack gap="$3" marginTop="$2" justifyContent="flex-end">
            <AppButton variant="ghost" onPress={() => finish(false)}>
              Ahora no
            </AppButton>
            <AppButton variant="primary" disabled={!rating} onPress={() => finish(true)}>
              Guardar
            </AppButton>
          </XStack>
        </YStack>
      </YStack>,
      document.body,
    );
  }

  if (!inBlock || !session) return null;

  const schedule = schedules.find((s) => s.id === session.scheduleId);
  const task = session.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const exits = session.exitCount ?? 0;
  const remaining = pomodoro.remainingSeconds;
  const phraseSeed = `${session.id}:${session.completedCycles}:${session.state}`;
  const exitsLabel = exits === 0 ? 'Sin salidas en este bloque' : `Saliste ${exits} ${exits === 1 ? 'vez' : 'veces'} de este bloque`;
  const next = schedule ? nextBlockOccurrence(schedule, new Date()) : null;

  async function leave(reschedule: boolean) {
    if (!session?.scheduleId) return;
    const trimmed = reason.trim() || undefined;
    const scheduleId = session.scheduleId;
    setAskingWhy(false);
    setReason('');
    if (reschedule) {
      await pomodoro.cancel();
      const now = new Date();
      await syncBatch({
        scheduleCompletions: [
          { clientId: crypto.randomUUID(), updatedAt: now.toISOString(), scheduleId, date: localDayKey(now), status: 'SKIPPED', reason: trimmed ?? null },
        ],
      }).catch(() => undefined);
    } else {
      await pomodoro.pause();
    }
    logFocusEvent({
      kind: 'BLOCK_EXIT_REASON',
      scheduleId,
      pomodoroSessionId: session.id,
      taskId: session.taskId ?? undefined,
      meta: { reason: trimmed, rescheduled: reschedule, nextAt: reschedule ? next?.toISOString() : undefined, device: 'desktop' },
    });
  }

  if (isOut) {
    return createPortal(
      <XStack
        position="fixed"
        bottom={16}
        right={16}
        zIndex={9998}
        gap="$3"
        alignItems="center"
        padding="$3"
        borderRadius="$6"
        backgroundColor="rgba(33, 40, 54, 0.96)"
        borderWidth={1}
        borderColor="rgba(224,184,74,0.6)"
      >
        <YStack>
          <Text fontWeight="700">Fuera del bloque · el tiempo no cuenta</Text>
          <Text fontSize="$2" color="$muted">
            {schedule?.label ?? 'Bloque de trabajo'} · {exitsLabel}
          </Text>
          <Text fontSize="$2">
            Te faltan <Text fontWeight="700">{formatTimer(remaining)}</Text> de este pomodoro
          </Text>
          <Text fontSize="$2" color="$accent">
            {finishPomodoroPhrase(remaining / 60, phraseSeed, true)}
          </Text>
        </YStack>
        <AppButton variant="primary" disabled={pomodoro.isMutating} onPress={() => void pomodoro.resume()}>
          Volver al bloque
        </AppButton>
      </XStack>,
      document.body,
    );
  }

  if (askingWhy) {
    return createPortal(
      <YStack {...overlayStyle}>
        <YStack {...cardStyle}>
          <Text fontSize="$6" fontWeight="800">
            Salir del bloque
          </Text>
          <Paragraph margin={0} color="$muted">
            {schedule?.label ?? 'Bloque de trabajo'}
            {task ? ` · ${task.title}` : ''}
          </Paragraph>
          <Text fontWeight="700">¿Por qué?</Text>
          <XStack gap="$2" flexWrap="wrap">
            {BLOCK_EXIT_REASONS.map((option) => (
              <AppButton key={option} variant={reason === option ? 'primary' : 'ghost'} onPress={() => setReason(option)}>
                {option}
              </AppButton>
            ))}
          </XStack>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="O escribe el motivo (opcional)" style={inputStyle} />
          <XStack gap="$3" flexWrap="wrap" marginTop="$2">
            <AppButton variant="primary" disabled={pomodoro.isMutating} onPress={() => void leave(false)}>
              Vuelvo en un rato (pausa el tiempo)
            </AppButton>
            <AppButton variant="ghost" disabled={pomodoro.isMutating} onPress={() => void leave(true)}>
              No hago este bloque hoy (reprogramar)
            </AppButton>
            <AppButton variant="ghost" onPress={() => setAskingWhy(false)}>
              Seguir en el bloque
            </AppButton>
          </XStack>
          <Paragraph margin={0} color="$muted" fontSize="$2">
            {task
              ? `Si lo reprogramas, «${task.title}» queda pendiente y pasa al próximo bloque${next ? `: ${describeOccurrence(next)}` : ''}.`
              : `Si lo reprogramas, el bloque queda como "no puedo" hoy${next ? ` y vuelve ${describeOccurrence(next)}` : ''}.`}
          </Paragraph>
        </YStack>
      </YStack>,
      document.body,
    );
  }

  // Running: a quiet pill inside the app's window only -- never over other apps.
  return createPortal(
    <XStack
      position="fixed"
      bottom={16}
      right={16}
      zIndex={9998}
      gap="$3"
      alignItems="center"
      paddingVertical="$2"
      paddingHorizontal="$3"
      borderRadius="$6"
      backgroundColor="rgba(33, 40, 54, 0.92)"
      borderWidth={1}
      borderColor="rgba(78,224,160,0.5)"
    >
      <YStack>
        <Text fontWeight="700" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatTimer(remaining)} · {schedule?.label ?? 'Bloque de trabajo'}
        </Text>
        {task ? (
          <Text fontSize="$2" color="$muted">
            {studySessionLine(task, session)}
          </Text>
        ) : null}
      </YStack>
      <AppButton variant="ghost" disabled={pomodoro.isMutating} onPress={() => setAskingWhy(true)}>
        Salir
      </AppButton>
    </XStack>,
    document.body,
  );
}
