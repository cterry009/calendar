import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppButton,
  BarChart3,
  Eyebrow,
  HelpCircle,
  Plus,
  Settings,
  ShieldBan,
  Text,
  XStack,
  YStack,
} from '@calendar/ui';
import { TourMenu } from '../components/onboarding/TourMenu';
import { NavStats } from '../components/agenda/NavStats';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePanel } from '../context/PanelContext';
import { useQuickAdd } from '../context/QuickAddContext';
import { TOURS, type TourId } from '../lib/onboarding/tours';


// agenda-redesign (2026-11-09, the user's structure): three tabs -- Hoy, Proyectos (habits, exercise,
// the ritual, study, master's, papers by area) and Calendario (with its Horario). Estadísticas and
// Bloqueo under "Más". Sugerencias, Detox and the Pomodoro tab are gone from the nav (the pomodoro
// lives inside the work blocks); their code stays.
// 2026-11-10: "Hoy" lives in the calendar's Día view now; the nav is Proyectos and Calendario.
const PAGE_LINKS = [
  { path: '/proyectos', label: 'Proyectos' },
  { path: '/calendar', label: 'Calendario' },
];
const MORE_PAGES = [
  { path: '/estadisticas', label: 'Estadísticas', Icon: BarChart3 },
  { path: '/bloqueo', label: 'Bloqueo', Icon: ShieldBan },
];

function NavDivider() {
  return <YStack width={1} height={24} backgroundColor="$borderColor" />;
}

export function AppNav() {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { openTutorial, startTour } = useOnboarding();
  const { activePanel, openPanel, closePanel } = usePanel();
  const { open: openQuickAdd } = useQuickAdd();
  const [isTourMenuOpen, setIsTourMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const goTo = (path: string) => {
    if (activePanel) closePanel();
    navigate(path);
  };
  const moreActive = activePanel === null && MORE_PAGES.some((l) => l.path === pathname);

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
          {PAGE_LINKS.map((page) => (
            <AppButton
              key={page.path}
              variant={activePanel === null && (pathname === page.path || pathname.startsWith(`${page.path}/`)) ? 'primary' : 'ghost'}
              onPress={() => goTo(page.path)}
              data-tutorial={`nav-page-${page.path.slice(1)}`}
            >
              <Text color="inherit" fontWeight="600">
                {page.label}
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
                {MORE_PAGES.map((link) => (
                  <AppButton
                    key={link.path}
                    variant={activePanel === null && pathname === link.path ? 'primary' : 'ghost'}
                    borderWidth={0}
                    justifyContent="flex-start"
                    onPress={() => {
                      setIsMoreOpen(false);
                      goTo(link.path);
                    }}
                  >
                    <link.Icon size={16} />
                    <Text color="inherit">{link.label}</Text>
                  </AppButton>
                ))}
              </YStack>
            ) : null}
          </YStack>
        </XStack>
      </XStack>

      <XStack alignItems="center" gap="$2" flexWrap="wrap">
        <NavStats />
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
