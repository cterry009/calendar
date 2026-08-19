import { AppCard, Paragraph, YStack } from '@calendar/ui';
import type { SyncFocusTriggerRecord } from '../../lib/focusTriggers/types';
import { FocusTriggerItem } from './FocusTriggerItem';

interface FocusTriggerListProps {
  triggers: SyncFocusTriggerRecord[];
  isBusy: boolean;
  emptyMessage: string;
  onEdit: (trigger: SyncFocusTriggerRecord) => void;
  onDelete: (trigger: SyncFocusTriggerRecord) => Promise<void>;
}

export function FocusTriggerList({ triggers, isBusy, emptyMessage, onEdit, onDelete }: FocusTriggerListProps) {
  if (!triggers.length) {
    return (
      <AppCard>
        <Paragraph margin={0}>{emptyMessage}</Paragraph>
      </AppCard>
    );
  }

  return (
    <YStack gap="$3">
      {triggers.map((trigger) => (
        <FocusTriggerItem key={trigger.id} trigger={trigger} isBusy={isBusy} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </YStack>
  );
}
