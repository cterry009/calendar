import { BAND_LABELS, SCALE_STEP, bandOf, clampScale } from '@calendar/shared';
import { Text, XStack, YStack } from '@calendar/ui';

// The 0-100 scales of dynamic-study-blocks revision 2 (D22): the diagnosis before every pomodoro
// (motivation and concentration) and the pomodoro's rating. A slider each, with the band beside it.

export function ScaleSlider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <YStack gap="$1">
      <XStack justifyContent="space-between" alignItems="baseline">
        <Text fontWeight="700">{label}</Text>
        <Text
          color={value === null ? '$muted' : '$accent'}
          fontWeight="800"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value === null ? '—' : `${value} · ${BAND_LABELS[bandOf(value)]}`}
        </Text>
      </XStack>
      <input
        type="range"
        min={0}
        max={100}
        step={SCALE_STEP}
        value={value ?? 50}
        aria-label={label}
        onChange={(e) => onChange(clampScale(Number(e.target.value)))}
        // A first click on the track sets it even when it lands on the default 50.
        onPointerUp={(e) => onChange(clampScale(Number((e.target as HTMLInputElement).value)))}
        style={{ width: '100%', accentColor: '#4ee0a0', opacity: value === null ? 0.5 : 1 }}
      />
      {hint ? (
        <Text fontSize="$1" color="$muted">
          {hint}
        </Text>
      ) : null}
    </YStack>
  );
}

export function DiagnosisSliders({
  motivation,
  concentration,
  onChange,
}: {
  motivation: number | null;
  concentration: number | null;
  onChange: (next: { motivation: number | null; concentration: number | null }) => void;
}) {
  return (
    <YStack gap="$3" width="100%">
      <ScaleSlider
        label="Motivación"
        value={motivation}
        onChange={(v) => onChange({ motivation: v, concentration })}
      />
      <ScaleSlider
        label="Concentración"
        value={concentration}
        onChange={(v) => onChange({ motivation, concentration: v })}
      />
      <Text fontSize="$1" color="$muted">
        0 a 100. Baja bajo 45, media de 45 a 69, alta desde 70.
      </Text>
    </YStack>
  );
}
