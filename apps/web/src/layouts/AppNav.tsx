import {
  Activity,
  AppButton,
  BarChart3,
  Eyebrow,
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
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePanel, type PanelId } from '../context/PanelContext';
import { useQuickAdd } from '../context/QuickAddContext';

interface NavLink {
  panel: PanelId;
  labelKey: string;
  Icon: (props: IconProps) => JSX.Element;
}

interface NavGroup {
  labelKey: string;
  links: NavLink[];
}

// Grouped by why someone opens the section, not alphabetically or by build
// order — six flat icons read as a junk drawer; three purposes don't. The
// calendar itself has no entry here: it's always the view underneath.
const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'nav.group.plan',
    links: [
      { panel: 'ritual', labelKey: 'nav.link.ritual', Icon: Sunrise },
      { panel: 'dashboard', labelKey: 'nav.link.dashboard', Icon: BarChart3 },
      { panel: 'suggestions', labelKey: 'nav.link.suggestions', Icon: Lightbulb },
    ],
  },
  {
    labelKey: 'nav.group.focus',
    links: [
      { panel: 'pomodoro', labelKey: 'nav.link.pomodoro', Icon: Timer },
      { panel: 'blocklist', labelKey: 'nav.link.blocklist', Icon: ShieldBan },
    ],
  },
  {
    labelKey: 'nav.group.wellness',
    links: [
      { panel: 'habits', labelKey: 'nav.link.habits', Icon: ListChecks },
      { panel: 'fitness', labelKey: 'nav.link.fitness', Icon: Activity },
      { panel: 'detox', labelKey: 'nav.link.detox', Icon: Leaf },
    ],
  },
];

function NavDivider() {
  return <YStack width={1} height={24} backgroundColor="$borderColor" />;
}

export function AppNav() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { openTutorial } = useOnboarding();
  const { activePanel, openPanel } = usePanel();
  const { open: openQuickAdd } = useQuickAdd();

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
        >
          <Plus size={18} />
          <Text color="inherit" fontWeight="600">
            {t('nav.newTask')}
          </Text>
        </AppButton>

        <NavDivider />

        {NAV_GROUPS.map((group, index) => (
          <XStack key={group.labelKey} alignItems="center" gap="$3" flexWrap="wrap">
            {index > 0 ? <NavDivider /> : null}
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text
                fontSize="$1"
                color="$muted"
                textTransform="uppercase"
                letterSpacing={1.5}
                fontWeight="600"
              >
                {t(group.labelKey)}
              </Text>
              <XStack gap="$1" flexWrap="wrap">
                {group.links.map((link) => (
                  <AppButton
                    key={link.panel}
                    variant={activePanel === link.panel ? 'primary' : 'ghost'}
                    onPress={() => openPanel(link.panel)}
                    aria-label={t(link.labelKey)}
                    title={t(link.labelKey)}
                    paddingHorizontal="$3"
                  >
                    <link.Icon size={18} />
                  </AppButton>
                ))}
              </XStack>
            </XStack>
          </XStack>
        ))}
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
        <AppButton variant="ghost" onPress={() => void logout()}>
          {t('nav.logout')}
        </AppButton>
      </XStack>
    </XStack>
  );
}
