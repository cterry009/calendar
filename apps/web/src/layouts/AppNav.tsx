import { useLocation, useNavigate } from 'react-router-dom';
import { AppButton, Eyebrow, Paragraph, XStack } from '@calendar/ui';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';

const NAV_LINKS: { to: string; label: string }[] = [
  { to: '/calendar', label: 'Calendario' },
  { to: '/fitness', label: 'Fitness' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/blocklist', label: 'Bloqueo' },
  { to: '/detox', label: 'Detox' },
];

export function AppNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { openTutorial } = useOnboarding();

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      gap="$4"
      paddingHorizontal="$6"
      paddingVertical="$3"
      backgroundColor="$surface"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
      flexWrap="wrap"
      data-tutorial="app-nav"
    >
      <XStack alignItems="center" gap="$5" flexWrap="wrap">
        <Eyebrow marginBottom={0}>Calendar Productivity</Eyebrow>
        <XStack gap="$1" flexWrap="wrap">
          {NAV_LINKS.map((link) => (
            <AppButton
              key={link.to}
              variant={location.pathname === link.to ? 'primary' : 'ghost'}
              onPress={() => navigate(link.to)}
            >
              {link.label}
            </AppButton>
          ))}
        </XStack>
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
