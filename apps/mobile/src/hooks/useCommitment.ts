import { useCallback, useEffect, useState } from 'react';
import { isCommitmentActive, type CommitmentView } from '@calendar/shared';
import { useSync } from '../context/SyncContext';
import { apiFetch } from '../lib/auth/api';
import { pullSnapshot } from '../lib/sync/api';

// The block commitment (weekend-mode). Module-level, like lib/nightBlock/state.ts: the native bridge
// (useNightBlocking.ts) and the block-list screen must agree the moment it starts.
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
  const { registerRefetch } = useSync();
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
      // Offline with no cached snapshot: what this device last knew still holds (natively too).
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => registerRefetch(refetch), [registerRefetch, refetch]);

  const extend = useCallback(async (input: CommitmentExtension) => {
    const result = await apiFetch<{ commitment: CommitmentView }>('/commitment', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    publish(result.commitment);
  }, []);

  return { commitment, isLocked: isCommitmentActive(commitment), extend };
}
