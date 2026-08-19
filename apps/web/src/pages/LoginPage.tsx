import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppButton, Paragraph, YStack } from '@calendar/ui';
import { AuthFormField } from '../components/AuthFormField';
import { AuthLayout } from '../components/AuthLayout';
import { OAuthButtons } from '../components/OAuthButtons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

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
      setErrorMessage(error instanceof Error ? error.message : t('auth.login.genericError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={t('common.appName')}
      title={t('auth.login.title')}
      linkSlot={
        <Paragraph color="$muted">
          {t('auth.login.noAccount')}{' '}
          <Link to="/register" style={{ color: '#4ee0a0', fontWeight: 600, textDecoration: 'underline' }}>
            {t('auth.login.createOne')}
          </Link>
        </Paragraph>
      }
    >
      <YStack ref={formRef} gap="$3" tag="form" onSubmit={handleSubmit}>
        <AuthFormField
          id="email"
          label={t('auth.login.emailLabel')}
          type="email"
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.login.emailPlaceholder')}
          required
        />

        <AuthFormField
          id="password"
          label={t('auth.login.passwordLabel')}
          type="password"
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.login.passwordPlaceholder')}
          required
        />

        <AppButton
          type="button"
          variant="primary"
          onPress={() => formRef.current?.requestSubmit()}
          disabled={isSubmitting}
        >
          {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
        </AppButton>
      </YStack>

      <OAuthButtons />

      {errorMessage ? <Paragraph color="$danger">{errorMessage}</Paragraph> : null}
    </AuthLayout>
  );
}
