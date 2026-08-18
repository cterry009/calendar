import type { ReactNode } from 'react';
import { Eyebrow, H1, Paragraph, XStack, YStack } from '@calendar/ui';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  tutorialId?: string;
  maxWidth?: number;
}

export function PageHeader({ eyebrow, title, description, actions, tutorialId, maxWidth = 720 }: PageHeaderProps) {
  return (
    <XStack
      justifyContent="space-between"
      alignItems="flex-start"
      gap="$4"
      flexWrap="wrap"
      data-tutorial={tutorialId}
    >
      <YStack maxWidth={maxWidth} minWidth={0} flexShrink={1} gap="$1">
        <Eyebrow>{eyebrow}</Eyebrow>
        <H1 marginTop={0} marginBottom={description ? '$1' : 0}>
          {title}
        </H1>
        {description ? (
          <Paragraph color="$muted" margin={0}>
            {description}
          </Paragraph>
        ) : null}
      </YStack>
      {actions ? (
        <XStack gap="$2" flexWrap="wrap">
          {actions}
        </XStack>
      ) : null}
    </XStack>
  );
}
