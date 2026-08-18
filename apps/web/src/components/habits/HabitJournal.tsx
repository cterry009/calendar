import { useState } from 'react';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { TextArea } from 'tamagui';
import type { SyncJournalEntry } from '../../lib/habits/types';

interface HabitJournalProps {
  entries: SyncJournalEntry[];
  isBusy: boolean;
  onAdd: (content: string) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}

export function HabitJournal({ entries, isBusy, onAdd, onDelete }: HabitJournalProps) {
  const [draft, setDraft] = useState('');

  async function handleAdd() {
    const content = draft.trim();
    if (!content) return;
    await onAdd(content);
    setDraft('');
  }

  return (
    <YStack gap="$3">
      <Paragraph margin={0} fontWeight="600">
        Notas
      </Paragraph>

      <YStack gap="$2">
        <TextArea
          value={draft}
          onChangeText={setDraft}
          placeholder="Como te fue hoy con este habito..."
          minHeight={70}
        />
        <XStack justifyContent="flex-end">
          <AppButton type="button" variant="small" disabled={isBusy || !draft.trim()} onPress={() => void handleAdd()}>
            Agregar nota
          </AppButton>
        </XStack>
      </YStack>

      {entries.length === 0 ? (
        <Paragraph color="$muted" margin={0}>
          Todavia no hay notas para este habito.
        </Paragraph>
      ) : (
        <YStack gap="$2">
          {entries.map((entry) => (
            <YStack key={entry.id} gap="$1" borderTopWidth={1} borderColor="$borderColor" paddingTop="$2">
              <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
                <Paragraph margin={0} flex={1}>
                  {entry.content}
                </Paragraph>
                <AppButton
                  type="button"
                  variant="ghost"
                  disabled={isBusy}
                  onPress={() => void onDelete(entry.id)}
                  aria-label="Eliminar nota"
                >
                  ✕
                </AppButton>
              </XStack>
              <Text fontSize="$1" color="$muted">
                {new Date(entry.createdAt).toLocaleString('es-ES')}
              </Text>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  );
}
