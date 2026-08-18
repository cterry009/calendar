import {
  Activity,
  AppButton,
  BarChart3,
  Eyebrow,
  Leaf,
  Lightbulb,
  Paragraph,
  ShieldBan,
  Sunrise,
  Text,
  Timer,
  XStack,
  YStack,
  type IconProps,
} from '@calendar/ui';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePanel, type PanelId } from '../context/PanelContext';

interface NavLink {
  panel: PanelId;
  label: string;
  Icon: (props: IconProps) => JSX.Element;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

// Grouped by why someone opens the section, not alphabetically or by build
// order — six flat icons read as a junk drawer; three purposes don't. The
// calendar itself has no entry here: it's always the view underneath.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Planear',
    links: [
      { panel: 'ritual', label: 'Ritual diario', Icon: Sunrise },
      { panel: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
      { panel: 'suggestions', label: 'Sugerencias', Icon: Lightbulb },
    ],
  },
  {
    label: 'Enfocarme',
    links: [
      { panel: 'pomodoro', label: 'Pomodoro', Icon: Timer },
      { panel: 'blocklist', label: 'Bloqueo', Icon: ShieldBan },
    ],
  },
  {
    label: 'Bienestar',
    links: [
      { panel: 'fitness', label: 'Fitness', Icon: Activity },
      { panel: 'detox', label: 'Detox', Icon: Leaf },
    ],
  },
];

function NavDivider() {
  return <YStack width={1} height={24} backgroundColor="$borderColor" />;
}

export function AppNav() {
  const { user, logout } = useAuth();
  const { openTutorial } = useOnboarding();
  const { activePanel, openPanel } = usePanel();

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
        <Eyebrow marginBottom={0}>Calendar Productivity</Eyebrow>

        {NAV_GROUPS.map((group, index) => (
          <XStack key={group.label} alignItems="center" gap="$3" flexWrap="wrap">
            {index > 0 ? <NavDivider /> : null}
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text
                fontSize="$1"
                color="$muted"
                textTransform="uppercase"
                letterSpacing={1.5}
                fontWeight="600"
              >
                {group.label}
              </Text>
              <XStack gap="$1" flexWrap="wrap">
                {group.links.map((link) => (
                  <AppButton
                    key={link.panel}
                    variant={activePanel === link.panel ? 'primary' : 'ghost'}
                    onPress={() => openPanel(link.panel)}
                    aria-label={link.label}
                    title={link.label}
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
        <AppButton variant="ghost" onPress={openTutorial}>
          Tutorial
        </AppButton>
        <AppButton variant="ghost" onPress={() => void logout()}>
          Salir
        </AppButton>
      </XStack>
    </XStack>
  );
}
