import { useCallback, useEffect, useState } from 'react';
import { AppButton, AppCard, Text, XStack, YStack } from '@calendar/ui';
import { useSync } from '../../context/SyncContext';
import {
  approveSuggestion,
  dismissSuggestion,
  fetchPendingSuggestion,
  type PlanSuggestion,
} from '../../lib/planning/suggestions';

// "Plan sugerido para mañana" (daily-email-report, 2026-10-29): when the 21:00 email finds the next day
// with nothing planned it proposes blocks with tasks; approving here puts them on the calendar (the
// server writes the tasks and every device re-pulls). Hidden when there's nothing to approve or
// the server can't be reached.

const REFRESH_MS = 5 * 60_000;
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function dayTitle(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (day.toDateString() === today.toDateString()) return 'hoy';
  if (day.toDateString() === tomorrow.toDateString()) return 'mañana';
  return `el ${WEEKDAYS[day.getDay()]} ${d}`;
}

export function PlanSuggestionCard() {
  const { notifyEntityChanged } = useSync();
  const [suggestion, setSuggestion] = useState<PlanSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSuggestion(await fetchPendingSuggestion());
    } catch {
      // Offline or an older server: no card, nothing to approve from here.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  if (!suggestion) {
    return message ? (
      <AppCard>
        <Text color="$accent" fontWeight="700">
          {message}
        </Text>
      </AppCard>
    ) : null;
  }

  const act = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (approve) {
        const result = await approveSuggestion(suggestion.id);
        notifyEntityChanged('tasks');
        setMessage(
          `Plan aprobado: ${result.scheduled} ${result.scheduled === 1 ? 'tarea agendada' : 'tareas agendadas'}` +
            (result.skipped ? ` (${result.skipped} ya tenían fecha o estaban hechas)` : '.'),
        );
      } else {
        await dismissSuggestion(suggestion.id);
        setMessage('Plan sugerido descartado.');
      }
      setSuggestion(null);
      // A missed report can leave two pending (today's and tomorrow's): show the next one.
      void load();
    } catch (failure) {
      setError(`No se pudo: ${(failure as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const groups = suggestion.loose.length
    ? [...suggestion.blocks, { label: 'En el día, sin bloque', start: '', end: '', tasks: suggestion.loose }]
    : suggestion.blocks;

  return (
    <AppCard>
      <YStack gap="$3">
        <YStack>
          <Text fontWeight="800">Plan sugerido para {dayTitle(suggestion.date)}</Text>
          <Text color="$muted" fontSize="$2">
            No había nada planeado. Revísalo y apruébalo para ponerlo en el calendario.
          </Text>
        </YStack>
        {groups.map((block) => (
          <YStack key={`${block.label}-${block.start}`} gap="$1">
            <Text fontSize="$3" fontWeight="700">
              {block.start ? `${block.start}-${block.end} · ` : ''}
              {block.label}
            </Text>
            {block.tasks.map((task, index) => (
              // Titles repeat (two tasks can share one), so the position keys them.
              <Text key={index} fontSize="$2" color="$muted">
                · {task.title}
                {task.reason ? ` — ${task.reason}` : ''}
              </Text>
            ))}
          </YStack>
        ))}
        {suggestion.warnings.length ? (
          <Text fontSize="$1" color="$muted">
            {suggestion.warnings.join(' ')}
          </Text>
        ) : null}
        {message ? (
          <Text fontSize="$2" color="$accent">
            {message}
          </Text>
        ) : null}
        {error ? (
          <Text fontSize="$2" color="$error">
            {error}
          </Text>
        ) : null}
        <XStack gap="$2" flexWrap="wrap">
          <AppButton disabled={busy} onPress={() => void act(true)}>
            Aprobar plan
          </AppButton>
          <AppButton variant="ghost" disabled={busy} onPress={() => void act(false)}>
            Descartar
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
