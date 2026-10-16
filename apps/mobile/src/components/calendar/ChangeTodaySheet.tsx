import { adjustmentActionsFor } from '@calendar/shared';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { Input } from 'tamagui';
import { minuteLabel, type AgendaBlock } from '../../lib/calendar/dayAgenda';

// "Cambiar hoy…" on the phone (horario 2026-10-19), the same choices as the desktop calendar's
// PlanBlockDetails: move to carrera / datos, another start time, swap with another block of the
// day, or back to the template. Each is a change for this day only. A sheet rather than an Alert:
// Android shows at most three buttons in one.

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? minute : null;
}

export function ChangeTodaySheet({
  block,
  dayBlocks,
  onClose,
  onCategory,
  onMove,
  onSwap,
}: {
  block: AgendaBlock | null;
  /** The day's other work blocks, to swap with. */
  dayBlocks: AgendaBlock[];
  onClose: () => void;
  onCategory: (block: AgendaBlock, category: string | null) => Promise<void>;
  onMove: (block: AgendaBlock, startMinute: number) => Promise<void>;
  onSwap: (a: AgendaBlock, b: AgendaBlock) => Promise<void>;
}) {
  const [startInput, setStartInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (block) setStartInput(minuteLabel(block.startMinute));
    setError(null);
  }, [block]);

  if (!block) return null;
  const length = block.endMinute - block.startMinute;
  const done = (action: Promise<void>) => void action.finally(onClose);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
      <YStack backgroundColor="#212e28" padding="$5" gap="$3" borderTopLeftRadius={16} borderTopRightRadius={16}>
        <ScrollView>
          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="700">
              Cambiar solo este día
            </Text>
            <Text color="$muted">
              {block.title} · {block.when}
            </Text>
            {adjustmentActionsFor(block.category).map((action) => (
              <AppButton key={action.id} variant="ghost" onPress={() => done(onCategory(block, action.category))}>
                {action.label}
              </AppButton>
            ))}
            <XStack gap="$2" alignItems="center">
              <Text>Empieza a las</Text>
              <Input value={startInput} onChangeText={setStartInput} width={90} />
              <AppButton
                variant="ghost"
                onPress={() => {
                  const start = parseClock(startInput);
                  if (start === null || start + length > 24 * 60) return setError('Hora no válida (HH:MM).');
                  done(onMove(block, start));
                }}
              >
                Mover
              </AppButton>
            </XStack>
            <Text color="$muted" fontSize="$2">
              Dura {length} min; los tramos se ajustan al nuevo horario.
            </Text>
            {dayBlocks
              .filter((other) => other.id !== block.id)
              .map((other) => (
                <AppButton key={other.id} variant="ghost" onPress={() => done(onSwap(block, other))}>
                  {`Intercambiar con ${minuteLabel(other.startMinute)} · ${other.title}`}
                </AppButton>
              ))}
            {block.isException ? (
              <AppButton variant="primary" onPress={() => done(onCategory(block, null))}>
                Volver al horario
              </AppButton>
            ) : null}
            {error ? <Text color="$danger">{error}</Text> : null}
            <AppButton variant="ghost" onPress={onClose}>
              Cancelar
            </AppButton>
          </YStack>
        </ScrollView>
      </YStack>
    </Modal>
  );
}
