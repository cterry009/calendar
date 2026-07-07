import { YStack } from '@calendar/ui';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  lines?: number;
  lineHeight?: number;
}

export function Skeleton({ width, height, borderRadius = 8, lines, lineHeight = 16 }: SkeletonProps) {
  if (lines) {
    return (
      <YStack gap="$2" padding="$2">
        {Array.from({ length: lines }).map((_, index) => (
          <YStack
            key={index}
            width={index === lines - 1 ? '60%' : '100%'}
            height={lineHeight}
            borderRadius={borderRadius}
            backgroundColor="rgba(255,255,255,0.06)"
            animation="quick"
            opacity={0.6}
          />
        ))}
      </YStack>
    );
  }

  return (
    <YStack
      width={width ?? '100%'}
      height={height ?? 24}
      borderRadius={borderRadius}
      backgroundColor="rgba(255,255,255,0.06)"
      animation="quick"
      opacity={0.6}
    />
  );
}
