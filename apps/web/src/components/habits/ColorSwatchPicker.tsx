import { YStack } from '@calendar/ui';
import { HABIT_COLORS } from '../../lib/habits/labels';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  return (
    <YStack flexDirection="row" gap="$2" flexWrap="wrap">
      {HABIT_COLORS.map((color) => (
        <YStack
          key={color}
          width={28}
          height={28}
          borderRadius={999}
          backgroundColor={color}
          cursor="pointer"
          borderWidth={value === color ? 3 : 1}
          borderColor={value === color ? '$color' : 'rgba(255,255,255,0.2)'}
          onPress={() => onChange(color)}
          aria-label={`Color ${color}`}
        />
      ))}
    </YStack>
  );
}
