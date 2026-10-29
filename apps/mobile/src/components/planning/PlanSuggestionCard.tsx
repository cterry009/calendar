import { AppButton, AppCard, Text, XStack, YStack } from '@calendar/ui';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  approveSuggestion,
  dismissSuggestion,
  fetchPendingSuggestion,
  type PlanSuggestion,
} from '../../lib/planning/suggestions';

// "Plan sugerido para mañana" on the home screen (daily-email-report, 2026-10-29), the phone's half of
// apps/web's PlanSuggestionCard: the 21:00 email proposes blocks with tasks for a day with nothing
// planned, and approving here puts them on the calendar. Hidden when there's nothing to approve or
// the server can't be reached.

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

export function PlanSuggestionCard({ onApproved }: { onApproved?: () => void }) {
  const [suggestion, setSuggestion] = useState<PlanSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSuggestion(await fetchPendingSuggestion());
    } catch {
      // Offline or an older server: no card.
    }
  }, []);

  useEffect(() => {
    void load();
    // Opening the app at night, after the email, is when this matters.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
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
    try {
      if (approve) {
        const result = await approveSuggestion(suggestion.id);
        onApproved?.();
        setMessage(
          `Plan aprobado: ${result.scheduled} ${result.scheduled === 1 ? 'tarea agendada' : 'tareas agendadas'}` +
            (result.skipped ? ` (${result.skipped} ya tenían fecha o estaban hechas)` : '.'),
        );
      } else {
        await dismissSuggestion(suggestion.id);
        setMessage('Plan sugerido descartado.');
      }
      setSuggestion(null);
    } catch (error) {
      setMessage(`No se pudo: ${(error as Error).message}`);
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
            {block.tasks.map((task) => (
              <Text key={task.title} fontSize="$2" color="$muted">
                · {task.title}
                {task.reason ? ` — ${task.reason}` : ''}
              </Text>
            ))}
          </YStack>
        ))}
        {message ? (
          <Text fontSize="$2" color="$error">
            {message}
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
