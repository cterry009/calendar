import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { Checkbox, Input, Label } from 'tamagui';
import { BLOCK_LIST_KIND_LABELS, BLOCK_LIST_PLATFORM_LABELS } from '../../lib/blocklist/labels';
import {
  BLOCK_LIST_KINDS,
  BLOCK_LIST_PLATFORMS,
  type BlockListFormValues,
  type SyncBlockListRecord,
} from '../../lib/blocklist/types';

interface BlockListFormProps {
  mode: 'create' | 'edit';
  initialEntry?: SyncBlockListRecord;
  isSubmitting: boolean;
  onSubmit: (values: BlockListFormValues) => Promise<void>;
  onCancel: () => void;
}

function defaultDraft(entry?: SyncBlockListRecord): BlockListFormValues {
  return {
    kind: entry?.kind ?? 'WEBSITE',
    identifier: entry?.identifier ?? '',
    label: entry?.label ?? '',
    platform: entry?.platform ?? 'WEB',
    highDopamine: entry?.highDopamine ?? false,
    enabled: entry?.enabled ?? true,
  };
}

export function BlockListForm({ mode, initialEntry, isSubmitting, onSubmit, onCancel }: BlockListFormProps) {
  const [draft, setDraft] = useState<BlockListFormValues>(() => defaultDraft(initialEntry));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(defaultDraft(initialEntry));
    setError(null);
  }, [initialEntry, mode]);

  function setField<Key extends keyof BlockListFormValues>(field: Key, value: BlockListFormValues[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!draft.identifier.trim() || !draft.label.trim()) {
      setError('Identificador y etiqueta son obligatorios.');
      return;
    }

    await onSubmit(draft);
  }

  return (
    <AppCard>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <YStack gap="$4">
          <H2 margin={0}>{mode === 'create' ? 'Nueva entrada de bloqueo' : 'Editar entrada'}</H2>

          <YStack gap="$2">
            <Label>Tipo</Label>
            <select
              value={draft.kind}
              onChange={(event) => setField('kind', event.target.value as BlockListFormValues['kind'])}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' }}
            >
              {BLOCK_LIST_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {BLOCK_LIST_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </YStack>

          <YStack gap="$2">
            <Label>Identificador (dominio, package o ejecutable)</Label>
            <Input
              value={draft.identifier}
              onChangeText={(value: string) => setField('identifier', value)}
            />
          </YStack>

          <YStack gap="$2">
            <Label>Etiqueta visible</Label>
            <Input value={draft.label} onChangeText={(value: string) => setField('label', value)} />
          </YStack>

          <YStack gap="$2">
            <Label>Plataforma</Label>
            <select
              value={draft.platform ?? ''}
              onChange={(event) =>
                setField('platform', (event.target.value || null) as BlockListFormValues['platform'])
              }
              style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' }}
            >
              <option value="">Todas</option>
              {BLOCK_LIST_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {BLOCK_LIST_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </select>
          </YStack>

          <XStack gap="$4" alignItems="center" flexWrap="wrap">
            <XStack gap="$2" alignItems="center">
              <Checkbox
                checked={draft.highDopamine}
                onCheckedChange={(value) => setField('highDopamine', value === true)}
              />
              <Label>Alta dopamina (modo serotonina)</Label>
            </XStack>

            <XStack gap="$2" alignItems="center">
              <Checkbox checked={draft.enabled} onCheckedChange={(value) => setField('enabled', value === true)} />
              <Label>Activo</Label>
            </XStack>
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
              {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear entrada' : 'Guardar cambios'}
            </AppButton>
          </XStack>
        </YStack>
      </form>
    </AppCard>
  );
}
