import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Checkbox, Input, Label } from 'tamagui';
import { DAY_NAMES_ES, SCHEDULE_KIND_LABELS } from '../../lib/schedules/labels';
import {
  SCHEDULE_KINDS,
  minuteToTimeValue,
  timeValueToMinute,
  type ScheduleFormValues,
  type SyncScheduleRecord,
} from '../../lib/schedules/types';
import {
  DEFAULT_LONG_BREAK_MIN,
  DEFAULT_POMODOROS_PER_CHUNK,
  DEFAULT_SHORT_BREAK_MIN,
  MAX_CHUNKS,
  MAX_LONG_BREAKS,
  availableFocusMinutes,
  computeMaxChunks,
  countSegmentsByType,
  estimateFocusDurationMin,
  generateFocusPlan,
  loadFocusFeedbackHistory,
  requiredMinutesForConfig,
  type FocusPlanConfig,
} from '../../lib/pomodoro/planner';

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

interface ScheduleFormProps {
  mode: 'create' | 'edit';
  initialSchedule?: SyncScheduleRecord;
  isSubmitting: boolean;
  onSubmit: (valuesList: ScheduleFormValues[]) => Promise<void>;
  onCancel: () => void;
}

interface ScheduleFormDraft {
  kind: ScheduleFormValues['kind'];
  dayOfWeeks: number[];
  startTime: string;
  endTime: string;
  label: string;
  enabled: boolean;
  pomodoroMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  pomodorosPerChunk: number;
  chunks: number;
}

function defaultDraft(schedule?: SyncScheduleRecord): ScheduleFormDraft {
  const startMinute = schedule?.startMinute ?? 9 * 60;
  const endMinute = schedule?.endMinute ?? 18 * 60;
  const pomodoroMin = schedule?.pomodoroMin ?? estimateFocusDurationMin(loadFocusFeedbackHistory());
  const shortBreakMin = schedule?.shortBreakMin ?? DEFAULT_SHORT_BREAK_MIN;
  const longBreakMin = schedule?.longBreakMin ?? DEFAULT_LONG_BREAK_MIN;
  const pomodorosPerChunk = schedule?.pomodorosPerChunk ?? DEFAULT_POMODOROS_PER_CHUNK;
  const autoChunks = computeMaxChunks(availableFocusMinutes(startMinute, endMinute), {
    pomodoroMin,
    shortBreakMin,
    longBreakMin,
    pomodorosPerChunk,
  });

  return {
    kind: schedule?.kind ?? 'WORK',
    dayOfWeeks: [schedule?.dayOfWeek ?? 1],
    startTime: minuteToTimeValue(startMinute),
    endTime: minuteToTimeValue(endMinute),
    label: schedule?.label ?? '',
    enabled: schedule?.enabled ?? true,
    pomodoroMin,
    shortBreakMin,
    longBreakMin,
    pomodorosPerChunk,
    chunks: schedule?.chunks ?? Math.max(1, autoChunks),
  };
}

