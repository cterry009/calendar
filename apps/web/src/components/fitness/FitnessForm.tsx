import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { Label, TextArea } from 'tamagui';
import { FITNESS_INTENSITY_LABELS } from '../../lib/fitness/labels';
import {
  FITNESS_INTENSITIES,
  type FitnessFormValues,
  type SyncFitnessRecord,
} from '../../lib/fitness/types';
import { FormField } from '../tasks/FormField';

interface FitnessFormProps {
  mode: 'create' | 'edit';
  initialEntry?: SyncFitnessRecord;
  isSubmitting: boolean;
  onSubmit: (values: FitnessFormValues) => Promise<void>;
  onCancel: () => void;
}

interface FitnessFormDraft {
  activityType: string;
  durationMinutes: string;
  intensity: FitnessFormValues['intensity'];
  notes: string;
  loggedAt: string;
}

function toDateTimeLocal(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function defaultDraft(entry?: SyncFitnessRecord): FitnessFormDraft {
  return {
    activityType: entry?.activityType ?? '',
    durationMinutes: String(entry?.durationMinutes ?? 30),
    intensity: entry?.intensity ?? 'MEDIUM',
    notes: entry?.notes ?? '',
    loggedAt: entry ? toDateTimeLocal(entry.loggedAt) : toDateTimeLocal(new Date().toISOString()),
  };
}

export function FitnessForm({ mode, initialEntry, isSubmitting, onSubmit, onCancel }: FitnessFormProps) {
  const [draft, setDraft] = useState<FitnessFormDraft>(() => defaultDraft(initialEntry));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialEntry));
    setError(null);
  }, [initialEntry, mode]);

  const title = useMemo(
    () => (mode === 'create' ? 'Nuevo registro fitness' : `Editar: ${initialEntry?.activityType ?? 'actividad'}`),
    [initialEntry?.activityType, mode],
  );

  function setField<Key extends keyof FitnessFormDraft>(field: Key, value: FitnessFormDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedActivity = draft.activityType.trim();
    const durationMinutes = Number(draft.durationMinutes);

    if (!trimmedActivity) {
      setError('El tipo de actividad es obligatorio.');
      return;
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      setError('La duracion debe ser un entero mayor o igual a 1.');
      return;
    }

    const loggedDate = new Date(draft.loggedAt);
    if (Number.isNaN(loggedDate.getTime())) {
      setError('La fecha y hora del registro no es valida.');
      return;
    }

    await onSubmit({
      activityType: trimmedActivity,
      durationMinutes,
      intensity: draft.intensity,
      notes: draft.notes.trim() || null,
      loggedAt: loggedDate.toISOString(),
    });
  }

  return (
    <AppCard>
      <YStack gap="$4" tag="form" onSubmit={handleSubmit}>
        <H2 margin={0} fontSize="$6">
          {title}
        </H2>

        <FormField
          id="fitness-activity-type"
          label="Tipo de actividad"
          placeholder="Ej. Correr, Bicicleta, Gimnasio"
          value={draft.activityType}
          onChangeText={(value: string) => setField('activityType', value)}
          required
        />

        <XStack gap="$3" flexWrap="wrap">
          <YStack minWidth={180} flex={1}>
            <FormField
              id="fitness-duration"
              label="Duracion (min)"
              type="number"
              min={1}
              value={draft.durationMinutes}
              onChangeText={(value: string) => setField('durationMinutes', value)}
              required
            />
          </YStack>
          <YStack minWidth={240} flex={1}>
            <FormField
              id="fitness-logged-at"
              label="Fecha y hora"
              type="datetime-local"
              value={draft.loggedAt}
              onChangeText={(value: string) => setField('loggedAt', value)}
              required
            />
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Intensidad</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {FITNESS_INTENSITIES.map((intensity) => (
              <AppButton
                key={intensity}
                type="button"
                variant={draft.intensity === intensity ? 'primary' : 'ghost'}
                onPress={() => setField('intensity', intensity)}
              >
                {FITNESS_INTENSITY_LABELS[intensity]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="fitness-notes">Notas (opcional)</Label>
          <TextArea
            id="fitness-notes"
            value={draft.notes}
            onChangeText={(value: string) => setField('notes', value)}
            placeholder="Sensaciones, objetivo del entrenamiento, etc."
            minHeight={90}
          />
        </YStack>

        {error ? (
          <Paragraph color="$error" margin={0}>
            {error}
          </Paragraph>
        ) : null}

        <XStack gap="$3" justifyContent="flex-end" flexWrap="wrap">
          <AppButton type="button" variant="ghost" onPress={onCancel} disabled={isSubmitting}>
            Cancelar
          </AppButton>
          <AppButton type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear registro' : 'Guardar cambios'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
