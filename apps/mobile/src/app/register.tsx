import { AppButton, AppCard, Eyebrow, H1, Paragraph, Text, YStack } from '@calendar/ui';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthFormField } from '../components/AuthFormField';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/auth/api';

export default function RegisterScreen() {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await register({ email, password, name: name.trim() ? name.trim() : undefined });
      // No navigation call needed -- _layout.tsx's Stack.Protected guard redirects to "/" as
      // soon as AuthContext's isAuthenticated flips true.
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'No se pudo crear la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#212e28' }}>
      {/* Same fix as login.tsx -- see its comment for why a plain centered YStack left the
          password field unreachable behind the keyboard. */}
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <YStack width="100%" maxWidth={560} alignSelf="center" padding="$6" gap="$5">
          <YStack gap="$1">
            <Eyebrow>Calendar Productivity</Eyebrow>
            <H1 marginTop={0} marginBottom={0}>
              Crear cuenta
            </H1>
          </YStack>

          <AppCard>
            <YStack gap="$3">
              <AuthFormField id="name" label="Nombre (opcional)" value={name} onChangeText={setName} placeholder="Tu nombre" />

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
                placeholder="Minimo 8 caracteres"
                secureTextEntry
              />

              <AppButton variant="primary" onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
              </AppButton>

              {errorMessage ? (
                <Text color="$danger" fontSize="$3">
                  {errorMessage}
                </Text>
              ) : null}
            </YStack>
          </AppCard>

          <Paragraph color="$muted" textAlign="center">
            Ya tenes cuenta?{' '}
            <Link href="/login">
              <Text color="$accent" fontWeight="700">
                Iniciar sesion
              </Text>
            </Link>
          </Paragraph>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
