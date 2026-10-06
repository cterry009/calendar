import { BLOCK_EXIT_REASONS, blockOccurrenceKey, describeOccurrence, nextBlockOccurrence } from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { Input } from 'tamagui';
import { usePomodoro } from '../context/PomodoroContext';
import { useBlockExit } from '../hooks/useBlockFocus';
import { useCalendarData } from '../hooks/useCalendarData';
import { closeExitSheet, subscribeExitSheet, type ExitSheetRequest } from '../lib/blockPrompt/exitSheet';
import { markBlockExited } from '../lib/blockPrompt/exits';
import { markBlockSkipped } from '../lib/calendar/skips';
import { logFocusEvent } from '../lib/focusEvents/log';

// Leaving a WORK block (user-requested, 2026-10-07): why, and whether it's a short break or the block
// isn't happening today.
// - "Vuelvo en un rato": the session pauses (time stops, the exit counts) until "Volver".
// - "No hago este bloque": the session ends and the block is marked "no puedo" for today with the
//   reason; its study session stays pending, so it is the session of that line's next block.
// The reason is logged (BLOCK_EXIT_REASON) to follow how the study lines go.

export function BlockExitSheet() {
  const [request, setRequest] = useState<ExitSheetRequest | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { session, pause, cancel } = usePomodoro();
  const { schedules, tasks } = useCalendarData();
  const { comeBack } = useBlockExit();

  useEffect(() => subscribeExitSheet(setRequest), []);
  useEffect(() => {
    if (request) setReason('');
  }, [request]);

  const scheduleId = session?.scheduleId ?? null;
  const schedule = scheduleId ? schedules.find((s) => s.id === scheduleId) : null;
  const task = session?.taskId ? tasks.find((t) => t.id === session.taskId) : null;
  const next = schedule ? nextBlockOccurrence(schedule, new Date()) : null;
  const visible = !!request && !!session?.active && !!scheduleId;

  async function decide(reschedule: boolean) {
    if (!scheduleId || !request) return;
    setBusy(true);
    const now = new Date();
    const trimmed = reason.trim() || undefined;
    try {
      await markBlockExited(blockOccurrenceKey(scheduleId, now));
      if (reschedule) {
        await cancel();
        await markBlockSkipped(scheduleId, now, trimmed);
      } else if (!request.alreadyPaused && !session?.pausedAt) {
        await pause();
      }
      logFocusEvent({
        kind: 'BLOCK_EXIT_REASON',
        scheduleId,
        pomodoroSessionId: session?.id,
        taskId: session?.taskId ?? undefined,
        meta: { reason: trimmed, rescheduled: reschedule, nextAt: reschedule ? next?.toISOString() : undefined },
      });
    } finally {
      setBusy(false);
      closeExitSheet();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => closeExitSheet()}>
      <YStack flex={1} justifyContent="flex-end" backgroundColor="rgba(0,0,0,0.55)">
        <YStack backgroundColor="$background" padding="$5" gap="$3" borderTopLeftRadius="$6" borderTopRightRadius="$6">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Text fontSize="$6" fontWeight="700">
              Salir del bloque
            </Text>
            <Paragraph margin={0} color="$muted">
              {schedule?.label ?? 'Bloque de trabajo'}
              {task ? ` · ${task.title}` : ''}
            </Paragraph>

            <Text fontWeight="700">¿Por qué?</Text>
            <XStack flexWrap="wrap" gap="$2">
              {BLOCK_EXIT_REASONS.map((option) => (
                <Pressable key={option} onPress={() => setReason(option)}>
                  <Text
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                    borderRadius="$6"
                    borderWidth={1}
                    borderColor={reason === option ? '$accent' : '$borderColor'}
                    color={reason === option ? '$accent' : '$color'}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </XStack>
            <Input placeholder="O escribe el motivo (opcional)" value={reason} onChangeText={setReason} />

            <AppButton variant="primary" disabled={busy} onPress={() => void decide(false)}>
              Vuelvo en un rato (pausa el tiempo)
            </AppButton>
            <AppButton variant="ghost" disabled={busy} onPress={() => void decide(true)}>
              No hago este bloque hoy (reprogramar)
            </AppButton>
            <Paragraph margin={0} color="$muted" fontSize="$2">
              {task
                ? `Si lo reprogramas, «${task.title}» queda pendiente y pasa al próximo bloque${next ? `: ${describeOccurrence(next)}` : ''}.`
                : `Si lo reprogramas, el bloque queda como "no puedo" hoy${next ? ` y vuelve ${describeOccurrence(next)}` : ''}.`}
            </Paragraph>
            <AppButton
              variant="ghost"
              disabled={busy}
              onPress={() => {
                // Left on the overlay already: staying means coming back.
                if (request?.alreadyPaused || session?.pausedAt) void comeBack();
                closeExitSheet();
              }}
            >
              Seguir en el bloque
            </AppButton>
          </ScrollView>
        </YStack>
      </YStack>
    </Modal>
  );
}
