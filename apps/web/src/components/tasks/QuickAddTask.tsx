import { useState, type FormEvent } from 'react';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { Input } from 'tamagui';
import { TaskForm } from './TaskForm';
import { difficultyFromComplexity, estimateTaskComplexity } from '../../lib/tasks/complexity';
import type { TaskFormValues } from '../../lib/tasks/types';

interface QuickAddTaskProps {
  isSubmitting: boolean;
  /** Prefills "scheduledAt" (e.g. a calendar work block's start time). */
  initialScheduledAt?: string | null;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

const DEFAULT_ESTIMATED_MINUTES = 30;
// Matches a trailing/leading duration like "45min", "1h", "2 horas" so it can be typed inline
// ("Enviar reporte 45min") without opening the full form just to set an estimate.
const DURATION_PATTERN = /(\d+)\s*(h|hr|horas?|m|min|mins?|minutos?)\b/i;

function extractDuration(text: string): { title: string; estimatedMinutes: number | null } {
  const match = DURATION_PATTERN.exec(text);
  if (!match) return { title: text.trim(), estimatedMinutes: null };

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const estimatedMinutes = unit.startsWith('h') ? amount * 60 : amount;
  const title = `${text.slice(0, match.index)}${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim();

  return { title, estimatedMinutes };
}

/** One-line "type and go" task entry, Todoist/Things-style: title + optional inline duration,
 * everything else gets a sane default (and a heuristic complexity/difficulty guess). "Mas
 * opciones" swaps to the full TaskForm, prefilled with whatever was already typed. */
export function QuickAddTask({ isSubmitting, initialScheduledAt, onSubmit }: QuickAddTaskProps) {
  const [text, setText] = useState('');
  const [showFullForm, setShowFullForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (showFullForm) {
    return (
      <TaskForm
        mode="create"
        isSubmitting={isSubmitting}
        initialScheduledAt={initialScheduledAt}
        initialTitle={text}
        onSubmit={async (values) => {
          await onSubmit(values);
          setText('');
          setShowFullForm(false);
        }}
        onCancel={() => setShowFullForm(false)}
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setError('Escribe un titulo para la tarea.');
      return;
    }

    const { title, estimatedMinutes } = extractDuration(trimmed);
    const finalEstimatedMinutes = estimatedMinutes ?? DEFAULT_ESTIMATED_MINUTES;
    const complexity = estimateTaskComplexity({ title, estimatedMinutes: finalEstimatedMinutes });

    await onSubmit({
      title,
      description: null,
      scheduledAt: initialScheduledAt ?? null,
      estimatedMinutes: finalEstimatedMinutes,
      actualMinutes: null,
      difficulty: difficultyFromComplexity(complexity),
      complexity,
      priority: 'MEDIUM',
      category: null,
      status: 'PENDING',
    });

    setText('');
  }

  return (
    <YStack gap="$2" tag="form" onSubmit={handleSubmit}>
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          placeholder="+ Agregar tarea (ej. Enviar reporte 45min)"
          value={text}
          onChangeText={setText}
          disabled={isSubmitting}
        />
        <AppButton type="submit" variant="primary" disabled={isSubmitting}>
          Agregar
        </AppButton>
      </XStack>
      <AppButton
        type="button"
        variant="ghost"
        size="$2"
        alignSelf="flex-start"
        disabled={isSubmitting}
        onPress={() => setShowFullForm(true)}
      >
        Mas opciones
      </AppButton>
      {error ? (
        <Text color="$error" fontSize="$2">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
