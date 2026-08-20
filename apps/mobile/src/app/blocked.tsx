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

  const label = useMemo(() => {
    const entry = entries.find((item) => item.identifier === params.package);
    return entry?.label ?? params.package ?? 'esta app';
  }, [entries, params.package]);

  return (
    <YStack flex={1} backgroundColor="$background" alignItems="center" justifyContent="center" padding="$6">
      <Stack.Screen options={{ headerShown: false }} />

      <AppCard>
        <YStack gap="$4" alignItems="center">
          <H1 margin={0} textAlign="center" fontSize="$8">
            App bloqueada
          </H1>
          <Paragraph margin={0} textAlign="center" color="$muted">
            {label} esta en tu lista de bloqueo y tenes un enfoque activo ahora mismo (pomodoro,
            tarea u horario de trabajo). Volvamos a lo que estabas haciendo.
          </Paragraph>
          <AppButton variant="primary" onPress={() => router.replace('/')}>
            Volver al enfoque
          </AppButton>
        </YStack>
      </AppCard>
    </YStack>
  );
}
