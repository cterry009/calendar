import { AppButton, Text, YStack } from '@calendar/ui';
import { useLanguage } from '../../context/LanguageContext';
import type { TourId } from '../../lib/onboarding/tours';

interface TourMenuItem {
  id: TourId;
  labelKey: string;
}

const TOUR_MENU_ITEMS: TourMenuItem[] = [
  { id: 'global', labelKey: 'nav.tutorial.global' },
  { id: 'calendar', labelKey: 'nav.tutorial.calendar' },
  { id: 'tasks', labelKey: 'nav.tutorial.tasks' },
  { id: 'pomodoro', labelKey: 'nav.tutorial.pomodoro' },
  { id: 'blocklist', labelKey: 'nav.tutorial.blocklist' },
  { id: 'wellness', labelKey: 'nav.tutorial.wellness' },
  { id: 'habits', labelKey: 'nav.tutorial.habits' },
  { id: 'detox', labelKey: 'nav.tutorial.detox' },
];

interface TourMenuProps {
  open: boolean;
  onSelect: (tourId: TourId) => void;
}

// Purely presentational -- open/close state and outside-click handling live in AppNav,
// since it's the one that owns `isTourMenuOpen` and already renders the trigger button
// this menu is anchored under (both share one `data-tour-menu-root` wrapper).
export function TourMenu({ open, onSelect }: TourMenuProps) {
  const { t } = useLanguage();

  if (!open) {
    return null;
  }

  return (
    <YStack
      position="absolute"
      top="100%"
      right={0}
      marginTop="$2"
      zIndex={20}
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      padding="$2"
      gap="$1"
      minWidth={240}
      shadowColor="$shadowColor"
      shadowRadius={24}
      shadowOpacity={1}
      shadowOffset={{ width: 0, height: 8 }}
    >
      <Text color="$muted" fontSize="$1" textTransform="uppercase" letterSpacing={1} paddingHorizontal="$2" paddingTop="$1">
        {t('nav.tutorial.open')}
      </Text>
      {TOUR_MENU_ITEMS.map((item) => (
        <AppButton key={item.id} variant="ghost" justifyContent="flex-start" onPress={() => onSelect(item.id)}>
          {t(item.labelKey)}
        </AppButton>
      ))}
    </YStack>
  );
}
