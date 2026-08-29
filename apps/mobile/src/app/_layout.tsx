import { AppCard, Paragraph, TamaguiProvider, YStack } from '@calendar/ui';
import nativeTamaguiConfig from '@calendar/ui/tamagui.config.native';
import webTamaguiConfig from '@calendar/ui/tamagui.config';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { PomodoroProvider } from '../context/PomodoroContext';
import { SyncProvider } from '../context/SyncContext';
import { useFocusBlocking } from '../hooks/useFocusBlocking';
import { useHabitReminders } from '../hooks/useHabitReminders';
import { useJogDetection } from '../hooks/useJogDetection';
import { useNightBlocking } from '../hooks/useNightBlocking';
import { useStepTrackingService } from '../hooks/useStepTrackingService';

// @tamagui/animations-react-native's RN `Animated.interpolate()` calls fail under
// react-native-web specifically (verified: same crash with any named animation, gone with none)
// -- true native Android/iOS gets the real RN Animated driver, the web dev-preview target gets
// the same CSS-driven config apps/web already uses successfully. Picked explicitly at runtime
// rather than relying on Metro's `.native.ts`/`.web.ts` platform-extension resolution, which
// (through the extraNodeModules proxy this app uses to reach packages/ui/src, see
// metro.config.js) kept preferring tamagui.config.native.ts even when bundling for web.
const tamaguiConfig = Platform.OS === 'web' ? webTamaguiConfig : nativeTamaguiConfig;

SplashScreen.preventAutoHideAsync();

// useFocusBlocking() needs usePomodoro()/useBlockList(), so it has to run inside PomodoroProvider
// -- a bare hook-runner component instead of calling it directly in RootNavigator, which renders
// PomodoroProvider itself rather than being inside it.
function FocusBlockingBridge() {
  useFocusBlocking();
  return null;
}

// Doesn't need PomodoroProvider/useBlockList like FocusBlockingBridge does -- kept as its own
// bridge component anyway for symmetry and so it can be un-mounted independently later if needed.
function JogDetectionBridge() {
  useJogDetection();
  return null;
}

// Doesn't need PomodoroProvider (useBlockList() only depends on SyncContext) -- kept alongside
// the other bridges below for consistency, same as JogDetectionBridge/HabitRemindersBridge.
function NightBlockingBridge() {
  useNightBlocking();
  return null;
}

// Doesn't need any provider (starts a native foreground service directly) -- kept alongside the
// other bridges below for consistency, same as JogDetectionBridge/NightBlockingBridge.
function StepTrackingBridge() {
  useStepTrackingService();
  return null;
}

// Doesn't need PomodoroProvider (useHabits() only depends on SyncContext) -- kept alongside the
// other bridges below for consistency, same as JogDetectionBridge.
function HabitRemindersBridge() {
  useHabitReminders();
  return null;
}

function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <AppCard>
          <Paragraph margin={0}>Cargando...</Paragraph>
        </AppCard>
      </YStack>
    );
  }

  const navigator = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pomodoro" />
        <Stack.Screen name="fitness" />
        <Stack.Screen name="habits" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="blocklist" />
        <Stack.Screen name="screen-time" />
        <Stack.Screen name="blocked" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );

  // NotificationsProvider/PomodoroProvider/SyncStatusBanner only mounted once authenticated --
  // nothing to sync or notify about pre-login, and pulling requires a valid access token anyway.
  if (!isAuthenticated) {
    return navigator;
  }

  return (
    <NotificationsProvider>
      <PomodoroProvider>
        <FocusBlockingBridge />
        <JogDetectionBridge />
        <NightBlockingBridge />
        <StepTrackingBridge />
        <HabitRemindersBridge />
        <OnboardingProvider>
          <YStack flex={1}>
            <SyncStatusBanner />
            {navigator}
          </YStack>
        </OnboardingProvider>
      </PomodoroProvider>
    </NotificationsProvider>
  );
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <SyncProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SyncProvider>
    </TamaguiProvider>
  );
}
