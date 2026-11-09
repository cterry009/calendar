import { Text, XStack, YStack } from '@calendar/ui';

/** The "ya" of the calendar (2026-11-09): a line across the grid at the current minute, with a dot
 * and, where there is room, the time. Positioned by the parent's row height. */
export function NowLine({ topPx, label }: { topPx: number; label?: string }) {
  return (
    <XStack
      position="absolute"
      top={topPx - 1}
      left={0}
      right={0}
      height={2}
      alignItems="center"
      zIndex={4}
      pointerEvents="none"
      aria-label={label ? `Ahora, ${label}` : 'Ahora'}
    >
      <YStack width={10} height={10} borderRadius={5} backgroundColor="$error" marginLeft={-5} />
      <YStack flex={1} height={2} backgroundColor="$error" />
      {label ? (
        <Text
          position="absolute"
          right={4}
          top={-18}
          fontSize={11}
          fontWeight="700"
          color="$error"
          backgroundColor="$background"
          paddingHorizontal={4}
          borderRadius={4}
        >
          {label}
        </Text>
      ) : null}
    </XStack>
  );
}

export function clockLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
