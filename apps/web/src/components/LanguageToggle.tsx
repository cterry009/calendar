import { AppButton, XStack } from '@calendar/ui';
import { useLanguage } from '../context/LanguageContext';

export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <XStack gap="$1" aria-label={t('common.languageToggle.label')}>
      <AppButton
        type="button"
        variant={language === 'es' ? 'primary' : 'ghost'}
        paddingHorizontal="$2"
        onPress={() => setLanguage('es')}
        aria-pressed={language === 'es'}
      >
        ES
      </AppButton>
      <AppButton
        type="button"
        variant={language === 'en' ? 'primary' : 'ghost'}
        paddingHorizontal="$2"
        onPress={() => setLanguage('en')}
        aria-pressed={language === 'en'}
      >
        EN
      </AppButton>
    </XStack>
  );
}