export function ScheduleForm({ mode, initialSchedule, isSubmitting, onSubmit, onCancel }: ScheduleFormProps) {
  const [draft, setDraft] = useState<ScheduleFormDraft>(() => defaultDraft(initialSchedule));
  const [error, setError] = useState<string | null>(null);
  const [chunksTouched, setChunksTouched] = useState(false);

  useEffect(() => {
    setDraft(defaultDraft(initialSchedule));
    // Respect an already-persisted chunk count (a deliberate prior choice) instead of silently
    // overwriting it the moment the form opens; only auto-fit when there's no stored value yet.
    setChunksTouched(initialSchedule?.chunks != null);
    setError(null);
  }, [initialSchedule, mode]);

  // Keep "cantidad de bloques" auto-fit to the current range/config until the user edits it directly.
  useEffect(() => {
    if (chunksTouched || draft.kind !== 'WORK') return;

    const startMinute = timeValueToMinute(draft.startTime);
    const endMinute = timeValueToMinute(draft.endTime);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) return;

    const autoChunks = Math.max(
      1,
      computeMaxChunks(availableFocusMinutes(startMinute, endMinute), {
        pomodoroMin: draft.pomodoroMin,
        shortBreakMin: draft.shortBreakMin,
        longBreakMin: draft.longBreakMin,
        pomodorosPerChunk: draft.pomodorosPerChunk,
      }),
    );

    setDraft((current) => (current.chunks === autoChunks ? current : { ...current, chunks: autoChunks }));
  }, [
    chunksTouched,
    draft.kind,
    draft.startTime,
    draft.endTime,
    draft.pomodoroMin,
    draft.shortBreakMin,
    draft.longBreakMin,
    draft.pomodorosPerChunk,
  ]);

  const title = useMemo(
    () => (mode === 'create' ? 'Nuevo horario' : `Editar horario: ${initialSchedule?.label ?? 'sin etiqueta'}`),
    [initialSchedule?.label, mode],
  );

  const focusPlanPreview = useMemo(() => {
    if (draft.kind !== 'WORK') return null;

    const startMinute = timeValueToMinute(draft.startTime);
    const endMinute = timeValueToMinute(draft.endTime);
    if (startMinute === null || endMinute === null || endMinute <= startMinute) return null;

    const config: FocusPlanConfig = {
      pomodoroMin: draft.pomodoroMin,
      shortBreakMin: draft.shortBreakMin,
      longBreakMin: draft.longBreakMin,
      pomodorosPerChunk: draft.pomodorosPerChunk,
      chunks: draft.chunks,
    };

    const plan = generateFocusPlan(startMinute, endMinute, config);
    const available = availableFocusMinutes(startMinute, endMinute);
    const required = requiredMinutesForConfig(config);

    return {
      plan,
      pomodoros: countSegmentsByType(plan, 'pomodoro'),
      shortBreaks: countSegmentsByType(plan, 'short-break'),
      longBreaks: countSegmentsByType(plan, 'long-break'),
      available,
      required,
      fits: required <= available,
    };
  }, [
    draft.kind,
    draft.startTime,
    draft.endTime,
    draft.pomodoroMin,
    draft.shortBreakMin,
    draft.longBreakMin,
    draft.pomodorosPerChunk,
    draft.chunks,
  ]);

  function setField<Key extends keyof ScheduleFormDraft>(field: Key, value: ScheduleFormDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function toggleDay(day: number) {
    if (mode === 'edit') {
      setField('dayOfWeeks', [day]);
      return;
    }

    setDraft((current) => {
      const isSelected = current.dayOfWeeks.includes(day);
      if (isSelected) {
        if (current.dayOfWeeks.length === 1) return current;
        return { ...current, dayOfWeeks: current.dayOfWeeks.filter((value) => value !== day) };
      }
      return { ...current, dayOfWeeks: [...current.dayOfWeeks, day].sort((a, b) => a - b) };
    });
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

    if (draft.dayOfWeeks.length === 0) {
      setError('Selecciona al menos un dia.');
      return;
    }

    if (draft.kind === 'WORK') {
      const planValues = [draft.pomodoroMin, draft.shortBreakMin, draft.longBreakMin, draft.pomodorosPerChunk, draft.chunks];
      if (planValues.some((value) => !Number.isInteger(value) || value < 1)) {
        setError('Los valores del plan de enfoque deben ser numeros enteros mayores o iguales a 1.');
        return;
      }

      if (draft.chunks > MAX_CHUNKS) {
        setError(`La cantidad de bloques no puede superar ${MAX_CHUNKS} (maximo ${MAX_LONG_BREAKS} descansos largos).`);
        return;
      }

      if (focusPlanPreview && !focusPlanPreview.fits) {
        setError(
          `La cantidad de bloques no cabe en el horario: necesitas ${formatMinutes(focusPlanPreview.required)} y ` +
            `solo hay ${formatMinutes(focusPlanPreview.available)} disponibles (se descuenta el almuerzo de 12:30 a ` +
            '13:30 si tu horario lo cubre). Reduce la cantidad de bloques, los pomodoros por bloque o las duraciones.',
        );
        return;
      }
    }

    const planFields =
      draft.kind === 'WORK'
        ? {
            pomodoroMin: draft.pomodoroMin,
            shortBreakMin: draft.shortBreakMin,
            longBreakMin: draft.longBreakMin,
            pomodorosPerChunk: draft.pomodorosPerChunk,
            chunks: draft.chunks,
          }
        : { pomodoroMin: null, shortBreakMin: null, longBreakMin: null, pomodorosPerChunk: null, chunks: null };

    await onSubmit(
      draft.dayOfWeeks.map((dayOfWeek) => ({
        kind: draft.kind,
        dayOfWeek,
        startMinute,
        endMinute,
        label: draft.label.trim() || null,
        enabled: draft.enabled,
        ...planFields,
      })),
    );
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
          <Paragraph margin={0}>{mode === 'create' ? 'Dias de la semana' : 'Dia de la semana'}</Paragraph>
          {mode === 'create' ? (
            <Paragraph margin={0} size="$2" color="$muted">
              Selecciona uno o mas dias: se creara este mismo horario para cada dia elegido.
            </Paragraph>
          ) : null}
          <XStack gap="$2" flexWrap="wrap">
            {DAY_NAMES_ES.map((dayName, index) => (
              <AppButton
                key={dayName}
                type="button"
                variant={draft.dayOfWeeks.includes(index) ? 'primary' : 'ghost'}
                onPress={() => toggleDay(index)}
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

        {draft.kind === 'WORK' ? (
          <AppCard backgroundColor="rgba(255,255,255,0.04)">
            <YStack gap="$3">
              <YStack gap="$1">
                <Text fontWeight="700">Plan de enfoque automatico</Text>
                <Paragraph margin={0} size="$2" color="$muted">
                  Ajusta la duracion del pomodoro, los descansos y cuantos pomodoros forman un bloque de trabajo.
                </Paragraph>
              </YStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack minWidth={150} gap="$1">
                  <Label htmlFor="schedule-pomodoro-min">Pomodoro (min)</Label>
                  <Input
                    id="schedule-pomodoro-min"
                    type="number"
                    min={1}
                    value={String(draft.pomodoroMin)}
                    onChangeText={(value: string) => setField('pomodoroMin', Number(value || 0))}
                  />
                </YStack>

                <YStack minWidth={150} gap="$1">
                  <Label htmlFor="schedule-short-break-min">Descanso corto (min)</Label>
                  <Input
                    id="schedule-short-break-min"
                    type="number"
                    min={1}
                    value={String(draft.shortBreakMin)}
                    onChangeText={(value: string) => setField('shortBreakMin', Number(value || 0))}
                  />
                </YStack>

                <YStack minWidth={150} gap="$1">
                  <Label htmlFor="schedule-long-break-min">Descanso largo (min)</Label>
                  <Input
                    id="schedule-long-break-min"
                    type="number"
                    min={1}
                    value={String(draft.longBreakMin)}
                    onChangeText={(value: string) => setField('longBreakMin', Number(value || 0))}
                  />
                </YStack>

                <YStack minWidth={150} gap="$1">
                  <Label htmlFor="schedule-pomodoros-per-chunk">Pomodoros por bloque</Label>
                  <Input
                    id="schedule-pomodoros-per-chunk"
                    type="number"
                    min={1}
                    max={12}
                    value={String(draft.pomodorosPerChunk)}
                    onChangeText={(value: string) => setField('pomodorosPerChunk', Number(value || 0))}
                  />
                </YStack>

                <YStack minWidth={150} gap="$1">
                  <Label htmlFor="schedule-chunks">Cantidad de bloques</Label>
                  <Input
                    id="schedule-chunks"
                    type="number"
                    min={1}
                    max={MAX_CHUNKS}
                    value={String(draft.chunks)}
                    onChangeText={(value: string) => {
                      setChunksTouched(true);
                      setField('chunks', Number(value || 0));
                    }}
                  />
                </YStack>
              </XStack>

              <Paragraph margin={0} size="$2" color="$muted">
                El horario descuenta automaticamente la hora de almuerzo (12:30 - 13:30) si tu rango la cubre; no se
                asignan pomodoros ni descansos en esa hora.
              </Paragraph>

              {focusPlanPreview && focusPlanPreview.pomodoros > 0 ? (
                <YStack gap="$1">
                  <Paragraph margin={0} color="$muted">
                    {focusPlanPreview.pomodoros} pomodoros · {focusPlanPreview.shortBreaks} descansos cortos ·{' '}
                    {focusPlanPreview.longBreaks} descansos largos (max {MAX_LONG_BREAKS})
                  </Paragraph>
                  {!focusPlanPreview.fits ? (
                    <Paragraph margin={0} size="$2" color="$error">
                      No cabe en el horario: necesitas {formatMinutes(focusPlanPreview.required)} y hay{' '}
                      {formatMinutes(focusPlanPreview.available)} disponibles. Reduce la cantidad de bloques u otros
                      valores.
                    </Paragraph>
                  ) : null}
                </YStack>
              ) : (
                <Paragraph margin={0} color="$muted">
                  El rango es muy corto para al menos un pomodoro con esta configuracion.
                </Paragraph>
              )}
            </YStack>
          </AppCard>
        ) : null}

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
            {isSubmitting
              ? 'Guardando...'
              : mode === 'create'
                ? draft.dayOfWeeks.length > 1
                  ? `Crear ${draft.dayOfWeeks.length} horarios`
                  : 'Crear horario'
                : 'Guardar cambios'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
