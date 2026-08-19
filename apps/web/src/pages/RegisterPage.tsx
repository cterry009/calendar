import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppButton, Paragraph, YStack } from '@calendar/ui';
import { AuthFormField } from '../components/AuthFormField';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useLanguage();

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
      setErrorMessage(error instanceof Error ? error.message : t('auth.register.genericError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={t('common.appName')}
      title={t('auth.register.title')}
      linkSlot={
        <Paragraph color="$muted">
          {t('auth.register.hasAccount')}{' '}
          <Link to="/login" style={{ color: '#4ee0a0', fontWeight: 600, textDecoration: 'underline' }}>
            {t('auth.register.signIn')}
          </Link>
        </Paragraph>
      }
    >
      <YStack ref={formRef} gap="$3" tag="form" onSubmit={handleSubmit}>
        <AuthFormField
          id="name"
          label={t('auth.register.nameLabel')}
          type="text"
          value={name}
          onChangeText={setName}
          placeholder={t('auth.register.namePlaceholder')}
        />

        <AuthFormField
          id="email"
          label={t('auth.register.emailLabel')}
          type="email"
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.register.emailPlaceholder')}
          required
        />

        <AuthFormField
          id="password"
          label={t('auth.register.passwordLabel')}
          type="password"
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.register.passwordPlaceholder')}
          required
        />

        <AppButton
          type="button"
          variant="primary"
          onPress={() => formRef.current?.requestSubmit()}
          disabled={isSubmitting}
        >
          {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
        </AppButton>
      </YStack>

      {errorMessage ? <Paragraph color="$danger">{errorMessage}</Paragraph> : null}
    </AuthLayout>
  );
}
