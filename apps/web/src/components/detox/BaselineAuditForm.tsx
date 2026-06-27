import { useState } from 'react';
import { AppButton, AppCard, H3, Paragraph, Text, XStack, YStack } from '@calendar/ui';

interface BaselineAuditFormProps {
  isSubmitting: boolean;
  onSubmit: (screenTimeHoursEstimate: number, topDistractions: string[]) => Promise<void>;
}

export function BaselineAuditForm({ isSubmitting, onSubmit }: BaselineAuditFormProps) {
  const [screenTime, setScreenTime] = useState('6');
  const [distractions, setDistractions] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const hours = Number(screenTime);
    const items = distractions
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      setError('Indica un estimado de horas de pantalla entre 0 y 24.');
      return;
    }

    if (items.length < 2) {
      setError('Lista al menos 2 apps o sitios distractivos (uno por linea).');
      return;
    }

    setError(null);
    await onSubmit(hours, items.slice(0, 3));
  }

  return (
    <AppCard>
      <YStack gap="$3">
        <H3 margin={0}>Auditoria base</H3>
        <Paragraph margin={0} color="$muted">
          Antes de reducir estimulos, registra tu punto de partida para medir el progreso.
        </Paragraph>

        <YStack gap="$2">
          <Text>Horas diarias estimadas de pantalla</Text>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={screenTime}
            onChange={(event) => setScreenTime(event.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' }}
          />
        </YStack>

        <YStack gap="$2">
          <Text>Apps o sitios mas distractivos (uno por linea)</Text>
          <textarea
            rows={4}
            value={distractions}
            onChange={(event) => setDistractions(event.target.value)}
            placeholder={'Instagram\nYouTube\nTikTok'}
            style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' }}
          />
        </YStack>

        {error ? (
          <Paragraph margin={0} color="$error">
            {error}
          </Paragraph>
        ) : null}

        <AppButton type="button" variant="primary" onPress={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Completar auditoria'}
        </AppButton>
      </YStack>
    </AppCard>
  );
}
