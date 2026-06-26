import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { Checkbox, Input, Label } from 'tamagui';
import { DAY_NAMES_ES, SCHEDULE_KIND_LABELS } from '../../lib/schedules/labels';
import {
  SCHEDULE_KINDS,
  minuteToTimeValue,
  timeValueToMinute,
  type ScheduleFormValues,
  type SyncScheduleRecord,
} from '../../lib/schedules/types';

interface ScheduleFormProps {
  mode: 'create' | 'edit';
  initialSchedule?: SyncScheduleRecord;
  isSubmitting: boolean;
  onSubmit: (values: ScheduleFormValues) => Promise<void>;
  onCancel: () => void;
}

interface ScheduleFormDraft {
  kind: ScheduleFormValues['kind'];
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
  enabled: boolean;
}

function defaultDraft(schedule?: SyncScheduleRecord): ScheduleFormDraft {
  return {
    kind: schedule?.kind ?? 'WORK',
    dayOfWeek: schedule?.dayOfWeek ?? 1,
    startTime: minuteToTimeValue(schedule?.startMinute ?? 9 * 60),
    endTime: minuteToTimeValue(schedule?.endMinute ?? 18 * 60),
    label: schedule?.label ?? '',
    enabled: schedule?.enabled ?? true,
  };
}

export function ScheduleForm({ mode, initialSchedule, isSubmitting, onSubmit, onCancel }: ScheduleFormProps) {
  const [draft, setDraft] = useState<ScheduleFormDraft>(() => defaultDraft(initialSchedule));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialSchedule));
    setError(null);
  }, [initialSchedule, mode]);

  const title = useMemo(
    () => (mode === 'create' ? 'Nuevo horario' : `Editar horario: ${initialSchedule?.label ?? 'sin etiqueta'}`),
    [initialSchedule?.label, mode],
  );

  function setField<Key extends keyof ScheduleFormDraft>(field: Key, value: ScheduleFormDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const startMinute = timeValueToMinute(draft.startTime);
    const endMinute = timeValueToMinute(draft.endTime);

    if (startMinute === null || endMinute === null) {
      setError('El formato de hora debe ser HH:MM.');
      return;
    }

    if (endMinute <= startMinute) {
      setError('La hora de fin debe ser mayor que la hora de inicio.');
      return;
    }

    await onSubmit({
      kind: draft.kind,
      dayOfWeek: draft.dayOfWeek,
      startMinute,
      endMinute,
      label: draft.label.trim() || null,
      enabled: draft.enabled,
    });
  }

  return (
    <AppCard>
      <YStack gap="$4" tag="form" onSubmit={handleSubmit}>
        <H2 margin={0} fontSize="$6">
          {title}
        </H2>

        <YStack gap="$2">
          <Paragraph margin={0}>Tipo de bloque</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {SCHEDULE_KINDS.map((kind) => (
              <AppButton
                key={kind}
                type="button"
                variant={draft.kind === kind ? 'primary' : 'ghost'}
                onPress={() => setField('kind', kind)}
              >
                {SCHEDULE_KIND_LABELS[kind]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Paragraph margin={0}>Dia de la semana</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {DAY_NAMES_ES.map((dayName, index) => (
              <AppButton
                key={dayName}
                type="button"
                variant={draft.dayOfWeek === index ? 'primary' : 'ghost'}
                onPress={() => setField('dayOfWeek', index)}
              >
                {dayName}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <XStack gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={180} gap="$2">
            <Label htmlFor="schedule-start-time">Hora inicio</Label>
            <Input
              id="schedule-start-time"
              type="time"
              value={draft.startTime}
              onChangeText={(value: string) => setField('startTime', value)}
              required
            />
          </YStack>

          <YStack flex={1} minWidth={180} gap="$2">
            <Label htmlFor="schedule-end-time">Hora fin</Label>
            <Input
              id="schedule-end-time"
              type="time"
              value={draft.endTime}
              onChangeText={(value: string) => setField('endTime', value)}
              required
            />
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Label htmlFor="schedule-label">Etiqueta (opcional)</Label>
          <Input
            id="schedule-label"
            value={draft.label}
            onChangeText={(value: string) => setField('label', value)}
            placeholder={draft.kind === 'WORK' ? 'Ej. Jornada principal' : 'Ej. Almuerzo'}
          />
        </YStack>

        <XStack gap="$3" alignItems="center">
          <Checkbox
            id="schedule-enabled"
            checked={draft.enabled}
            onCheckedChange={(checked) => setField('enabled', Boolean(checked))}
            size="$4"
          >
            <Checkbox.Indicator />
          </Checkbox>
          <Label htmlFor="schedule-enabled">Horario activo</Label>
        </XStack>

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
            {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear horario' : 'Guardar cambios'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
