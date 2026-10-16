import { fitSequence, sequenceMinutes, type SequenceSegment } from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';

// Horario 2026-10-19: the block's pomodoro sequence, editable segment by segment. The block keeps
// its fixed end; a sequence that doesn't add up to it is trimmed at the end, and this says so.

const TYPE_LABELS: Record<SequenceSegment['tipo'], string> = { foco: 'Foco', pausa: 'Pausa', cierre: 'Cierre' };

const fieldStyle = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.04)',
  color: 'inherit',
} as const;

export function SequenceEditor({
  sequence,
  blockMinutes,
  onChange,
}: {
  sequence: SequenceSegment[];
  /** null while the start/end times aren't valid. */
  blockMinutes: number | null;
  onChange: (next: SequenceSegment[]) => void;
}) {
  const update = (index: number, patch: Partial<SequenceSegment>) =>
    onChange(sequence.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sequence.length) return;
    const next = [...sequence];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const warning = blockMinutes ? fitSequence(sequence, blockMinutes).warning : null;

  return (
    <YStack gap="$2">
      <Text fontWeight="700">Secuencia de pomodoros</Text>
      <Paragraph margin={0} size="$2" color="$muted">
        Cada tramo corre a su hora desde el inicio del bloque. Suma {sequenceMinutes(sequence)} min
        {blockMinutes ? ` de ${blockMinutes}` : ''}.
      </Paragraph>
      {sequence.map((segment, index) => (
        <XStack key={index} gap="$2" alignItems="center" flexWrap="wrap">
          <select
            value={segment.tipo}
            onChange={(e) => update(index, { tipo: e.target.value as SequenceSegment['tipo'] })}
            style={fieldStyle}
          >
            {(Object.keys(TYPE_LABELS) as SequenceSegment['tipo'][]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {TYPE_LABELS[tipo]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={segment.minutos}
            onChange={(e) => update(index, { minutos: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
            style={{ ...fieldStyle, width: 64 }}
          />
          <input
            value={segment.etiqueta}
            onChange={(e) => update(index, { etiqueta: e.target.value })}
            style={{ ...fieldStyle, flex: 1, minWidth: 200 }}
          />
          <AppButton type="button" variant="small" onPress={() => move(index, -1)}>
            ↑
          </AppButton>
          <AppButton type="button" variant="small" onPress={() => move(index, 1)}>
            ↓
          </AppButton>
          <AppButton type="button" variant="small" onPress={() => onChange(sequence.filter((_, i) => i !== index))}>
            Quitar
          </AppButton>
        </XStack>
      ))}
      <XStack gap="$2">
        <AppButton
          type="button"
          variant="small"
          onPress={() => onChange([...sequence, { tipo: 'foco', minutos: 25, etiqueta: `Pomodoro ${sequence.filter((s) => s.tipo === 'foco').length + 1}` }])}
        >
          + Foco
        </AppButton>
        <AppButton type="button" variant="small" onPress={() => onChange([...sequence, { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' }])}>
          + Pausa
        </AppButton>
      </XStack>
      {warning ? (
        <Text fontSize="$2" color="$warning">
          {warning}
        </Text>
      ) : null}
    </YStack>
  );
}
