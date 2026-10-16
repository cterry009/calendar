import { currentSegment, sessionSegments } from '@calendar/shared';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';

// Horario 2026-10-19: a block with a pomodoro sequence shows all its segments at their clock
// times -- the pauses inside the morning block included -- with the running one highlighted, and
// "Cortar tramo" (regla de rescate) while a focus segment runs.

function clock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SequenceTimeline() {
  const { session, cutSegment, canCutSegment, isMutating } = usePomodoro();
  if (!session?.active || !session.blockStartAt) return null;
  const segments = sessionSegments(session);
  if (!segments) return null;
  const running = currentSegment(session);
  const blockStart = new Date(session.blockStartAt).getTime();

  return (
    <YStack gap="$2" width="100%">
      {segments.map((segment) => {
        const isCurrent = running?.index === segment.index;
        const isPast = running ? segment.index < running.index : false;
        return (
          <XStack
            key={segment.index}
            gap="$3"
            alignItems="center"
            paddingVertical="$1"
            paddingHorizontal="$2"
            borderRadius="$3"
            backgroundColor={isCurrent ? 'rgba(255,255,255,0.08)' : 'transparent'}
            opacity={isPast ? 0.5 : 1}
          >
            <Text fontSize="$2" color="$muted" width={92} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {clock(blockStart + segment.startOffset * 60_000)}-{clock(blockStart + segment.endOffset * 60_000)}
            </Text>
            <Text
              flex={1}
              fontSize="$3"
              fontWeight={isCurrent ? '800' : '400'}
              color={segment.tipo === 'pausa' ? '$muted' : '$color'}
            >
              {segment.etiqueta}
            </Text>
          </XStack>
        );
      })}
      {canCutSegment ? (
        <AppButton variant="ghost" disabled={isMutating} onPress={() => void cutSegment()}>
          Cortar tramo (ir a la pausa)
        </AppButton>
      ) : null}
      {(session.cutCount ?? 0) > 0 ? (
        <Text fontSize="$2" color="$muted">
          Tramos cortados en este bloque: {session.cutCount}
        </Text>
      ) : null}
    </YStack>
  );
}
