import { AppButton, AppCard, Label, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useState } from 'react';
import { Input } from 'tamagui';
import { HABIT_TYPES, type HabitFormValues } from '../../lib/habits/types';
import { HABIT_TYPE_LABELS } from '../../lib/habits/labels';

interface HabitFormProps {
  isSubmitting: boolean;
  onSubmit: (values: HabitFormValues) => Promise<void>;
  onCancel: () => void;
}

// Mirrors FitnessForm.tsx's shape (create-only, same "compact first slice" scope) -- no color
// picker or edit form here, both left for a later pass same as web's fuller habit form isn't
// fully ported (see calendar/types.ts's doc comment on what's out of scope for this port).
export function HabitForm({ isSubmitting, onSubmit, onCancel }: HabitFormProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<HabitFormValues['type']>('NORMAL');
  const [dailyGoalValue, setDailyGoalValue] = useState('1');
  const [dailyGoalUnit, setDailyGoalUnit] = useState('vez');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    const trimmedTitle = title.trim();
    const goalValue = Number(dailyGoalValue);

    if (!trimmedTitle) {
      setError('El nombre es obligatorio.');
      return;
    }

    if (!Number.isFinite(goalValue) || goalValue <= 0) {
      setError('La meta diaria debe ser un numero mayor a 0.');
      return;
    }

    await onSubmit({
      title: trimmedTitle,
      description: null,
      type,
      dailyGoalValue: goalValue,
      dailyGoalUnit: dailyGoalUnit.trim() || 'vez',
      dailyGoalExtraValue: null,
      targetDays: 66,
      color: null,
      category: category.trim() || null,
      linkedFitnessActivityType: null,
    });
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <Text fontWeight="700" fontSize="$5">
          Nuevo habito
        </Text>

        <YStack gap="$2">
          <Label htmlFor="habit-title">Nombre</Label>
          <Input id="habit-title" value={title} onChangeText={setTitle} placeholder="Ej. Sacar al perro" />
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Tipo</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {HABIT_TYPES.map((option) => (
              <AppButton key={option} variant={type === option ? 'primary' : 'ghost'} onPress={() => setType(option)}>
                {HABIT_TYPE_LABELS[option]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <XStack gap="$3">
          <YStack flex={1} gap="$2">
            <Label htmlFor="habit-goal-value">Meta diaria</Label>
            <Input id="habit-goal-value" value={dailyGoalValue} onChangeText={setDailyGoalValue} keyboardType="numeric" />
          </YStack>
          <YStack flex={1} gap="$2">
            <Label htmlFor="habit-goal-unit">Unidad</Label>
            <Input id="habit-goal-unit" value={dailyGoalUnit} onChangeText={setDailyGoalUnit} placeholder="vez, min, etc." />
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Label htmlFor="habit-category">Categoria (opcional)</Label>
          <Input id="habit-category" value={category} onChangeText={setCategory} placeholder="Salud, trabajo, etc." />
        </YStack>

        {error ? (
          <Text color="$danger" fontSize="$3">
            {error}
          </Text>
        ) : null}

        <XStack gap="$3" justifyContent="flex-end" flexWrap="wrap">
          <AppButton variant="ghost" onPress={onCancel} disabled={isSubmitting}>
            Cancelar
          </AppButton>
          <AppButton variant="primary" onPress={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Crear habito'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
