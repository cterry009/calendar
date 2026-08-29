import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthFormField } from '../components/AuthFormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/auth/api';

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({ email, password });
      // No navigation call needed -- _layout.tsx's Stack.Protected guard redirects to "/" as
      // soon as AuthContext's isAuthenticated flips true.
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'No se pudo iniciar sesion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#212e28' }}>
      {/* A real bug found testing this exact screen on-device: without a ScrollView, this
          screen's content was just a fixed flex:1/justifyContent:center YStack -- Android's
          android:windowSoftInputMode="adjustResize" (already set in AndroidManifest.xml) does
          shrink the window when the keyboard opens, but a non-scrollable, centered layout has
          nowhere for the overflow to go, so the password field (below center) ended up hidden
          behind the keyboard with no way to reach it. keyboardShouldPersistTaps="handled" so a
          tap on the submit button doesn't get eaten as a "dismiss keyboard" gesture first. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          <YStack gap="$1">
            <Eyebrow>Calendar Productivity</Eyebrow>
            <H1 marginTop={0} marginBottom={0}>
              Iniciar sesion
            </H1>
          </YStack>

          <AppCard>
            <YStack gap="$3">
              <AuthFormField
                id="email"
                label="Correo electronico"
                value={email}
                onChangeText={setEmail}
                placeholder="vos@ejemplo.com"
                keyboardType="email-address"
              />

              <AuthFormField
                id="password"
                label="Contrasena"
                value={password}
                onChangeText={setPassword}
                placeholder="********"
                secureTextEntry
              />

              <AppButton variant="primary" onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Ingresando...' : 'Ingresar'}
              </AppButton>

              {errorMessage ? (
                <Text color="$danger" fontSize="$3">
                  {errorMessage}
                </Text>
              ) : null}
            </YStack>
          </AppCard>

          <Paragraph color="$muted" textAlign="center">
            No tenes cuenta todavia?{' '}
            <Link href="/register">
              <Text color="$accent" fontWeight="700">
                Crear una
              </Text>
            </Link>
          </Paragraph>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
