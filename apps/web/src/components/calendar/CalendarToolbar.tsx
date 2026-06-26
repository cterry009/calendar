import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import type { CalendarViewMode } from '../../lib/calendar/types';
import {
  addDays,
  addMonths,
  getEndOfWeek,
  getStartOfWeek,
  startOfDay,
} from '../../lib/calendar/utils';

interface CalendarToolbarProps {
  mode: CalendarViewMode;
  selectedDate: Date;
  onModeChange: (mode: CalendarViewMode) => void;
  onChangeDate: (nextDate: Date) => void;
}

const VIEW_LABELS: Record<CalendarViewMode, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

function formatDateLabel(mode: CalendarViewMode, selectedDate: Date): string {
  if (mode === 'day') {
    return selectedDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (mode === 'week') {
    const weekStart = getStartOfWeek(selectedDate);
    const weekEnd = getEndOfWeek(selectedDate);
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();

    if (sameMonth) {
      return `${weekStart.getDate()} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('es-ES', {
        month: 'long',
      })} ${weekEnd.getFullYear()}`;
    }

    return `${weekStart.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    })} - ${weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  return selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function moveDate(mode: CalendarViewMode, selectedDate: Date, step: -1 | 1): Date {
  if (mode === 'day') return addDays(selectedDate, step);
  if (mode === 'week') return addDays(selectedDate, 7 * step);
  return addMonths(selectedDate, step);
}

export function CalendarToolbar({ mode, selectedDate, onModeChange, onChangeDate }: CalendarToolbarProps) {
  return (
    <AppCard padding="$4">
      <YStack gap="$4">
        <XStack gap="$2" flexWrap="wrap">
          {(Object.keys(VIEW_LABELS) as CalendarViewMode[]).map((viewMode) => (
            <AppButton
              key={viewMode}
              variant={mode === viewMode ? 'primary' : 'ghost'}
              onPress={() => onModeChange(viewMode)}
            >
              {VIEW_LABELS[viewMode]}
            </AppButton>
          ))}
        </XStack>

        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <XStack gap="$2">
            <AppButton variant="ghost" onPress={() => onChangeDate(moveDate(mode, selectedDate, -1))}>
              Anterior
            </AppButton>
            <AppButton variant="ghost" onPress={() => onChangeDate(moveDate(mode, selectedDate, 1))}>
              Siguiente
            </AppButton>
            <AppButton variant="small" onPress={() => onChangeDate(startOfDay(new Date()))}>
              Hoy
            </AppButton>
          </XStack>

          <YStack alignItems="flex-end">
            <H2 fontSize="$6" margin={0} textTransform="capitalize">
              {formatDateLabel(mode, selectedDate)}
            </H2>
            <Paragraph size="$2" color="$muted" margin={0}>
              Semana inicia en lunes
            </Paragraph>
          </YStack>
        </XStack>
      </YStack>
    </AppCard>
  );
}
