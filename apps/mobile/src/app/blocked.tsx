import { AppButton, AppCard, H1, Paragraph, YStack } from '@calendar/ui';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useBlockList } from '../hooks/useBlockList';

/**
 * Task 6.7. Reached via the calendarproductivity://blocked?package=<pkg> deep link
 * FocusBlockAccessibilityService.kt launches (task 6.6) after sending the user home with
 * GLOBAL_ACTION_HOME -- this screen is what they land on if they then reopen this app (or if it
 * was already in the background). Deliberately a plain message + "back to focus" action, not a
 * full breathing-pause exercise like apps/web's FrictionOverlay -- that component hasn't been
 * ported to mobile at all yet (a separate, standalone piece of work), so building a native
 * equivalent just for this screen would be scope creep beyond "overlay UI when a blocked app is
 * opened". Same "compact first slice" scope every other mobile screen in this port has used.
 */
export default function BlockedScreen() {
  const params = useLocalSearchParams<{ package?: string }>();
  const { entries } = useBlockList();

  // Task 7.28: under total lockdown the blocked package won't be in the block list at all -- any
  // app that isn't allowlisted gets kicked. Fall back to a lockdown-specific message instead of
  // claiming it's "en tu lista de bloqueo".
  const listedEntry = useMemo(
    () => entries.find((item) => item.identifier === params.package),
    [entries, params.package],
  );
  const label = listedEntry?.label ?? params.package ?? 'esta app';
  const message = listedEntry
    ? `${label} esta en tu lista de bloqueo y tenes un enfoque activo ahora mismo (pomodoro, tarea u horario de trabajo). Volvamos a lo que estabas haciendo.`
    : 'Tenes el bloqueo total activo durante este enfoque (pomodoro u horario de trabajo). Cualquier app que abras te trae de vuelta hasta que termine. Las llamadas y Ajustes siguen disponibles.';

  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$6">
      <Stack.Screen options={{ headerShown: false }} />

      <AppCard>
        <YStack gap="$4" alignItems="center">
          <H1 margin={0} textAlign="center" fontSize="$8">
            App bloqueada
          </H1>
          <Paragraph margin={0} textAlign="center" color="$muted">
            {message}
          </Paragraph>
          <AppButton variant="primary" onPress={() => router.replace('/')}>
            Volver al enfoque
          </AppButton>
        </YStack>
      </AppCard>
    </YStack>
  );
}
