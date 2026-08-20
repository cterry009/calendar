import { AppButton, AppCard, Label, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useState } from 'react';
import { Input, TextArea } from 'tamagui';
import { FITNESS_INTENSITIES, FITNESS_INTENSITY_LABELS, type FitnessFormValues } from '../../lib/fitness/types';

interface FitnessFormProps {
  isSubmitting: boolean;
  onSubmit: (values: FitnessFormValues) => Promise<void>;
  onCancel: () => void;
}

// loggedAt isn't collected here -- no native date/time picker ported in this pass (see
// design.md), every entry logs as happening now. Editing an existing entry isn't ported either,
// only create + delete, matching the same "compact first slice" scope as the tasks screen.
export function FitnessForm({ isSubmitting, onSubmit, onCancel }: FitnessFormProps) {
  const [activityType, setActivityType] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [intensity, setIntensity] = useState<FitnessFormValues['intensity']>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    const trimmedActivity = activityType.trim();
    const duration = Number(durationMinutes);

    if (!trimmedActivity) {
      setError('El tipo de actividad es obligatorio.');
      return;
    }

    if (!Number.isInteger(duration) || duration < 1) {
      setError('La duracion debe ser un entero mayor o igual a 1.');
      return;
    }

    await onSubmit({ activityType: trimmedActivity, durationMinutes: duration, intensity, notes: notes.trim() || null });
  }

  return (
    <AppCard>
      <YStack gap="$4">
        <Text fontWeight="700" fontSize="$5">
          Nuevo registro fitness
        </Text>

        <YStack gap="$2">
          <Label htmlFor="fitness-activity-type">Tipo de actividad</Label>
          <Input
            id="fitness-activity-type"
            value={activityType}
            onChangeText={setActivityType}
            placeholder="Ej. Correr, Bicicleta, Gimnasio"
          />
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="fitness-duration">Duracion (min)</Label>
          <Input
            id="fitness-duration"
            value={durationMinutes}
            onChangeText={setDurationMinutes}
            keyboardType="number-pad"
          />
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Intensidad</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {FITNESS_INTENSITIES.map((level) => (
              <AppButton
                key={level}
                variant={intensity === level ? 'primary' : 'ghost'}
                onPress={() => setIntensity(level)}
              >
                {FITNESS_INTENSITY_LABELS[level]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="fitness-notes">Notas (opcional)</Label>
          <TextArea
            id="fitness-notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Sensaciones, objetivo del entrenamiento, etc."
            minHeight={90}
          />
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
            {isSubmitting ? 'Guardando...' : 'Crear registro'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
