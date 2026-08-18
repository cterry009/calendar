import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { Input } from 'tamagui';
import { useQuickAdd } from '../../context/QuickAddContext';
import { useTasks } from '../../hooks/useTasks';
import { difficultyFromComplexity, estimateTaskComplexity } from '../../lib/tasks/complexity';
import { extractEstimate } from '../../lib/tasks/quickAddParse';

// No calendar block to infer a pomodoro length from here, so a plain 25-minute pomodoro is the
// unit used both for "X pomodoros" and for the silent fallback below.
const DEFAULT_POMODORO_MIN = 25;

/**
 * Type-anywhere task capture (opened via the "Q" shortcut or the + icon in AppNav). Deliberately
 * asks for nothing but a title: no date, no duration required. An inline estimate ("3 pomodoros",
 * "45min") is still picked up if typed, same parser as the calendar's per-block quick-add; if
 * none is typed, it silently defaults to 1 pomodoro instead of blocking submission -- capture
 * first, refine later. Tasks created here have no scheduledAt and show up as "Sin programar" in
 * the Tasks panel until dragged onto a work block or edited with a date.
 */
export function GlobalQuickAdd() {
  const { isOpen, close } = useQuickAdd();
  const { createTask, isMutating } = useTasks();
  const [text, setText] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setJustAdded(false);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const { title, estimatedMinutes, estimatedPomodoros } = extractEstimate(trimmed, DEFAULT_POMODORO_MIN);
    const finalMinutes = estimatedMinutes ?? DEFAULT_POMODORO_MIN;
    const finalPomodoros = estimatedPomodoros ?? 1;
    const complexity = estimateTaskComplexity({ title, estimatedMinutes: finalMinutes });

    await createTask({
      title,
      description: null,
      scheduledAt: null,
      estimatedMinutes: finalMinutes,
      estimatedPomodoros: finalPomodoros,
      actualMinutes: null,
      difficulty: difficultyFromComplexity(complexity),
      complexity,
      priority: 'MEDIUM',
      category: null,
      status: 'PENDING',
    });

    setText('');
    setJustAdded(true);
    inputRef.current?.focus();
  }

  return createPortal(
    <YStack
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={600}
      alignItems="center"
      paddingTop="15vh"
    >
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundColor="rgba(10, 14, 12, 0.6)"
        onPress={close}
      />

      <YStack
        width="min(560px, 92vw)"
        backgroundColor="$surface"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$borderColor"
        shadowColor="$shadowColor"
        shadowRadius={40}
        shadowOffset={{ width: 0, height: 10 }}
        shadowOpacity={1}
        padding="$5"
        gap="$3"
        zIndex={1}
      >
        <YStack tag="form" onSubmit={handleSubmit} gap="$3">
          <Input
            ref={inputRef}
            size="$5"
            placeholder="Nueva tarea (ej. Preparar informe 3 pomodoros) -- Enter para agregar"
            value={text}
            onChangeText={setText}
            disabled={isMutating}
          />
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$2" color="$muted">
              {justAdded
                ? 'Agregada. Queda sin programar hasta que le asignes horario.'
                : 'Sin horario ni duracion? se guarda igual, sin programar.'}
            </Text>
            <XStack gap="$2">
              <AppButton type="button" variant="ghost" onPress={close}>
                Esc
              </AppButton>
              <AppButton type="submit" variant="primary" disabled={isMutating || !text.trim()}>
                Agregar
              </AppButton>
            </XStack>
          </XStack>
        </YStack>
      </YStack>
    </YStack>,
    document.body,
  );
}
