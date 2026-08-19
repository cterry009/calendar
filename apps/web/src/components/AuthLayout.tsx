import type { ReactNode } from 'react';
import { AppCard, Eyebrow, H1, YStack } from '@calendar/ui';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  linkSlot?: ReactNode;
}

export function AuthLayout({ eyebrow, title, children, linkSlot }: AuthLayoutProps) {
  return (
    <YStack
      minHeight="100vh"
      alignItems="center"
      justifyContent="center"
      backgroundColor="$background"
      padding="$6"
    >
      <AppCard width="100%" maxWidth={460}>
        <YStack gap="$4">
          <YStack gap="$2">
            <Eyebrow>{eyebrow}</Eyebrow>
            <H1 fontSize="$8">{title}</H1>
          </YStack>
          {children}
          {linkSlot}
        </YStack>
      </AppCard>
    </YStack>
  );
}
