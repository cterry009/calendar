import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { useEffect, useState } from 'react';
import { Input } from 'tamagui';
import { formatNightMinutes, isNightStartNoLater, nightStartForDay, validateNightStart, type NightWindowTimes } from '@calendar/shared';
import type { SyncBlockListRecord } from '../../lib/blocklist/types';

interface NightStartEditorProps {
  entry: SyncBlockListRecord;
  window: NightWindowTimes;
  /** A commitment is running: a start may only move earlier. */
  isLocked: boolean;
  isBusy: boolean;
  onSave: (nightStartMinutes: number | null, weekendNightStartMinutes: number | null) => Promise<void>;
}

function toInput(minutes: number | null | undefined): string {
  return minutes === null || minutes === undefined ? '' : formatNightMinutes(minutes);
}

/** "" = the general start. */
function parse(value: string): { ok: true; minutes: number | null } | { ok: false; error: string } {
  const text = value.trim();
  if (!text) return { ok: true, minutes: null };
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    return { ok: false, error: 'Escribe la hora en formato HH:MM, por ejemplo 20:00.' };
  }
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  const valid = validateNightStart(minutes);
  return valid.ok ? { ok: true, minutes } : valid;
}

// A NIGHT entry's own start, weeknights and Friday/Saturday (weekend-mode). Empty = the general one.
export function NightStartEditor({ entry, window, isLocked, isBusy, onSave }: NightStartEditorProps) {
  const [weekday, setWeekday] = useState(toInput(entry.nightStartMinutes));
  const [weekend, setWeekend] = useState(toInput(entry.weekendNightStartMinutes));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeekday(toInput(entry.nightStartMinutes));
    setWeekend(toInput(entry.weekendNightStartMinutes));
  }, [entry.nightStartMinutes, entry.weekendNightStartMinutes]);

  const changed = weekday !== toInput(entry.nightStartMinutes) || weekend !== toInput(entry.weekendNightStartMinutes);

  async function save() {
    const nextWeekday = parse(weekday);
    const nextWeekend = parse(weekend);
    if (!nextWeekday.ok || !nextWeekend.ok) {
      setError(!nextWeekday.ok ? nextWeekday.error : !nextWeekend.ok ? nextWeekend.error : null);
      return;
    }
    if (
      isLocked &&
      (!isNightStartNoLater(nextWeekday.minutes, entry.nightStartMinutes, nightStartForDay(1, window)) ||
        !isNightStartNoLater(nextWeekend.minutes, entry.weekendNightStartMinutes, nightStartForDay(5, window)))
    ) {
      setError('Con el compromiso activo, la hora solo se puede adelantar.');
      return;
    }
    setError(null);
    await onSave(nextWeekday.minutes, nextWeekend.minutes);
  }

  return (
    <YStack gap="$1">
      <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
        <YStack gap="$1">
          <Text color="$muted" fontSize="$2">
            Dom a jue
          </Text>
          <Input value={weekday} onChangeText={setWeekday} placeholder={formatNightMinutes(nightStartForDay(1, window))} width={84} />
        </YStack>
        <YStack gap="$1">
          <Text color="$muted" fontSize="$2">
            Vie y sáb
          </Text>
          <Input value={weekend} onChangeText={setWeekend} placeholder={formatNightMinutes(nightStartForDay(5, window))} width={84} />
        </YStack>
        {changed ? (
          <AppButton variant="ghost" disabled={isBusy} onPress={() => void save()}>
            Guardar
          </AppButton>
        ) : null}
      </XStack>
      {error ? (
        <Text color="$danger" fontSize="$2">
          {error}
        </Text>
      ) : null}
    </YStack>
  );
}
