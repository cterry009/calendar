import { useState } from 'react';
import { H1, YStack } from '@calendar/ui';
import { rememberedTab, rememberTab, SubTabs } from '../components/agenda/SubTabs';
import { DashboardPage } from './DashboardPage';
import { WeeklyReportsPage } from './WeeklyReportsPage';

// agenda-redesign (2026-11-09): Dashboard and the weekly reports, one place for the numbers.
const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'semanal', label: 'Reportes semanales' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function EstadisticasPage() {
  const [tab, setTab] = useState<TabId>(() => rememberedTab('calendar.estadisticas.tab', TABS.map((t) => t.id), 'resumen'));
  return (
    <YStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$6" gap="$4" maxWidth={1240} width="100%" alignSelf="center">
      <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
        Estadísticas
      </H1>
      <SubTabs
        tabs={TABS}
        value={tab}
        onChange={(id) => {
          setTab(id);
          rememberTab('calendar.estadisticas.tab', id);
        }}
      />
      {tab === 'resumen' ? <DashboardPage /> : <WeeklyReportsPage />}
    </YStack>
  );
}
