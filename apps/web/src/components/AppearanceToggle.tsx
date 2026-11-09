import { AppButton, XStack } from '@calendar/ui';
import { useAppearance } from '../context/AppearanceContext';
import { useLanguage } from '../context/LanguageContext';

export function AppearanceToggle() {
  const { mode, setMode } = useAppearance();
  const { t } = useLanguage();

  return (
    <XStack gap="$1" flexWrap="wrap" aria-label={t('settings.appearance.title')}>
      {/* 2026-11-09: only the Agenda look (light/dark); the older looks stay in the code. */}
      <AppButton
        type="button"
        variant={mode === 'agendaLight' ? 'primary' : 'ghost'}
        onPress={() => setMode('agendaLight')}
        aria-pressed={mode === 'agendaLight'}
      >
        {t('settings.appearance.agendaLight')}
      </AppButton>
      <AppButton
        type="button"
        variant={mode === 'agendaDark' ? 'primary' : 'ghost'}
        onPress={() => setMode('agendaDark')}
        aria-pressed={mode === 'agendaDark'}
      >
        {t('settings.appearance.agendaDark')}
      </AppButton>
    </XStack>
  );
}
