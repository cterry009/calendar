import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppButton, Paragraph, YStack } from '@calendar/ui';
import { AuthFormField } from '../components/AuthFormField';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const formRef = useRef<HTMLFormElement | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await register({
        email,
        password,
        name: name.trim() ? name.trim() : undefined,
      });
      navigate('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to register.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Calendar Productivity"
      title="Create account"
      linkSlot={
        <Paragraph color="$muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </Paragraph>
      }
    >
      <YStack ref={formRef} gap="$3" tag="form" onSubmit={handleSubmit}>
        <AuthFormField
          id="name"
          label="Name (optional)"
          type="text"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
        />

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
          placeholder="Create a password"
          required
        />

        <AppButton
          variant="primary"
          onPress={() => formRef.current?.requestSubmit()}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </AppButton>
      </YStack>

      {errorMessage ? <Paragraph color="$danger">{errorMessage}</Paragraph> : null}
    </AuthLayout>
  );
}
