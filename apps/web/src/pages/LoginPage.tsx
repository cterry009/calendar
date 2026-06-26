import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppButton, Paragraph, YStack } from '@calendar/ui';
import { AuthFormField } from '../components/AuthFormField';
import { AuthLayout } from '../components/AuthLayout';
import { OAuthButtons } from '../components/OAuthButtons';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const formRef = useRef<HTMLFormElement | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({ email, password });
      navigate('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Calendar Productivity"
      title="Sign in"
      linkSlot={
        <Paragraph color="$muted">
          No account yet? <Link to="/register">Create one</Link>
        </Paragraph>
      }
    >
      <YStack ref={formRef} gap="$3" tag="form" onSubmit={handleSubmit}>
        <AuthFormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          required
        />

        <AuthFormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          required
        />

        <AppButton variant="primary" onPress={() => formRef.current?.requestSubmit()} disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </AppButton>
      </YStack>

      <OAuthButtons />

      {errorMessage ? <Paragraph color="$danger">{errorMessage}</Paragraph> : null}
    </AuthLayout>
  );
}
