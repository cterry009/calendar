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
  onSkip,
}: {
  block: AgendaBlock;
  busy: boolean;
  onToggle: (block: AgendaBlock) => void;
  /** Work blocks: "no puedo hacer este bloque" (tap again to undo). */
  onSkip?: (block: AgendaBlock) => void;
}) {
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <YStack width={4} alignSelf="stretch" borderRadius={2} backgroundColor={block.color} />
      <YStack flex={1} gap="$1" opacity={block.done || block.skipped ? 0.55 : 1}>
        <Text fontSize="$3" fontWeight="600" textDecorationLine={block.skipped ? 'line-through' : 'none'}>
          {block.done ? '✓ ' : ''}
          {block.title}
        </Text>
        <Text fontSize="$2" color="$muted">
          {KIND_LABEL[block.kind]} · {block.when}
          {block.skipped ? ' · no puedo hoy' : ''}
          {block.isException ? ' · cambiado hoy' : ''}
        </Text>
        {block.description ? (
          <Text fontSize="$2" numberOfLines={2}>
            {block.description}
          </Text>
        ) : null}
      </YStack>
      {onSkip && block.kind === 'work' && !block.done ? (
        <AppButton variant={block.skipped ? 'primary' : 'ghost'} disabled={busy} onPress={() => onSkip(block)}>
          {block.skipped ? 'Deshacer' : 'No puedo'}
        </AppButton>
      ) : null}
      {block.target && !block.skipped ? (
        <AppButton variant={block.done ? 'primary' : 'ghost'} disabled={busy} onPress={() => onToggle(block)}>
          {block.done ? '✓' : 'Hecho'}
        </AppButton>
      ) : null}
    </XStack>
  );
}
