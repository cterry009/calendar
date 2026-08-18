import { useState, type FormEvent } from 'react';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { Input } from 'tamagui';
import { TaskForm } from './TaskForm';
import { difficultyFromComplexity, estimateTaskComplexity } from '../../lib/tasks/complexity';
import { extractEstimate } from '../../lib/tasks/quickAddParse';
import type { TaskFormValues } from '../../lib/tasks/types';

interface QuickAddTaskProps {
  isSubmitting: boolean;
  /** Prefills "scheduledAt" (e.g. a calendar work block's start time). */
  initialScheduledAt?: string | null;
  /** This work block's actual pomodoro length -- "2 pomodoros" and the no-estimate default both
   * convert to minutes using this, not a flat guess, since it varies per schedule. */
  pomodoroLengthMin: number;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

/** One-line "type and go" task entry, Todoist/Things-style: title + optional inline estimate in
 * pomodoros (or minutes/hours), everything else gets a sane default (and a heuristic
 * complexity/difficulty guess). "Mas opciones" swaps to the full TaskForm, prefilled with
 * whatever was already typed. */
export function QuickAddTask({ isSubmitting, initialScheduledAt, pomodoroLengthMin, onSubmit }: QuickAddTaskProps) {
  const [text, setText] = useState('');
  const [showFullForm, setShowFullForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (showFullForm) {
    // Parse what was already typed so "4 pomodoros" carries over as an actual estimate instead
    // of sitting in the title as literal text the user would have to remove by hand.
    const parsed = extractEstimate(text.trim(), pomodoroLengthMin);
    return (
      <TaskForm
        mode="create"
        isSubmitting={isSubmitting}
        initialScheduledAt={initialScheduledAt}
        initialTitle={parsed.title}
        initialEstimatedPomodoros={parsed.estimatedPomodoros ?? undefined}
        pomodoroLengthMin={pomodoroLengthMin}
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

    const { title, estimatedMinutes, estimatedPomodoros } = extractEstimate(trimmed, pomodoroLengthMin);
    if (estimatedMinutes === null || estimatedPomodoros === null) {
      setError('Indica cuanto va a durar: "3 pomodoros" o "45min", por ejemplo.');
      return;
    }

    const complexity = estimateTaskComplexity({ title, estimatedMinutes });

    await onSubmit({
      title,
      description: null,
      scheduledAt: initialScheduledAt ?? null,
      estimatedMinutes,
      estimatedPomodoros,
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
          placeholder="+ Agregar tarea (ej. Preparar informe 3 pomodoros)"
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
