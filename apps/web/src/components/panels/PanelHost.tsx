import type { ComponentType } from 'react';
import { usePanel, type PanelId } from '../../context/PanelContext';
import { BlockListPage } from '../../pages/BlockListPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { DetoxPage } from '../../pages/DetoxPage';
import { FitnessPage } from '../../pages/FitnessPage';
import { HabitsPage } from '../../pages/HabitsPage';
import { HorarioPage } from '../../pages/HorarioPage';
import { PomodoroPage } from '../../pages/PomodoroPage';
import { RitualPage } from '../../pages/RitualPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { SuggestionsPage } from '../../pages/SuggestionsPage';
import { WeeklyReportsPage } from '../../pages/WeeklyReportsPage';
import { WellnessPage } from '../../pages/WellnessPage';
import { SlideOverPanel } from './SlideOverPanel';

const PANEL_PAGES: Record<PanelId, ComponentType> = {
  horario: HorarioPage,
  dashboard: DashboardPage,
  suggestions: SuggestionsPage,
  pomodoro: PomodoroPage,
  blocklist: BlockListPage,
  fitness: FitnessPage,
  detox: DetoxPage,
  ritual: RitualPage,
  habits: HabitsPage,
  settings: SettingsPage,
  wellness: WellnessPage,
  reports: WeeklyReportsPage,
};

export function PanelHost() {
  const { activePanel } = usePanel();

  if (!activePanel) {
    return null;
  }

  const PanelPage = PANEL_PAGES[activePanel];

  return (
    <SlideOverPanel>
      <PanelPage />
    </SlideOverPanel>
  );
}
