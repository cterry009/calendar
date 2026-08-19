import { AppButton, AppCard, H2, Paragraph, XStack, YStack } from '@calendar/ui';
import { useLanguage } from '../../context/LanguageContext';
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

const VIEW_LABEL_KEYS: Record<CalendarViewMode, string> = {
  day: 'calendarToolbar.view.day',
  week: 'calendarToolbar.view.week',
  month: 'calendarToolbar.view.month',
};

function formatDateLabel(mode: CalendarViewMode, selectedDate: Date, locale: string): string {
  if (mode === 'day') {
    return selectedDate.toLocaleDateString(locale, {
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
      return `${weekStart.getDate()} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString(locale, {
        month: 'long',
      })} ${weekEnd.getFullYear()}`;
    }

    return `${weekStart.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    })} - ${weekEnd.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  return selectedDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function moveDate(mode: CalendarViewMode, selectedDate: Date, step: -1 | 1): Date {
  if (mode === 'day') return addDays(selectedDate, step);
  if (mode === 'week') return addDays(selectedDate, 7 * step);
  return addMonths(selectedDate, step);
}

export function CalendarToolbar({ mode, selectedDate, onModeChange, onChangeDate }: CalendarToolbarProps) {
  const { t, locale } = useLanguage();

  return (
    <AppCard padding="$4">
      <YStack gap="$4">
        <XStack gap="$2" flexWrap="wrap">
          {(Object.keys(VIEW_LABEL_KEYS) as CalendarViewMode[]).map((viewMode) => (
            <AppButton
              key={viewMode}
              variant={mode === viewMode ? 'primary' : 'ghost'}
              onPress={() => onModeChange(viewMode)}
            >
              {t(VIEW_LABEL_KEYS[viewMode])}
            </AppButton>
          ))}
        </XStack>

        <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
          <XStack gap="$2">
            <AppButton variant="ghost" onPress={() => onChangeDate(moveDate(mode, selectedDate, -1))}>
              {t('calendarToolbar.previous')}
            </AppButton>
            <AppButton variant="ghost" onPress={() => onChangeDate(moveDate(mode, selectedDate, 1))}>
              {t('calendarToolbar.next')}
            </AppButton>
            <AppButton variant="small" onPress={() => onChangeDate(startOfDay(new Date()))}>
              {t('calendarToolbar.today')}
            </AppButton>
          </XStack>

          <YStack alignItems="flex-end">
            <H2 fontSize="$6" margin={0} textTransform="capitalize">
              {formatDateLabel(mode, selectedDate, locale)}
            </H2>
            <Paragraph size="$2" color="$muted" margin={0}>
              {t('calendarToolbar.weekStartsMonday')}
            </Paragraph>
          </YStack>
        </XStack>
      </YStack>
    </AppCard>
  );
}
