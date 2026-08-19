import { useEffect, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Label, Paragraph, XStack, YStack } from '@calendar/ui';
import { Checkbox, Input } from 'tamagui';
import { useNativeFieldStyle } from '../../hooks/useNativeFieldStyle';
import {
  DEFAULT_RADIUS_METERS,
  FOCUS_TRIGGER_KINDS,
  type FocusTriggerFormValues,
  type SyncFocusTriggerRecord,
} from '../../lib/focusTriggers/types';

const KIND_LABELS: Record<FocusTriggerFormValues['kind'], string> = {
  LOCATION: 'Ubicacion',
  WIFI: 'Red Wi-Fi',
};

interface FocusTriggerFormProps {
  mode: 'create' | 'edit';
  initialTrigger?: SyncFocusTriggerRecord;
  isSubmitting: boolean;
  onSubmit: (values: FocusTriggerFormValues) => Promise<void>;
  onCancel: () => void;
}

function defaultDraft(trigger?: SyncFocusTriggerRecord): FocusTriggerFormValues {
  return {
    kind: trigger?.kind ?? 'LOCATION',
    label: trigger?.label ?? '',
    enabled: trigger?.enabled ?? true,
    latitude: trigger?.latitude ?? null,
    longitude: trigger?.longitude ?? null,
    radiusMeters: trigger?.radiusMeters ?? DEFAULT_RADIUS_METERS,
    wifiSsid: trigger?.wifiSsid ?? '',
  };
}

export function FocusTriggerForm({ mode, initialTrigger, isSubmitting, onSubmit, onCancel }: FocusTriggerFormProps) {
  const [draft, setDraft] = useState<FocusTriggerFormValues>(() => defaultDraft(initialTrigger));
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const fieldStyle = useNativeFieldStyle();

  useEffect(() => {
    setDraft(defaultDraft(initialTrigger));
    setError(null);
  }, [initialTrigger, mode]);

  function setField<Key extends keyof FocusTriggerFormValues>(field: Key, value: FocusTriggerFormValues[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Este navegador no soporta geolocalizacion.');
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField('latitude', position.coords.latitude);
        setField('longitude', position.coords.longitude);
        setIsLocating(false);
      },
      () => {
        setError('No se pudo obtener tu ubicacion actual. Revisa el permiso de ubicacion del navegador.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!draft.label.trim()) {
      setError('La etiqueta es obligatoria.');
      return;
    }

    if (draft.kind === 'LOCATION' && (draft.latitude == null || draft.longitude == null || !draft.radiusMeters)) {
      setError('Define una ubicacion (usa "Usar mi ubicacion actual") y un radio en metros.');
      return;
    }

    if (draft.kind === 'WIFI' && !draft.wifiSsid?.trim()) {
      setError('El nombre de red (SSID) es obligatorio.');
      return;
    }

    await onSubmit(draft);
  }

  return (
    <AppCard>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <YStack gap="$4">
          <H2 margin={0}>{mode === 'create' ? 'Nueva condicion de activacion' : 'Editar condicion'}</H2>

          <YStack gap="$2">
            <Label>Tipo</Label>
            <select
              value={draft.kind}
              onChange={(event) => setField('kind', event.target.value as FocusTriggerFormValues['kind'])}
              style={{ padding: 10, borderRadius: 14, ...fieldStyle }}
            >
              {FOCUS_TRIGGER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </YStack>

          <YStack gap="$2">
            <Label>Etiqueta</Label>
            <Input value={draft.label} onChangeText={(value: string) => setField('label', value)} />
          </YStack>

          {draft.kind === 'LOCATION' ? (
            <YStack gap="$2">
              <Label>Ubicacion</Label>
              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <AppButton type="button" variant="ghost" onPress={useCurrentLocation} disabled={isLocating}>
                  {isLocating ? 'Obteniendo ubicacion...' : 'Usar mi ubicacion actual'}
                </AppButton>
                {draft.latitude != null && draft.longitude != null ? (
                  <Paragraph margin={0} color="$muted" size="$2">
                    {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}
                  </Paragraph>
                ) : (
                  <Paragraph margin={0} color="$muted" size="$2">
                    Sin ubicacion definida
                  </Paragraph>
                )}
              </XStack>
              <Label>Radio (metros)</Label>
              <Input
                keyboardType="numeric"
                value={String(draft.radiusMeters ?? '')}
                onChangeText={(value: string) => setField('radiusMeters', value ? Number(value) : null)}
              />
              <Paragraph margin={0} size="$2" color="$muted">
                El bloqueo se activa cuando el navegador reporta que estas dentro de este radio. Requiere permiso de
                ubicacion y la pestana abierta; es un chequeo real, no solo una etiqueta.
              </Paragraph>
            </YStack>
          ) : (
            <YStack gap="$2">
              <Label>Nombre de red (SSID)</Label>
              <Input
                value={draft.wifiSsid ?? ''}
                onChangeText={(value: string) => setField('wifiSsid', value)}
                placeholder="Ej: Oficina-5G"
              />
              <Paragraph margin={0} size="$2" color="$warning">
                Los navegadores no permiten leer la red Wi-Fi conectada por seguridad. Esta condicion queda guardada
                pero solo se activara cuando existan las apps nativas de Android/Windows.
              </Paragraph>
            </YStack>
          )}

          <XStack gap="$2" alignItems="center">
            <Checkbox checked={draft.enabled} onCheckedChange={(value) => setField('enabled', value === true)} />
            <Label>Activa</Label>
          </XStack>

          {error ? (
            <Paragraph margin={0} color="$error">
              {error}
            </Paragraph>
          ) : null}

          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <AppButton type="button" variant="ghost" onPress={onCancel}>
              Cancelar
            </AppButton>
            <AppButton type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear condicion' : 'Guardar cambios'}
            </AppButton>
          </XStack>
        </YStack>
      </form>
    </AppCard>
  );
}
