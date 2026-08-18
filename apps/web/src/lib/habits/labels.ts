import type { HabitType } from '@calendar/shared';

export const HABIT_TYPE_LABELS: Record<HabitType, string> = {
  NORMAL: 'Construir',
  NEGATIVE: 'Evitar',
};

export const HABIT_TYPE_DESCRIPTIONS: Record<HabitType, string> = {
  NORMAL: 'Un habito que queres empezar a hacer, como leer, meditar o caminar.',
  NEGATIVE: 'Un habito que queres evitar o reducir, como redes sociales o azucar.',
};

// mhabit gives every habit a vivid, distinct color (its list is a color-coded table, not a
// monochrome one) -- a single muted accent reads as "everything looks the same" at a glance.
// Saturation/lightness tuned to stay legible on the dark Emerald Focus background instead of
// copying mhabit's literal (light-background) hex values.
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = Number.parseInt(value, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = 1 - amount;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * factor)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

/** What a single day cell should look like, folding record presence into the completion tier. */
export type HabitCellVisualState = 'future' | 'empty' | 'skipped' | 'partial' | 'auto' | 'done' | 'exceeded';

export function habitCellColor(state: HabitCellVisualState, baseColor: string): string {
  switch (state) {
    case 'future':
      return 'transparent';
    case 'empty':
      return 'rgba(255,255,255,0.06)';
    case 'skipped':
      return 'rgba(255,255,255,0.12)';
    case 'partial':
      return withAlpha(baseColor, 0.35);
    case 'auto':
      return withAlpha(baseColor, 0.55);
    case 'done':
      return baseColor;
    case 'exceeded':
      return darken(baseColor, 0.2);
  }
}
