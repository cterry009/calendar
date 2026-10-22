import { BAND_LABELS, SCALE_STEP, bandOf, clampScale } from '@calendar/shared';
import { Text, XStack, YStack } from '@calendar/ui';
import { Pressable } from 'react-native';

// A 0-100 value in one or two taps (dynamic-study-blocks revision 2): a bar of tens to tap, and −5 / +5
// to fine-tune. Used for the diagnosis (motivation, concentration) and the pomodoro's rating. No
// native slider: one more native module would need a prebuild for little gain.

const TENS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function ScaleInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between" alignItems="baseline">
        <Text fontWeight="700">{label}</Text>
        <Text color={value === null ? '$muted' : '$accent'} fontWeight="800">
          {value === null ? 'toca la barra' : `${value} · ${BAND_LABELS[bandOf(value)]}`}
        </Text>
      </XStack>
      <XStack gap={3}>
        {TENS.map((n) => (
          <Pressable key={n} style={{ flex: 1 }} onPress={() => onChange(n)} accessibilityLabel={`${label} ${n}`}>
            <YStack
              height={30}
              borderRadius={4}
              backgroundColor={value !== null && n <= value ? (n >= 70 ? '#4ee0a0' : n >= 45 ? '#e0b84a' : '#e07a5f') : 'rgba(255,255,255,0.12)'}
            />
          </Pressable>
        ))}
      </XStack>
      <XStack justifyContent="space-between">
        <Pressable onPress={() => onChange(clampScale((value ?? 50) - SCALE_STEP))}>
          <Text color="$muted" paddingHorizontal="$3" paddingVertical="$1">
            −5
          </Text>
        </Pressable>
        <Text fontSize="$1" color="$muted">
          baja &lt; 45 · media 45-69 · alta ≥ 70
        </Text>
        <Pressable onPress={() => onChange(clampScale((value ?? 50) + SCALE_STEP))}>
          <Text color="$muted" paddingHorizontal="$3" paddingVertical="$1">
            +5
          </Text>
        </Pressable>
      </XStack>
    </YStack>
  );
}

export function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between">
      <Text>{label}</Text>
      <XStack alignItems="center" gap="$3">
        <Pressable disabled={value <= min} onPress={() => onChange(value - step)}>
          <Text fontSize="$6" color={value <= min ? '$muted' : '$color'} paddingHorizontal="$3">
            −
          </Text>
        </Pressable>
        <Text fontWeight="800" width={64} textAlign="center">
          {value} min
        </Text>
        <Pressable disabled={value >= max} onPress={() => onChange(value + step)}>
          <Text fontSize="$6" color={value >= max ? '$muted' : '$color'} paddingHorizontal="$3">
            +
          </Text>
        </Pressable>
      </XStack>
    </XStack>
  );
}
