import { AppCard, Paragraph, YStack } from '@calendar/ui';
import type { SyncFitnessRecord } from '../../lib/fitness/types';
import { FitnessItem } from './FitnessItem';

interface FitnessListProps {
  entries: SyncFitnessRecord[];
  isBusy: boolean;
  emptyMessage?: string;
  onEdit: (entry: SyncFitnessRecord) => void;
  onDelete: (entry: SyncFitnessRecord) => Promise<void>;
}

export function FitnessList({ entries, isBusy, emptyMessage, onEdit, onDelete }: FitnessListProps) {
  if (!entries.length) {
    return (
      <AppCard>
        <Paragraph color="$muted" margin={0}>
          {emptyMessage ?? 'No hay registros de fitness para mostrar.'}
        </Paragraph>
      </AppCard>
    );
  }

  return (
    <YStack gap="$3">
      {entries.map((entry) => (
        <FitnessItem key={entry.id} entry={entry} isBusy={isBusy} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </YStack>
  );
}
