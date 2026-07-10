import { useEffect, useState } from 'react';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import {
  addDays,
  addMonths,
  getEndOfMonth,
  getEndOfWeek,
  getStartOfMonth,
  getStartOfWeek,
  isSameDay,
  startOfDay,
} from '../../lib/calendar/utils';

interface MiniMonthCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** Compact month picker for the sidebar, Google Calendar-style: click a day to jump to it. */
export function MiniMonthCalendar({ selectedDate, onSelectDate }: MiniMonthCalendarProps) {
  const [cursorMonth, setCursorMonth] = useState(() => startOfDay(selectedDate));

  useEffect(() => {
    setCursorMonth(startOfDay(selectedDate));
    // Re-center the visible month only when the selected month/year actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  const today = startOfDay(new Date());
  const monthStart = getStartOfMonth(cursorMonth);
  const monthEnd = getEndOfMonth(cursorMonth);
  const gridStart = getStartOfWeek(monthStart);
  const gridEnd = getEndOfWeek(monthEnd);

  const days: Date[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  const weeks = Array.from({ length: days.length / 7 }, (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7));

  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="700" textTransform="capitalize" fontSize="$3">
          {cursorMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
        </Text>
        <XStack gap="$1">
          <AppButton variant="ghost" size="$2" onPress={() => setCursorMonth((current) => addMonths(current, -1))}>
            ‹
          </AppButton>
          <AppButton variant="ghost" size="$2" onPress={() => setCursorMonth((current) => addMonths(current, 1))}>
            ›
          </AppButton>
        </XStack>
      </XStack>

      <XStack>
        {WEEKDAY_LETTERS.map((letter, index) => (
          <YStack key={`${letter}-${index}`} flex={1} alignItems="center">
            <Text fontSize="$1" color="$muted">
              {letter}
            </Text>
          </YStack>
        ))}
      </XStack>

      <YStack gap="$1">
        {weeks.map((week) => (
          <XStack key={week[0]!.toISOString()}>
            {week.map((day) => {
              const inMonth = day.getMonth() === cursorMonth.getMonth();
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <YStack key={day.toISOString()} flex={1} alignItems="center" paddingVertical={2}>
                  <YStack
                    width={26}
                    height={26}
                    borderRadius={13}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={isSelected ? '$primary' : isToday ? 'rgba(255,255,255,0.12)' : 'transparent'}
                    cursor="pointer"
                    onPress={() => onSelectDate(day)}
                    hoverStyle={{ backgroundColor: isSelected ? '$primary' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text fontSize="$2" color={isSelected ? '#0a0f14' : inMonth ? '$color' : '$muted'}>
                      {day.getDate()}
                    </Text>
                  </YStack>
                </YStack>
              );
            })}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
