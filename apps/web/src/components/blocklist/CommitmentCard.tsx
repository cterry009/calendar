import { useState } from 'react';
import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { commitmentText } from '@calendar/shared';
import { useCommitment, type CommitmentExtension } from '../../hooks/useCommitment';

// "Que no se pueda cerrar la aplicación" (weekend-mode), the same card as the phone's. Asks before
// starting or extending: it can't be undone from anywhere.
export function CommitmentCard() {
  const { commitment, isLocked, extend } = useCommitment();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmExtend(input: CommitmentExtension, message: string) {
    if (!window.confirm(message)) return;
    setBusy(true);
    setError(null);
    try {
      await extend(input);
    } catch {
      setError('No se pudo guardar: hace falta conexión con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppCard>
      <YStack gap="$2">
        <H2 margin={0} fontSize="$5">
          Compromiso de bloqueo
        </H2>
        {isLocked && commitment ? (
          <>
            <Text color="$accent" fontWeight="700">
              Activo. {commitmentText(commitment)}.
            </Text>
            <Paragraph margin={0} color="$muted">
              Mientras dure, el bloqueo nocturno no se puede apagar ni debilitar, y la app de escritorio y la del
              teléfono no se pueden cerrar. Solo se puede alargar.
            </Paragraph>
            {commitment.endsAt !== null ? (
              <XStack gap="$2" flexWrap="wrap">
                <AppButton type="button" variant="ghost" disabled={busy} onPress={() => void confirmExtend({ days: 7 }, 'Agregar 7 días más al compromiso. No se puede acortar.')}>
                  +7 días
                </AppButton>
                <AppButton type="button" variant="ghost" disabled={busy} onPress={() => void confirmExtend({ days: 30 }, 'Agregar 30 días más al compromiso. No se puede acortar.')}>
                  +30 días
                </AppButton>
                <AppButton type="button" variant="ghost" disabled={busy} onPress={() => void confirmExtend({ indefinite: true }, 'Hacerlo indefinido: no tendrá fecha de fin y no se podrá deshacer desde la app.')}>
                  Indefinido
                </AppButton>
              </XStack>
            ) : null}
          </>
        ) : (
          <>
            <Paragraph margin={0} color="$muted">
              Durante 7 días el bloqueo nocturno no se podrá apagar ni debilitar desde ningún dispositivo, y las
              apps no se podrán cerrar. No se puede cancelar antes, solo alargar.
            </Paragraph>
            <XStack>
              <AppButton
                type="button"
                variant="primary"
                disabled={busy}
                onPress={() => void confirmExtend({ days: 7 }, 'Empezar el compromiso por 7 días. No se podrá cancelar antes de que termine.')}
              >
                Empezar 7 días
              </AppButton>
            </XStack>
          </>
        )}
        {error ? (
          <Text color="$danger" fontSize="$2">
            {error}
          </Text>
        ) : null}
      </YStack>
    </AppCard>
  );
}
