import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Paragraph, YStack } from '@calendar/ui';
import { useAuth } from '../context/AuthContext';

type Provider = 'google' | 'apple';

function getHashParams(): URLSearchParams {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithGoogle, loginWithApple } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const completeOAuth = async () => {
      const hashParams = getHashParams();

      const provider = (searchParams.get('provider') ?? hashParams.get('provider')) as Provider | null;
      const idToken =
        searchParams.get('id_token') ??
        searchParams.get('token') ??
        hashParams.get('id_token') ??
        hashParams.get('token');

      if (!provider || !idToken) {
        setErrorMessage('Missing provider or id_token in callback URL.');
        return;
      }

      try {
        if (provider === 'google') {
          await loginWithGoogle(idToken);
        } else {
          await loginWithApple(idToken);
        }

        navigate('/', { replace: true });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'OAuth callback failed.');
      }
    };

    void completeOAuth();
  }, [loginWithApple, loginWithGoogle, navigate, searchParams]);

  return (
    <YStack minHeight="100vh" alignItems="center" justifyContent="center" padding="$6">
      <Paragraph color="$muted">
        {errorMessage ?? 'Completing OAuth sign-in. Please wait...'}
      </Paragraph>
    </YStack>
  );
}
