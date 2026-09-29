import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Label, Paragraph, XStack, YStack } from '@calendar/ui';
import { TextArea } from 'tamagui';
import { FormField } from '../tasks/FormField';
import { ColorSwatchPicker } from './ColorSwatchPicker';
import { DEFAULT_HABIT_COLOR, HABIT_TYPE_DESCRIPTIONS, HABIT_TYPE_LABELS } from '../../lib/habits/labels';
import { HABIT_TYPES, type HabitFormValues } from '../../lib/habits/types';
import type { SyncHabit } from '../../lib/calendar/types';
import { ALL_DAYS, formatTimeInput, parseTimeInput, validateTimeBlock } from '../../lib/habits/timeBlock';

interface HabitFormProps {
  mode: 'create' | 'edit';
  initialHabit?: SyncHabit;
  isSubmitting: boolean;
  onSubmit: (values: HabitFormValues) => Promise<void>;
  onCancel: () => void;
}

interface HabitFormDraft {
  title: string;
  description: string;
  type: HabitFormValues['type'];
  dailyGoalValue: string;
  dailyGoalUnit: string;
  dailyGoalExtraValue: string;
  targetDays: string;
  color: string;
  category: string;
  linkedFitnessActivityType: string;
  blockStart: string;
  blockEnd: string;
  blockDays: number[];
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
// Shown Monday first, like the rest of the calendar.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function defaultDraft(habit?: SyncHabit): HabitFormDraft {
  return {
    title: habit?.title ?? '',
    description: habit?.description ?? '',
    type: habit?.type ?? 'NORMAL',
    dailyGoalValue: String(habit?.dailyGoalValue ?? 1),
    dailyGoalUnit: habit?.dailyGoalUnit ?? 'veces',
    dailyGoalExtraValue: habit?.dailyGoalExtraValue != null ? String(habit.dailyGoalExtraValue) : '',
    targetDays: String(habit?.targetDays ?? 66),
    color: habit?.color ?? DEFAULT_HABIT_COLOR,
    category: habit?.category ?? '',
    linkedFitnessActivityType: habit?.linkedFitnessActivityType ?? '',
    blockStart: formatTimeInput(habit?.reminderStartMinute ?? null),
    blockEnd: formatTimeInput(habit?.reminderEndMinute ?? null),
    blockDays: habit?.reminderDaysOfWeek?.length ? habit.reminderDaysOfWeek : ALL_DAYS,
  };
}

