import { AppButton, AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { commitmentText } from '@calendar/shared';
import { useCommitment, type CommitmentExtension } from '../../hooks/useCommitment';
import { confirmDestructiveAction } from '../../lib/confirmAction';
import { isAccessibilityServiceEnabled, isDeviceAdminActive, requestDeviceAdmin } from '../../lib/focusBlock/api';

// "Que no se pueda cerrar la aplicación" (weekend-mode). Starting and extending ask first: it can't
// be undone from anywhere. What it needs from Android (the accessibility service and device admin)
// only the user can grant, so the card says what's missing.
export function CommitmentCard() {
  const { commitment, isLocked, extend } = useCommitment();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminActive, setAdminActive] = useState(false);
  const [accessibility, setAccessibility] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setAdminActive(isDeviceAdminActive());
      setAccessibility(isAccessibilityServiceEnabled());
    }, []),
  );

  function confirmExtend(input: CommitmentExtension, message: string) {
    confirmDestructiveAction('Compromiso de bloqueo', message, 'Sí, comprometerme', () => {
      setBusy(true);
      setError(null);
      extend(input)
        .catch(() => setError('No se pudo guardar: hace falta conexión con el servidor.'))
        .finally(() => setBusy(false));
    });
  }

  return (
    <AppCard>
      <YStack gap="$2">
        <H2 margin={0} fontSize="$5">
          Compromiso de bloqueo
        </H2>
        {isLocked && commitment ? (
          <YStack gap="$2">
            <Text color="$accent" fontWeight="700">
              Activo. {commitmentText(commitment)}.
            </Text>
            <Paragraph margin={0} color="$muted">
              Mientras dure, el bloqueo nocturno no se puede apagar ni debilitar, y la app no se puede forzar a
              cerrar ni desinstalar. Solo se puede alargar.
            </Paragraph>
            {commitment.endsAt !== null ? (
              <XStack gap="$2" flexWrap="wrap">
                <AppButton variant="ghost" disabled={busy} onPress={() => confirmExtend({ days: 7 }, 'Agregar 7 días más al compromiso. No se puede acortar.')}>
                  +7 días
                </AppButton>
                <AppButton variant="ghost" disabled={busy} onPress={() => confirmExtend({ days: 30 }, 'Agregar 30 días más al compromiso. No se puede acortar.')}>
                  +30 días
                </AppButton>
                <AppButton variant="ghost" disabled={busy} onPress={() => confirmExtend({ indefinite: true }, 'Hacerlo indefinido: no tendrá fecha de fin y no se podrá deshacer desde la app.')}>
                  Indefinido
                </AppButton>
              </XStack>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$2">
            <Paragraph margin={0} color="$muted">
              Durante 7 días el bloqueo nocturno no se podrá apagar ni debilitar desde ningún dispositivo, y la
              app no se podrá cerrar ni desinstalar. No se puede cancelar antes, solo alargar. El resto de
              Ajustes y las llamadas siguen funcionando.
            </Paragraph>
            <AppButton
              variant="primary"
              disabled={busy}
              onPress={() => confirmExtend({ days: 7 }, 'Empezar el compromiso por 7 días. No se podrá cancelar antes de que termine.')}
            >
              Empezar 7 días
            </AppButton>
          </YStack>
        )}
        {!accessibility ? (
          <Text color="$danger" fontSize="$2">
            Falta activar el servicio de accesibilidad: sin él, el teléfono no aplica el compromiso.
          </Text>
        ) : null}
        {adminActive ? (
          <Text color="$muted" fontSize="$2">
            Protección contra desinstalar: activa.
          </Text>
        ) : (
          <YStack gap="$1">
            <Text color="$muted" fontSize="$2">
              Protección contra desinstalar: falta activarla. Android lo pide en una pantalla suya.
            </Text>
            <AppButton variant="ghost" onPress={() => requestDeviceAdmin()}>
              Activar protección
            </AppButton>
          </YStack>
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
