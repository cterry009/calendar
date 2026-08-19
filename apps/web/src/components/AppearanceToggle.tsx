import { AppButton, XStack } from '@calendar/ui';
import { useAppearance } from '../context/AppearanceContext';
import { useLanguage } from '../context/LanguageContext';

export function AppearanceToggle() {
  const { mode, setMode } = useAppearance();
  const { t } = useLanguage();

  return (
    <XStack gap="$1" aria-label={t('settings.appearance.title')}>
      <AppButton
        type="button"
        variant={mode === 'dark' ? 'primary' : 'ghost'}
        onPress={() => setMode('dark')}
        aria-pressed={mode === 'dark'}
      >
        {t('settings.appearance.dark')}
      </AppButton>
      <AppButton
        type="button"
        variant={mode === 'light' ? 'primary' : 'ghost'}
        onPress={() => setMode('light')}
        aria-pressed={mode === 'light'}
      >
        {t('settings.appearance.light')}
      </AppButton>
    </XStack>
  );
}
