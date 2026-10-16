import { useEffect, useState } from 'react';
import { Input } from 'tamagui';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { isDesktop } from '../../lib/desktop';
import { useNightSettings } from '../../hooks/useNightWindowActive';
import { usePlan } from '../../hooks/usePlan';
import { saveStudyPlan } from '../../lib/plan/sync';
import {
  MIN_NIGHT_WINDOW_MINUTES,
  formatNightWindowMinutes,
  nightWindowDurationMinutes,
  parseNightTimeInput,
  setNightEnabled,
  setNightWindow,
} from '../../lib/desktop/nightWindow';

// Desktop half of mobile's "Bloqueo nocturno" card (apps/mobile/src/app/blocklist.tsx): the same
// on/off switch and HH:MM window with the same 10-hour floor. Only inside the Tauri shell -- a plain
// browser enforces nothing, so offering the setting there would suggest otherwise.
export function DesktopNightSettingsCard() {
  const { enabled, window: nightWindow } = useNightSettings();
  const { plan } = usePlan();
  const [startInput, setStartInput] = useState(() => formatNightWindowMinutes(nightWindow.startMinutes));
  const [endInput, setEndInput] = useState(() => formatNightWindowMinutes(nightWindow.endMinutes));
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setStartInput(formatNightWindowMinutes(nightWindow.startMinutes));
    setEndInput(formatNightWindowMinutes(nightWindow.endMinutes));
  }, [nightWindow.startMinutes, nightWindow.endMinutes]);

  useEffect(() => {
    if (!justSaved) return;
    const timeout = window.setTimeout(() => setJustSaved(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [justSaved]);

  if (!isDesktop) return null;

  function save() {
    const startMinutes = parseNightTimeInput(startInput);
    const endMinutes = parseNightTimeInput(endInput);
    if (startMinutes === null || endMinutes === null) {
      setError('Escribe la hora en formato HH:MM, por ejemplo 22:30.');
      return;
    }
    const result = setNightWindow({ startMinutes, endMinutes });
    setError(result.ok ? null : result.error);
    setJustSaved(result.ok);
    // The phone takes the same window (it's kept in the synced plan).
    if (result.ok && plan) void saveStudyPlan({ ...plan, nightWindow: { startMinutes, endMinutes } }).catch(() => undefined);
  }

  const durationHours =
    Math.round((nightWindowDurationMinutes(nightWindow.startMinutes, nightWindow.endMinutes) / 60) * 10) / 10;

  return (
    <AppCard>
      <YStack gap="$2">
        <H2 margin={0} fontSize="$5">
          Bloqueo nocturno en este computador
        </H2>
        <Paragraph margin={0} color="$muted">
          Cierra los programas y bloquea los sitios de la lista nocturna todas las noches, de{' '}
          {formatNightWindowMinutes(nightWindow.startMinutes)} a {formatNightWindowMinutes(nightWindow.endMinutes)}.
          Se configura por dispositivo: el horario del teléfono es independiente.
        </Paragraph>
        <XStack gap="$2">
          <AppButton type="button" variant={enabled ? 'primary' : 'ghost'} onPress={() => setNightEnabled(true)}>
            Activado
          </AppButton>
          <AppButton type="button" variant={!enabled ? 'primary' : 'ghost'} onPress={() => setNightEnabled(false)}>
            Desactivado
          </AppButton>
        </XStack>

        <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
          <Text fontWeight="700" fontSize="$3">
            Horario (mínimo {MIN_NIGHT_WINDOW_MINUTES / 60} horas)
          </Text>
          <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
            <YStack gap="$1">
              <Text color="$muted" fontSize="$2">
                Inicio
              </Text>
              <Input value={startInput} onChangeText={setStartInput} placeholder="22:30" width={100} />
            </YStack>
            <YStack gap="$1">
              <Text color="$muted" fontSize="$2">
                Fin
              </Text>
              <Input value={endInput} onChangeText={setEndInput} placeholder="08:00" width={100} />
            </YStack>
            <AppButton type="button" variant="primary" onPress={save}>
              Guardar horario
            </AppButton>
          </XStack>
          {error ? (
            <Text color="$danger" fontSize="$2">
              {error}
            </Text>
          ) : justSaved ? (
            <Text color="$accent" fontSize="$2" fontWeight="700">
              Horario guardado.
            </Text>
          ) : (
            <Text color="$muted" fontSize="$2">
              Dura {durationHours} horas (mínimo {MIN_NIGHT_WINDOW_MINUTES / 60}h). La hora de inicio debe
              ser más tarde que la de fin: la ventana siempre cruza la medianoche.
            </Text>
          )}
        </YStack>
      </YStack>
    </AppCard>
  );
}
