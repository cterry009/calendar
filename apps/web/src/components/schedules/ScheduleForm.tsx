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
  DEFAULT_CHUNKS,
  DEFAULT_POMODOROS_PER_CHUNK,
  MAX_CHUNKS,
  MAX_LONG_BREAKS,
  MINUTES_PER_DAY,
  availableFocusMinutes,
  computeEndMinuteForConfig,
  computeMaxChunks,
  countSegmentsByType,
  estimateFocusDurationMin,
  estimateLongBreakMin,
  estimateShortBreakMin,
  generateFocusPlan,
  loadFocusFeedbackHistory,
  type FocusPlanConfig,
} from '../../lib/pomodoro/planner';

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
  pomodorosPerChunk: number;
  chunks: number;
}

function defaultDraft(schedule?: SyncScheduleRecord): ScheduleFormDraft {
  const startMinute = schedule?.startMinute ?? 9 * 60;
  const endMinute = schedule?.endMinute ?? 18 * 60;
  const pomodoroMin = schedule?.pomodoroMin ?? estimateFocusDurationMin(loadFocusFeedbackHistory());
  const pomodorosPerChunk = schedule?.pomodorosPerChunk ?? DEFAULT_POMODOROS_PER_CHUNK;
  const shortBreakMin = schedule?.shortBreakMin ?? estimateShortBreakMin(pomodoroMin);
  const longBreakMin = schedule?.longBreakMin ?? estimateLongBreakMin(pomodoroMin, pomodorosPerChunk);

  // For a schedule that predates the "chunks drive the schedule" model (no stored chunk count),
  // seed from how many chunks its existing start/end range used to fit, so editing it doesn't
  // suddenly shrink an established workday. Brand-new schedules just get a sensible default.
  const chunks =
    schedule?.chunks ??
    (schedule
      ? Math.max(
          1,
          computeMaxChunks(availableFocusMinutes(startMinute, endMinute), {
            pomodoroMin,
            shortBreakMin,
            longBreakMin,
            pomodorosPerChunk,
          }),
        )
      : DEFAULT_CHUNKS);

  return {
    kind: schedule?.kind ?? 'WORK',
    dayOfWeeks: [schedule?.dayOfWeek ?? 1],
    startTime: minuteToTimeValue(startMinute),
    endTime: minuteToTimeValue(endMinute),
    label: schedule?.label ?? '',
    enabled: schedule?.enabled ?? true,
    pomodoroMin,
    pomodorosPerChunk,
    chunks,
  };
}

