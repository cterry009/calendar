import { AppCard, Paragraph, YStack } from '@calendar/ui';
import type { SyncBlockListRecord } from '../../lib/blocklist/types';
import { BlockListItem } from './BlockListItem';

interface BlockListListProps {
  entries: SyncBlockListRecord[];
  isBusy: boolean;
  emptyMessage: string;
  onEdit: (entry: SyncBlockListRecord) => void;
  onDelete: (entry: SyncBlockListRecord) => Promise<void>;
}

export function BlockListList({ entries, isBusy, emptyMessage, onEdit, onDelete }: BlockListListProps) {
  if (!entries.length) {
    return (
      <AppCard>
        <Paragraph margin={0}>{emptyMessage}</Paragraph>
      </AppCard>
    );
  }

  return (
    <YStack gap="$3">
      {entries.map((entry) => (
        <BlockListItem key={entry.id} entry={entry} isBusy={isBusy} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </YStack>
  );
}
