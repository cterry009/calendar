import { useCallback, useEffect, useState } from 'react';
import { isCommitmentActive, type CommitmentView } from '@calendar/shared';
import { useSync } from '../context/SyncContext';
import { apiFetch } from '../lib/api';
import { useSyncRefetch } from './useSyncRefetch';

// The block commitment (weekend-mode). Module-level, like lib/desktop/nightWindow.ts: the desktop
// bridges and the block-list page must agree the moment it starts.
let current: CommitmentView | null = null;
const listeners = new Set<(commitment: CommitmentView | null) => void>();

function publish(next: CommitmentView | null) {
  current = next;
  listeners.forEach((listener) => listener(next));
}

export interface CommitmentExtension {
  days?: number;
  indefinite?: boolean;
}

export function useCommitment() {
  const { pullSnapshot } = useSync();
  const [commitment, setCommitment] = useState(current);

  useEffect(() => {
    listeners.add(setCommitment);
    return () => {
      listeners.delete(setCommitment);
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      publish((await pullSnapshot()).commitment ?? null);
    } catch {
      // Offline: what this device last knew still holds.
    }
  }, [pullSnapshot]);

  // /commitment notifies under these entities (commitment.service.ts).
  useSyncRefetch('blockListEntries', refetch);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const extend = useCallback(async (input: CommitmentExtension) => {
    const result = await apiFetch<{ commitment: CommitmentView }>('/commitment', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    publish(result.commitment);
  }, []);

  return { commitment, isLocked: isCommitmentActive(commitment), extend };
}
