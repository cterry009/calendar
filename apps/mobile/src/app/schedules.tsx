import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { AuthFormField } from '../components/AuthFormField';
import { useCalendarData } from '../hooks/useCalendarData';
import type { SyncScheduleRecord } from '../lib/calendar/types';
import { confirmDestructiveAction } from '../lib/confirmAction';
import { DAY_LETTERS, deleteSchedule, draftError, draftFrom, hhmm, saveSchedule, type ScheduleDraft } from '../lib/schedules/api';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function daysLabel(days: number[]): string {
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Lunes a viernes';
  if (sorted.length === 7) return 'Todos los días';
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

/** Monday first, Sunday last, then by start time. */
function weekOrder(s: SyncScheduleRecord): number {
  const first = Math.min(...s.daysOfWeek.map((d) => (d === 0 ? 7 : d)));
  return first * 24 * 60 + s.startMinute;
}

function Toggle({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      <YStack
        minWidth={38}
        paddingHorizontal="$2"
        height={38}
        borderRadius={19}
        borderWidth={1}
        borderColor="$accent"
        backgroundColor={on ? '$accent' : 'transparent'}
        alignItems="center"
        justifyContent="center"
      >
        <Text fontSize="$3" fontWeight="700" color={on ? '$background' : '$color'}>
          {label}
        </Text>
      </YStack>
    </Pressable>
  );
}

function ScheduleForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: ScheduleDraft;
  saving: boolean;
  onSave: (draft: ScheduleDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ScheduleDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggleDay = (day: number) =>
    set({ daysOfWeek: draft.daysOfWeek.includes(day) ? draft.daysOfWeek.filter((d) => d !== day) : [...draft.daysOfWeek, day].sort() });

  return (
    <AppCard>
      <YStack gap="$3">
        <AuthFormField id="schedule-label" label="Nombre" value={draft.label} onChangeText={(label) => set({ label })} placeholder="Estudio B1" autoCapitalize="sentences" />
        <YStack gap="$2">
          <Text fontSize="$3">Tipo</Text>
          <XStack gap="$2">
            <Toggle on={draft.kind === 'WORK'} label="Trabajo" onPress={() => set({ kind: 'WORK' })} />
            <Toggle on={draft.kind === 'REST'} label="Descanso" onPress={() => set({ kind: 'REST' })} />
          </XStack>
        </YStack>
        <YStack gap="$2">
          <Text fontSize="$3">Días</Text>
          <XStack gap="$2" flexWrap="wrap">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <Toggle key={day} on={draft.daysOfWeek.includes(day)} label={DAY_LETTERS[day]} onPress={() => toggleDay(day)} />
            ))}
          </XStack>
        </YStack>
        <XStack gap="$3">
          <YStack flex={1}>
            <AuthFormField id="schedule-start" label="Inicio" value={draft.start} onChangeText={(start) => set({ start })} keyboardType="numbers-and-punctuation" placeholder="09:00" />
          </YStack>
          <YStack flex={1}>
            <AuthFormField id="schedule-end" label="Fin" value={draft.end} onChangeText={(end) => set({ end })} keyboardType="numbers-and-punctuation" placeholder="10:30" />
          </YStack>
        </XStack>
        <XStack gap="$2" alignItems="center">
          <Toggle on={draft.enabled} label={draft.enabled ? 'Activo' : 'Pausado'} onPress={() => set({ enabled: !draft.enabled })} />
          <Text fontSize="$2" color="$muted" flex={1}>
            Un horario pausado no avisa, no bloquea apps y el plan no lo usa.
          </Text>
        </XStack>
        {error ? (
          <Text color="$danger" fontSize="$3">
            {error}
          </Text>
        ) : null}
        <XStack gap="$3">
          <AppButton variant="ghost" flex={1} onPress={onCancel} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton
            variant="primary"
            flex={1}
            disabled={saving}
            onPress={() => {
              const problem = draftError(draft);
              setError(problem);
              if (!problem) onSave(draft);
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </AppButton>
        </XStack>
      </YStack>
    </AppCard>
  );
}

