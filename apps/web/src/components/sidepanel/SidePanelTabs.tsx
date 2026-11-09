import { useState } from 'react';
import { AppButton, XStack, YStack } from '@calendar/ui';
import { HoyTab } from './HoyTab';
import { InvestigacionTab } from './InvestigacionTab';
import { ProyectosTab } from './ProyectosTab';

// agenda-redesign (2026-11-09, the user's choice): the calendar stays the main view and this panel
// beside it switches between Hoy, Proyectos and Investigación without leaving it.

type TabId = 'hoy' | 'proyectos' | 'investigacion';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'investigacion', label: 'Investigación' },
];
const STORAGE_KEY = 'calendar.sidepanel.tab';

function storedTab(): TabId {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'proyectos' || v === 'investigacion' ? v : 'hoy';
  } catch {
    return 'hoy';
  }
}

export function SidePanelTabs({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (date: Date) => void }) {
  const [tab, setTab] = useState<TabId>(storedTab);
  const choose = (id: TabId) => {
    setTab(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* per-device convenience only */
    }
  };
  return (
    <YStack gap="$4">
      <XStack gap="$1" borderBottomWidth={1} borderBottomColor="$borderColor" role="tablist">
        {TABS.map((t) => (
          <AppButton
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            variant="ghost"
            borderWidth={0}
            borderRadius={0}
            borderBottomWidth={2}
            borderBottomColor={tab === t.id ? '$accent' : 'transparent'}
            color={tab === t.id ? '$color' : '$muted'}
            onPress={() => choose(t.id)}
          >
            {t.label}
          </AppButton>
        ))}
      </XStack>
      {tab === 'hoy' ? <HoyTab selectedDate={selectedDate} onSelectDate={onSelectDate} /> : null}
      {tab === 'proyectos' ? <ProyectosTab /> : null}
      {tab === 'investigacion' ? <InvestigacionTab /> : null}
    </YStack>
  );
}