export function HabitForm({ mode, initialHabit, isSubmitting, onSubmit, onCancel }: HabitFormProps) {
  const [draft, setDraft] = useState<HabitFormDraft>(() => defaultDraft(initialHabit));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialHabit));
    setError(null);
  }, [initialHabit, mode]);

  const title = useMemo(
    () => (mode === 'create' ? 'Nuevo habito' : `Editar: ${initialHabit?.title ?? 'habito'}`),
    [initialHabit?.title, mode],
  );

  function setField<Key extends keyof HabitFormDraft>(field: Key, value: HabitFormDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) {
      setError('El titulo es obligatorio.');
      return;
    }

    const dailyGoalValue = Number(draft.dailyGoalValue);
    if (!Number.isFinite(dailyGoalValue) || dailyGoalValue < 0) {
      setError('La meta diaria debe ser un numero mayor o igual a 0.');
      return;
    }

    const targetDays = Number(draft.targetDays);
    if (!Number.isInteger(targetDays) || targetDays < 1) {
      setError('Los dias objetivo deben ser un entero mayor o igual a 1.');
      return;
    }

    let dailyGoalExtraValue: number | null = null;
    if (draft.dailyGoalExtraValue.trim()) {
      const parsed = Number(draft.dailyGoalExtraValue);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('La meta extra debe ser un numero mayor a 0, o dejarse vacia.');
        return;
      }
      dailyGoalExtraValue = parsed;
    }

    const blockStart = parseTimeInput(draft.blockStart);
    const blockEnd = parseTimeInput(draft.blockEnd);
    if (blockStart === undefined || blockEnd === undefined) {
      setError('Escribe las horas del bloque en formato HH:MM, por ejemplo 07:30.');
      return;
    }
    const blockError = validateTimeBlock(blockStart, blockEnd, draft.blockDays);
    if (blockError) {
      setError(blockError);
      return;
    }

    await onSubmit({
      title: trimmedTitle,
      description: draft.description.trim() || null,
      type: draft.type,
      dailyGoalValue,
      dailyGoalUnit: draft.dailyGoalUnit.trim() || 'veces',
      dailyGoalExtraValue,
      targetDays,
      color: draft.color,
      category: draft.category.trim() || null,
      linkedFitnessActivityType: draft.linkedFitnessActivityType.trim() || null,
      reminderStartMinute: blockEnd == null ? null : blockStart,
      reminderEndMinute: blockEnd,
      reminderDaysOfWeek: [...draft.blockDays].sort(),
    });
  }

  function toggleBlockDay(day: number) {
    setDraft((current) => ({
      ...current,
      blockDays: current.blockDays.includes(day)
        ? current.blockDays.filter((value) => value !== day)
        : [...current.blockDays, day],
    }));
  }

  return (
    <AppCard>
      <YStack gap="$4" tag="form" onSubmit={handleSubmit}>
        <H2 margin={0} fontSize="$6">
          {title}
        </H2>

        <YStack gap="$2">
          <Paragraph margin={0}>Tipo</Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            {HABIT_TYPES.map((type) => (
              <AppButton
                key={type}
                type="button"
                variant={draft.type === type ? 'primary' : 'ghost'}
                onPress={() => setField('type', type)}
              >
                {HABIT_TYPE_LABELS[type]}
              </AppButton>
            ))}
          </XStack>
          <Paragraph size="$2" color="$muted" margin={0}>
            {HABIT_TYPE_DESCRIPTIONS[draft.type]}
          </Paragraph>
        </YStack>

        <FormField
          id="habit-title"
          label="Titulo"
          placeholder="Ej. Meditar, Leer, Evitar redes sociales"
          value={draft.title}
          onChangeText={(value: string) => setField('title', value)}
          required
        />

        <XStack gap="$3" flexWrap="wrap">
          <YStack minWidth={140} flex={1}>
            <FormField
              id="habit-daily-goal-value"
              label="Meta diaria"
              type="number"
              min={0}
              step="any"
              value={draft.dailyGoalValue}
              onChangeText={(value: string) => setField('dailyGoalValue', value)}
              required
            />
          </YStack>
          <YStack minWidth={140} flex={1}>
            <FormField
              id="habit-daily-goal-unit"
              label="Unidad"
              placeholder="veces, min, paginas..."
              value={draft.dailyGoalUnit}
              onChangeText={(value: string) => setField('dailyGoalUnit', value)}
            />
          </YStack>
          <YStack minWidth={140} flex={1}>
            <FormField
              id="habit-daily-goal-extra"
              label={draft.type === 'NORMAL' ? 'Meta extra (opcional)' : 'Tolerancia maxima (opcional)'}
              type="number"
              min={0.01}
              step="any"
              value={draft.dailyGoalExtraValue}
              onChangeText={(value: string) => setField('dailyGoalExtraValue', value)}
            />
          </YStack>
        </XStack>

        <XStack gap="$3" flexWrap="wrap">
          <YStack minWidth={140} flex={1}>
            <FormField
              id="habit-target-days"
              label="Dias para consolidar"
              type="number"
              min={1}
              value={draft.targetDays}
              onChangeText={(value: string) => setField('targetDays', value)}
              required
            />
          </YStack>
          <YStack minWidth={180} flex={1}>
            <FormField
              id="habit-category"
              label="Categoria (opcional)"
              placeholder="Salud, trabajo, mente..."
              value={draft.category}
              onChangeText={(value: string) => setField('category', value)}
            />
          </YStack>
        </XStack>

        <YStack gap="$2">
          <Label>Color</Label>
          <ColorSwatchPicker value={draft.color} onChange={(color) => setField('color', color)} />
        </YStack>

        <YStack gap="$1">
          <FormField
            id="habit-linked-fitness"
            label="Auto-completar con Fitness (opcional)"
            placeholder="Ej. Correr -- debe coincidir con el tipo de actividad en Fitness"
            value={draft.linkedFitnessActivityType}
            onChangeText={(value: string) => setField('linkedFitnessActivityType', value)}
          />
          <Paragraph size="$1" color="$muted" margin={0}>
            Si registras un ejercicio en Fitness con este mismo nombre (sin importar mayusculas), el check-in de hoy
            se completa solo.
          </Paragraph>
        </YStack>

        <YStack gap="$2">
          <Label>Bloque en el horario (opcional)</Label>
          <Paragraph size="$1" color="$muted" margin={0}>
            Cuando lo haces. Aparece como bloque en tu calendario y el telefono te lo recuerda. Solo hora de fin si
            es algo "antes de las X" (p. ej. despertarse antes de las 07:00).
          </Paragraph>
          <XStack gap="$3" flexWrap="wrap">
            <YStack minWidth={120} flex={1}>
              <FormField
                id="habit-block-start"
                label="Inicio (opcional)"
                placeholder="07:00"
                value={draft.blockStart}
                onChangeText={(value: string) => setField('blockStart', value)}
              />
            </YStack>
            <YStack minWidth={120} flex={1}>
              <FormField
                id="habit-block-end"
                label="Fin / hora limite"
                placeholder="08:00"
                value={draft.blockEnd}
                onChangeText={(value: string) => setField('blockEnd', value)}
              />
            </YStack>
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            {DAY_ORDER.map((day) => (
              <AppButton
                key={day}
                type="button"
                variant={draft.blockDays.includes(day) ? 'primary' : 'ghost'}
                onPress={() => toggleBlockDay(day)}
              >
                {DAY_LABELS[day]}
              </AppButton>
            ))}
          </XStack>
        </YStack>

        <YStack gap="$2">
          <Label htmlFor="habit-description">Descripcion (opcional)</Label>
          <TextArea
            id="habit-description"
            value={draft.description}
            onChangeText={(value: string) => setField('description', value)}
            placeholder="Por que este habito, o como sabes que lo cumpliste"
            minHeight={80}
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
            {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear habito' : 'Guardar cambios'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}
