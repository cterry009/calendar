import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import type { AgendaBlock } from '../../lib/calendar/dayAgenda';

const KIND_LABEL: Record<AgendaBlock['kind'], string> = {
  work: 'Trabajo',
  rest: 'Descanso',
  habit: 'Habito',
  task: 'Tarea',
};

// One line of "Horario de hoy": a work/rest block or a habit, with its own "hecho" toggle.
export function AgendaRow({
  block,
  busy,
  onToggle,
}: {
  block: AgendaBlock;
  busy: boolean;
  onToggle: (block: AgendaBlock) => void;
}) {
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <YStack width={4} alignSelf="stretch" borderRadius={2} backgroundColor={block.color} />
      <YStack flex={1} gap="$1" opacity={block.done ? 0.55 : 1}>
        <Text fontSize="$3" fontWeight="600">
          {block.done ? '✓ ' : ''}
          {block.title}
        </Text>
        <Text fontSize="$2" color="$muted">
          {KIND_LABEL[block.kind]} · {block.when}
        </Text>
      </YStack>
      {block.target ? (
        <AppButton variant={block.done ? 'primary' : 'ghost'} disabled={busy} onPress={() => onToggle(block)}>
          {block.done ? '✓' : 'Hecho'}
        </AppButton>
      ) : null}
    </XStack>
  );
}
