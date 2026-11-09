import { useEffect, useState } from 'react';
import {
  Activity,
  AppButton,
  BarChart3,
  CalendarDays,
  Eyebrow,
  Heart,
  HelpCircle,
  Leaf,
  Lightbulb,
  ListChecks,
  Paragraph,
  Plus,
  Settings,
  ShieldBan,
  Sunrise,
  Text,
  Timer,
  XStack,
  YStack,
  type IconProps,
} from '@calendar/ui';
import { TourMenu } from '../components/onboarding/TourMenu';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePanel, type PanelId } from '../context/PanelContext';
import { useQuickAdd } from '../context/QuickAddContext';
import { TOURS, type TourId } from '../lib/onboarding/tours';

interface NavLink {
  panel: PanelId;
  labelKey: string;
  Icon: (props: IconProps) => JSX.Element;
}

// agenda-redesign (2026-11-09): the routine destinations as labeled tabs (the icon-only groups weren't
// intuitive); the rest under "Más". The calendar is always the view underneath: "Calendario" just
// closes any open panel.
const MAIN_LINKS: NavLink[] = [
  { panel: 'horario', labelKey: 'nav.link.horario', Icon: CalendarDays },
  { panel: 'pomodoro', labelKey: 'nav.link.pomodoro', Icon: Timer },
  { panel: 'habits', labelKey: 'nav.link.habits', Icon: ListChecks },
];
const MORE_LINKS: NavLink[] = [
  { panel: 'ritual', labelKey: 'nav.link.ritual', Icon: Sunrise },
  { panel: 'wellness', labelKey: 'nav.link.wellness', Icon: Heart },
  { panel: 'dashboard', labelKey: 'nav.link.dashboard', Icon: BarChart3 },
  { panel: 'reports', labelKey: 'nav.link.reports', Icon: CalendarDays },
  { panel: 'suggestions', labelKey: 'nav.link.suggestions', Icon: Lightbulb },
  { panel: 'blocklist', labelKey: 'nav.link.blocklist', Icon: ShieldBan },
  { panel: 'fitness', labelKey: 'nav.link.fitness', Icon: Activity },
  { panel: 'detox', labelKey: 'nav.link.detox', Icon: Leaf },
];

function NavDivider() {
  return <YStack width={1} height={24} backgroundColor="$borderColor" />;
}

export function AppNav() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { openTutorial, startTour } = useOnboarding();
  const { activePanel, openPanel, closePanel } = usePanel();
  const { open: openQuickAdd } = useQuickAdd();
  const [isTourMenuOpen, setIsTourMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreActive = MORE_LINKS.some((l) => l.panel === activePanel);

  useEffect(() => {
    if (!isMoreOpen) return;
    function onDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-more-menu-root]')) setIsMoreOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMoreOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    if (!isTourMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-tour-menu-root]')) {
        setIsTourMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsTourMenuOpen(false);
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTourMenuOpen]);

  function handleSelectTour(tourId: TourId) {
    setIsTourMenuOpen(false);
    const tour = TOURS[tourId];
    if (tour.panel) {
      openPanel(tour.panel);
    } else if (activePanel) {
      closePanel();
    }
    // Give the slide-over panel time to animate in (or out) before the spotlight measures
    // its target -- matches the panel's own "quick" animation timing.
    window.setTimeout(() => startTour(tourId), tour.panel ? 380 : 0);
  }

  return (
    <XStack
      className="glass-surface"
      position="sticky"
      top={0}
      zIndex={10}
      justifyContent="space-between"
      alignItems="center"
      gap="$5"
      paddingHorizontal="$6"
      paddingVertical="$3"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
      flexWrap="wrap"
      data-tutorial="app-nav"
    >
      <XStack alignItems="center" gap="$5" flexWrap="wrap">
        <Eyebrow marginBottom={0}>{t('common.appName')}</Eyebrow>

        <AppButton
          variant="primary"
          onPress={openQuickAdd}
          aria-label={t('nav.newTask')}
          title={t('nav.newTask.title')}
          paddingHorizontal="$3"
          data-tutorial="nav-quick-add"
        >
          <Plus size={18} />
          <Text color="inherit" fontWeight="600">
            {t('nav.newTask')}
          </Text>
        </AppButton>

        <NavDivider />

        <XStack gap="$1" flexWrap="wrap" alignItems="center" role="tablist">
          <AppButton variant={activePanel === null ? 'primary' : 'ghost'} onPress={closePanel} data-tutorial="nav-calendar">
            <CalendarDays size={16} />
            <Text color="inherit" fontWeight="600">
              Calendario
            </Text>
          </AppButton>
          {MAIN_LINKS.map((link) => (
            <AppButton
              key={link.panel}
              variant={activePanel === link.panel ? 'primary' : 'ghost'}
              onPress={() => openPanel(link.panel)}
              data-tutorial={`nav-${link.panel}`}
            >
              <link.Icon size={16} />
              <Text color="inherit" fontWeight="600">
                {t(link.labelKey)}
              </Text>
            </AppButton>
          ))}
          <YStack position="relative" data-more-menu-root>
            <AppButton variant={moreActive ? 'primary' : 'ghost'} onPress={() => setIsMoreOpen((v) => !v)} aria-expanded={isMoreOpen}>
              <Text color="inherit" fontWeight="600">
                Más ▾
              </Text>
            </AppButton>
            {isMoreOpen ? (
              <YStack
                position="absolute"
                top="100%"
                left={0}
                marginTop="$1"
                minWidth={220}
                backgroundColor="$surface"
                borderWidth={1}
                borderColor="$borderColor"
                borderRadius="$3"
                padding="$1"
                zIndex={20}
                shadowColor="$shadowColor"
                shadowRadius={12}
              >
                {MORE_LINKS.map((link) => (
                  <AppButton
                    key={link.panel}
                    variant={activePanel === link.panel ? 'primary' : 'ghost'}
                    borderWidth={0}
                    justifyContent="flex-start"
                    onPress={() => {
                      setIsMoreOpen(false);
                      openPanel(link.panel);
                    }}
                    data-tutorial={`nav-${link.panel}`}
                  >
                    <link.Icon size={16} />
                    <Text color="inherit">{t(link.labelKey)}</Text>
                  </AppButton>
                ))}
              </YStack>
            ) : null}
          </YStack>
        </XStack>
      </XStack>

      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <Paragraph color="$muted" margin={0} size="$2">
          {user?.email ?? ''}
        </Paragraph>
        <AppButton
          variant={activePanel === 'settings' ? 'primary' : 'ghost'}
          onPress={() => openPanel('settings')}
          aria-label={t('settings.navLabel')}
          title={t('settings.navLabel')}
          paddingHorizontal="$3"
        >
          <Settings size={18} />
        </AppButton>
        <AppButton variant="ghost" onPress={openTutorial}>
          {t('nav.tutorial')}
        </AppButton>
        <YStack position="relative" data-tour-menu-root>
          <AppButton
            variant="ghost"
            onPress={() => setIsTourMenuOpen((value) => !value)}
            aria-label={t('nav.tutorial.open')}
            title={t('nav.tutorial.open')}
            paddingHorizontal="$3"
          >
            <HelpCircle size={18} />
          </AppButton>
          <TourMenu open={isTourMenuOpen} onSelect={handleSelectTour} />
        </YStack>
        <AppButton variant="ghost" onPress={() => void logout()}>
          {t('nav.logout')}
        </AppButton>
      </XStack>
    </XStack>
  );
}