/**
 * Work and rest schedules on the phone (user-requested, 2026-10-02): until now they could only be
 * created, edited or deleted from the desktop/web. Same sync changes as the web's ScheduleManager.
 */
export default function SchedulesScreen() {
  const { schedules, refetch, isLoading } = useCalendarData();
  const [editing, setEditing] = useState<SyncScheduleRecord | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sorted = useMemo(() => [...schedules].sort((a, b) => weekOrder(a) - weekOrder(b)), [schedules]);

  const save = async (draft: ScheduleDraft) => {
    setSaving(true);
    setMessage(null);
    try {
      await saveSchedule(draft, editing === 'new' || editing === null ? undefined : editing);
      setEditing(null);
      await refetch();
      setMessage('Guardado.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo guardar el horario.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (schedule: SyncScheduleRecord) =>
    confirmDestructiveAction('Eliminar horario', `¿Eliminar "${schedule.label ?? 'este horario'}"? No se puede deshacer.`, 'Eliminar', () => {
      void (async () => {
        try {
          await deleteSchedule(schedule);
          await refetch();
          setMessage(`Se eliminó "${schedule.label ?? 'el horario'}".`);
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'No se pudo eliminar el horario.');
        }
      })();
    });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#212e28' }} contentContainerStyle={{ alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <YStack width="100%" maxWidth={560} padding="$5" gap="$4">
        <Stack.Screen options={{ title: 'Horarios', headerShown: true, headerStyle: { backgroundColor: '#212e28' }, headerTintColor: '#f2f7f4' }} />
        <YStack gap="$1">
          <Eyebrow>Planificación</Eyebrow>
          <H1 marginTop={0} marginBottom={0}>
            Horarios
          </H1>
          <Paragraph color="$muted" margin={0}>
            Tus bloques de trabajo y descanso. Los de trabajo avisan al empezar, bloquean distracciones y son donde el plan pone tus tareas.
          </Paragraph>
        </YStack>

        {message ? <Paragraph margin={0}>{message}</Paragraph> : null}

        {editing === 'new' ? (
          <ScheduleForm initial={draftFrom()} saving={saving} onSave={(d) => void save(d)} onCancel={() => setEditing(null)} />
        ) : (
          <AppButton variant="primary" onPress={() => setEditing('new')}>
            Nuevo horario
          </AppButton>
        )}

        {isLoading && sorted.length === 0 ? <Paragraph color="$muted">Cargando…</Paragraph> : null}

        {sorted.map((s) =>
          editing !== 'new' && editing?.id === s.id ? (
            <ScheduleForm key={s.id} initial={draftFrom(s)} saving={saving} onSave={(d) => void save(d)} onCancel={() => setEditing(null)} />
          ) : (
            <AppCard key={s.id} opacity={s.enabled ? 1 : 0.55}>
              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="700">
                  {s.label ?? (s.kind === 'WORK' ? 'Bloque de trabajo' : 'Descanso')}
                </Text>
                <Text fontSize="$2" color="$muted">
                  {s.kind === 'WORK' ? 'Trabajo' : 'Descanso'} · {daysLabel(s.daysOfWeek)} · {hhmm(s.startMinute)}-{hhmm(s.endMinute)}
                  {s.enabled ? '' : ' · pausado'}
                </Text>
                <XStack gap="$3">
                  <AppButton variant="ghost" flex={1} onPress={() => setEditing(s)}>
                    Editar
                  </AppButton>
                  <AppButton variant="ghost" flex={1} onPress={() => remove(s)}>
                    Eliminar
                  </AppButton>
                </XStack>
              </YStack>
            </AppCard>
          ),
        )}
      </YStack>
    </ScrollView>
  );
}
