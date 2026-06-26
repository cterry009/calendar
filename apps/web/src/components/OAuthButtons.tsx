import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppButton, Paragraph, YStack } from '@calendar/ui';
import { useAuth } from '../context/AuthContext';
import { env } from '../lib/env';

const GOOGLE_SCRIPT_ID = 'google-identity-services';
const APPLE_SCRIPT_ID = 'apple-signin-sdk';

function loadScriptOnce(id: string, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;

    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
          once: true,
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;

    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );

    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });

    document.head.appendChild(script);
  });
}

export function OAuthButtons() {
  const navigate = useNavigate();
  const { loginWithGoogle, loginWithApple } = useAuth();

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const setupGoogleButton = async () => {
      if (!env.googleClientId || !googleButtonRef.current) return;

      try {
        await loadScriptOnce(GOOGLE_SCRIPT_ID, 'https://accounts.google.com/gsi/client');

        if (!active || !window.google?.accounts?.id || !googleButtonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: env.googleClientId,
          callback: async (response) => {
            const idToken = response.credential;
            if (!idToken) {
              setErrorMessage('Google login did not return an ID token.');
              return;
            }

            try {
              await loginWithGoogle(idToken);
              navigate('/');
            } catch (error) {
              setErrorMessage(error instanceof Error ? error.message : 'Google login failed.');
            }
          },
        });

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 320,
        });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to initialize Google sign-in.');
      }
    };

    void setupGoogleButton();

    return () => {
      active = false;
    };
  }, [loginWithGoogle, navigate]);

  useEffect(() => {
    if (!env.appleClientId) return;

    void loadScriptOnce(
      APPLE_SCRIPT_ID,
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    ).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to initialize Apple sign-in.');
    });
  }, []);

  const handleAppleSignIn = async () => {
    if (!window.AppleID?.auth) {
      setErrorMessage('Apple sign-in SDK is not available.');
      return;
    }

    try {
      const result = await window.AppleID.auth.signIn();
      const idToken = result.authorization?.id_token;

      if (!idToken) {
        setErrorMessage('Apple login did not return an ID token.');
        return;
      }

      await loginWithApple(idToken);
      navigate('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Apple login failed.');
    }
  };

  if (!env.googleClientId && !env.appleClientId) {
    return null;
  }

  return (
    <YStack gap="$3">
      {env.googleClientId ? <div ref={googleButtonRef} /> : null}

      {env.appleClientId ? (
        <AppButton variant="outlined" onPress={handleAppleSignIn}>
          Continue with Apple
        </AppButton>
      ) : null}

      {errorMessage ? <Paragraph color="$danger">{errorMessage}</Paragraph> : null}
    </YStack>
  );
}
