import { AppButton, XStack } from '@calendar/ui';

/** Underlined tabs inside a page (Agenda look); the choice is remembered per device. */
export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
  small,
}: {
  tabs: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  small?: boolean;
}) {
  return (
    <XStack gap="$1" flexWrap="wrap" borderBottomWidth={1} borderBottomColor="$borderColor" role="tablist">
      {tabs.map((t) => (
        <AppButton
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          variant="ghost"
          size={small ? '$3' : '$4'}
          borderWidth={0}
          borderRadius={0}
          borderBottomWidth={2}
          borderBottomColor={value === t.id ? '$accent' : 'transparent'}
          color={value === t.id ? '$color' : '$muted'}
          onPress={() => onChange(t.id)}
        >
          {t.label}
        </AppButton>
      ))}
    </XStack>
  );
}

export function rememberedTab<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = window.localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function rememberTab(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* per-device convenience only */
  }
}
