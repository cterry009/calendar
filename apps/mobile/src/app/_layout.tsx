import { AppCard, Paragraph, TamaguiProvider, YStack } from '@calendar/ui';
import nativeTamaguiConfig from '@calendar/ui/tamagui.config.native';
import webTamaguiConfig from '@calendar/ui/tamagui.config';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { PomodoroProvider } from '../context/PomodoroContext';

// @tamagui/animations-react-native's RN `Animated.interpolate()` calls fail under
// react-native-web specifically (verified: same crash with any named animation, gone with none)
// -- true native Android/iOS gets the real RN Animated driver, the web dev-preview target gets
// the same CSS-driven config apps/web already uses successfully. Picked explicitly at runtime
// rather than relying on Metro's `.native.ts`/`.web.ts` platform-extension resolution, which
// (through the extraNodeModules proxy this app uses to reach packages/ui/src, see
// metro.config.js) kept preferring tamagui.config.native.ts even when bundling for web.
const tamaguiConfig = Platform.OS === 'web' ? webTamaguiConfig : nativeTamaguiConfig;

SplashScreen.preventAutoHideAsync();

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
        <Stack.Screen name="dashboard" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );

  // Only mounted once authenticated -- no point fetching pomodoro state pre-login, and it needs
  // a valid access token to succeed anyway.
  return isAuthenticated ? <PomodoroProvider>{navigator}</PomodoroProvider> : navigator;
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </TamaguiProvider>
  );
}