export function ScheduleForm({ mode, initialSchedule, isSubmitting, onSubmit, onCancel }: ScheduleFormProps) {
  const [draft, setDraft] = useState<ScheduleFormDraft>(() => defaultDraft(initialSchedule));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialSchedule));
    setError(null);
  }, [initialSchedule, mode]);

  // Breaks are never entered by hand -- always derived from the pomodoro length and pomodoros
  // per block, same formula the calendar grid and the pomodoro auto-start use.
  const shortBreakMin = useMemo(() => estimateShortBreakMin(draft.pomodoroMin), [draft.pomodoroMin]);
  const longBreakMin = useMemo(
    () => estimateLongBreakMin(draft.pomodoroMin, draft.pomodorosPerChunk),
    [draft.pomodoroMin, draft.pomodorosPerChunk],
  );

  const title = useMemo(
    () => (mode === 'create' ? 'Nuevo horario' : `Editar horario: ${initialSchedule?.label ?? 'sin etiqueta'}`),
    [initialSchedule?.label, mode],
  );

  // For WORK schedules the end time is a function of the block config, not a separate input.
  const focusPlanPreview = useMemo(() => {
    if (draft.kind !== 'WORK') return null;

    const startMinute = timeValueToMinute(draft.startTime);
    if (startMinute === null) return null;

    const config: FocusPlanConfig = {
      pomodoroMin: draft.pomodoroMin,
      shortBreakMin,
      longBreakMin,
      pomodorosPerChunk: draft.pomodorosPerChunk,
      chunks: draft.chunks,
    };

    const endMinute = computeEndMinuteForConfig(startMinute, config);
    const plan = generateFocusPlan(startMinute, endMinute, config);

    return {
      plan,
      endMinute,
      pomodoros: countSegmentsByType(plan, 'pomodoro'),
      shortBreaks: countSegmentsByType(plan, 'short-break'),
      longBreaks: countSegmentsByType(plan, 'long-break'),
      overflowsDay: endMinute > MINUTES_PER_DAY - 1,
    };
  }, [draft.kind, draft.startTime, draft.pomodoroMin, shortBreakMin, longBreakMin, draft.pomodorosPerChunk, draft.chunks]);

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
    if (startMinute === null) {
      setError('El formato de hora debe ser HH:MM.');
      return;
    }

    if (draft.dayOfWeeks.length === 0) {
      setError('Selecciona al menos un dia.');
      return;
    }

    let endMinute: number;
    let planFields: Pick<
      ScheduleFormValues,
      'pomodoroMin' | 'shortBreakMin' | 'longBreakMin' | 'pomodorosPerChunk' | 'chunks'
    >;

    if (draft.kind === 'WORK') {
      const planValues = [draft.pomodoroMin, shortBreakMin, longBreakMin, draft.pomodorosPerChunk, draft.chunks];
      if (planValues.some((value) => !Number.isInteger(value) || value < 1)) {
        setError('Los valores del plan de enfoque deben ser numeros enteros mayores o iguales a 1.');
        return;
      }

      if (draft.chunks > MAX_CHUNKS) {
        setError(`La cantidad de bloques no puede superar ${MAX_CHUNKS} (maximo ${MAX_LONG_BREAKS} descansos largos).`);
        return;
      }

      const config: FocusPlanConfig = {
        pomodoroMin: draft.pomodoroMin,
        shortBreakMin,
        longBreakMin,
        pomodorosPerChunk: draft.pomodorosPerChunk,
        chunks: draft.chunks,
      };
      endMinute = computeEndMinuteForConfig(startMinute, config);

      if (endMinute > MINUTES_PER_DAY - 1) {
        setError(
          `Con esta configuracion el horario terminaria a las ${minuteToTimeValue(endMinute)}, despues de ` +
            'medianoche. Reduce la cantidad de bloques, los pomodoros por bloque o las duraciones.',
        );
        return;
      }

      planFields = {
        pomodoroMin: draft.pomodoroMin,
        shortBreakMin,
        longBreakMin,
        pomodorosPerChunk: draft.pomodorosPerChunk,
        chunks: draft.chunks,
      };
    } else {
      const parsedEnd = timeValueToMinute(draft.endTime);
      if (parsedEnd === null) {
        setError('El formato de hora debe ser HH:MM.');
        return;
      }
      if (parsedEnd <= startMinute) {
        setError('La hora de fin debe ser mayor que la hora de inicio.');
        return;
      }
      endMinute = parsedEnd;
      planFields = { pomodoroMin: null, shortBreakMin: null, longBreakMin: null, pomodorosPerChunk: null, chunks: null };
    }

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

          {draft.kind === 'WORK' ? (
            <YStack flex={1} minWidth={180} gap="$2">
              <Label htmlFor="schedule-end-time-computed">Hora fin (calculada)</Label>
              <XStack
                id="schedule-end-time-computed"
                minHeight={42}
                borderRadius="$3"
                borderWidth={1}
                borderColor="$borderColor"
                backgroundColor="rgba(255,255,255,0.03)"
                paddingHorizontal="$3"
                alignItems="center"
              >
                <Text fontWeight="700">
                  {focusPlanPreview ? minuteToTimeValue(focusPlanPreview.endMinute) : '--:--'}
                </Text>
              </XStack>
            </YStack>
          ) : (
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
          )}
        </XStack>

        {draft.kind === 'WORK' ? (
          <AppCard backgroundColor="rgba(255,255,255,0.04)">
            <YStack gap="$3">
              <YStack gap="$1">
                <Text fontWeight="700">Plan de enfoque</Text>
                <Paragraph margin={0} size="$2" color="$muted">
                  Define la duracion del pomodoro (sugerido 30-45 min) y la cantidad de bloques: la hora de fin se
                  calcula automaticamente a partir de esto (no al reves). Los descansos no se editan a mano: se
                  calculan solos -- corto 5-10 min, largo 20-30 min -- segun el pomodoro y los pomodoros por bloque.
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
                  <Label htmlFor="schedule-short-break-min">Descanso corto (auto)</Label>
                  <XStack
                    id="schedule-short-break-min"
                    minHeight={42}
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor="$borderColor"
                    backgroundColor="rgba(255,255,255,0.03)"
                    paddingHorizontal="$3"
                    alignItems="center"
                  >
                    <Text fontWeight="700">{shortBreakMin} min</Text>
                  </XStack>
                </YStack>

                <YStack minWidth={150} gap="$1">
                  <Label htmlFor="schedule-long-break-min">Descanso largo (auto)</Label>
                  <XStack
                    id="schedule-long-break-min"
                    minHeight={42}
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor="$borderColor"
                    backgroundColor="rgba(255,255,255,0.03)"
                    paddingHorizontal="$3"
                    alignItems="center"
                  >
                    <Text fontWeight="700">{longBreakMin} min</Text>
                  </XStack>
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
                    onChangeText={(value: string) => setField('chunks', Number(value || 0))}
                  />
                </YStack>
              </XStack>

              <Paragraph margin={0} size="$2" color="$muted">
                Si el plan cruza el almuerzo (12:30 - 13:30), esa hora se salta automaticamente: no se asignan
                pomodoros ni descansos ahi, y la hora de fin se estira lo necesario.
              </Paragraph>

              {focusPlanPreview && focusPlanPreview.pomodoros > 0 ? (
                <YStack gap="$1">
                  <Paragraph margin={0} color="$muted">
                    {focusPlanPreview.pomodoros} pomodoros · {focusPlanPreview.shortBreaks} descansos cortos ·{' '}
                    {focusPlanPreview.longBreaks} descansos largos (max {MAX_LONG_BREAKS}) · termina a las{' '}
                    {minuteToTimeValue(focusPlanPreview.endMinute)}
                  </Paragraph>
                  {focusPlanPreview.overflowsDay ? (
                    <Paragraph margin={0} size="$2" color="$error">
                      Esta configuracion termina despues de medianoche. Reduce la cantidad de bloques u otros valores.
                    </Paragraph>
                  ) : null}
                </YStack>
              ) : null}
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
