import type { Suggestion, SuggestionKind } from '@calendar/shared';

export const SUGGESTION_KIND_LABELS: Record<SuggestionKind, string> = {
  underestimation: 'Subestimacion',
  overestimation: 'Sobreestimacion',
  missing_break: 'Descansos',
  pomodoro_interruptions: 'Interrupciones',
  productivity_peak: 'Franja productiva',
  fitness_correlation: 'Fitness',
};

export const SUGGESTION_PRIORITY_LABELS: Record<Suggestion['priority'], string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const SUGGESTION_PRIORITY_BADGE_COLORS: Record<Suggestion['priority'], string> = {
  high: '$error',
  medium: '$accent',
  low: '$muted',
};

export type SuggestionPriorityFilter = 'ALL' | Suggestion['priority'];

export const SUGGESTION_PRIORITY_FILTER_LABELS: Record<SuggestionPriorityFilter, string> = {
  ALL: 'Todas',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
