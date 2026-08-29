import type { HabitType } from '@calendar/shared';

// Trimmed port of apps/web/src/lib/habits/labels.ts -- just the type labels/colors the mobile
// list and quick-add templates need. Web's habitCellColor (calendar-grid cell shading) isn't
// ported here for the same reason today.ts's streak sampling isn't: the mobile screen is a flat
// list, not a grid.
export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  NORMAL: 'Construir',
  NEGATIVE: 'Evitar',
};

export const HABIT_COLORS = [
  '#4ee0a0', // green (default accent)
  '#e0b64c', // amber
  '#e8654f', // coral
  '#8f7fe8', // indigo
  '#c65fe0', // magenta
  '#f0954a', // orange
  '#4ecde0', // teal
  '#9aa5a0', // gray
] as const;

export const DEFAULT_HABIT_COLOR: string = HABIT_COLORS[0];
