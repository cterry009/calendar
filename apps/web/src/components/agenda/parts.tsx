import type { ReactNode } from 'react';
import { Text, XStack, YStack } from '@calendar/ui';

// Building blocks of the side panel in the Agenda look: a card with a color stripe, a status pill, a
// progress bar and a section title.

export function StripeCard({ color, children }: { color?: string | null; children: ReactNode }) {
  return (
    <YStack
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$borderColor"
      borderLeftWidth={4}
      borderLeftColor={color ?? '$accent'}
      borderRadius="$3"
      padding="$3"
      gap="$2"
    >
      {children}
    </YStack>
  );
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'success' | 'warning' | 'danger' }) {
  const color = tone === 'muted' ? '$muted' : `$${tone}`;
  return (
    <Text fontSize={12} color={color} borderWidth={1} borderColor={tone === 'muted' ? '$borderColor' : color} borderRadius={999} paddingHorizontal={8} paddingVertical={1}>
      {children}
    </Text>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string | null }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <YStack height={6} borderRadius={3} backgroundColor="$borderColor" overflow="hidden" aria-label={`${pct} %`}>
      <YStack height="100%" width={`${pct}%`} backgroundColor={color ?? '$accent'} />
    </YStack>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text fontSize={12} fontWeight="700" color="$muted" textTransform="uppercase" letterSpacing={0.6}>
        {children}
      </Text>
      {right}
    </XStack>
  );
}

export function SummaryLine({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="$3" color="$muted">
      {children}
    </Text>
  );
}
