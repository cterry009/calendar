import { AppCard, H3, Paragraph, XStack, YStack } from '@calendar/ui';
import { AppearanceToggle } from '../components/AppearanceToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import { PageHeader } from '../components/PageHeader';
import { useLanguage } from '../context/LanguageContext';

export function SettingsPage() {
  const { t } = useLanguage();

  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$7" gap="$5">
      <PageHeader eyebrow={t('settings.eyebrow')} title={t('settings.title')} description={t('settings.description')} />

      <AppCard>
        <YStack gap="$3">
          <H3 margin={0} fontSize="$5">
            {t('settings.language.title')}
          </H3>
          <Paragraph margin={0} color="$muted">
            {t('settings.language.description')}
          </Paragraph>
          <XStack>
            <LanguageToggle />
          </XStack>
        </YStack>
      </AppCard>

      <AppCard>
        <YStack gap="$3">
          <H3 margin={0} fontSize="$5">
            {t('settings.appearance.title')}
          </H3>
          <Paragraph margin={0} color="$muted">
            {t('settings.appearance.description')}
          </Paragraph>
          <XStack>
            <AppearanceToggle />
          </XStack>
        </YStack>
      </AppCard>
    </YStack>
  );
}
