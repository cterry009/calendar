import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { useDayAgenda } from '../hooks/useDayAgenda';
import { minuteLabel, type AgendaBlock } from '../lib/calendar/dayAgenda';
import { DAY_ABBREVIATIONS_ES, isSameDay } from '../lib/calendar/utils';

// The desktop's day view on the phone: an hourly grid with each work block split into its
// pomodoros and breaks (same shared plan math), rest blocks, habits in their own color, and tasks.
// Tapping any block or habit marks it done for that day (tap again to undo) -- the same record the
// desktop and the Habitos screen use, so it shows as done everywhere.

const HOUR_HEIGHT = 64;
const FIRST_HOUR = 5;
const LAST_HOUR = 24;
const GRID_LEFT = 52;
const MIN_BAR = 18;

const SEGMENT_STYLE = {
  pomodoro: { color: '#4caf82', label: 'Pomodoro' },
  'short-break': { color: '#8fa39a', label: 'Descanso corto' },
  'long-break': { color: '#e0b64c', label: 'Descanso largo' },
  excluded: { color: '#e5484d', label: 'Almuerzo' },
} as const;

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const offset = (result.getDay() + 6) % 7; // Monday first, like the desktop
  result.setDate(result.getDate() - offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function top(minute: number): number {
  return ((minute - FIRST_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function height(start: number, end: number): number {
  return Math.max(MIN_BAR, ((end - start) / 60) * HOUR_HEIGHT - 2);
}

// Plan segments sit back to back, so they keep their true height (a 10-min break is ~11px) instead
// of the MIN_BAR floor, which made a short break overlap the next pomodoro.
function segmentHeight(start: number, end: number): number {
  return Math.max(3, ((end - start) / 60) * HOUR_HEIGHT - 2);
}

function tint(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}2e` : 'rgba(255,255,255,0.06)';
}

export default function CalendarScreen() {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const { blocks, isLoading, busyId, toggleDone, toggleSkip } = useDayAgenda(selectedDate);

  // A work block: "hecho" or "no puedo hacer este bloque" (no prompt, overlay or blocking that
  // day). Anything already marked: undo it. Habits and rest blocks keep the one-tap toggle.
  const mark = (block: AgendaBlock) => {
    if (block.kind !== 'work') return void toggleDone(block);
    if (block.done) return void toggleDone(block);
    if (block.skipped) return void toggleSkip(block);
    Alert.alert(block.title, block.when, [
      { text: 'No puedo hacer este bloque', onPress: () => void toggleSkip(block) },
      { text: 'Hecho', onPress: () => void toggleDone(block) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };
  const scrollRef = useRef<ScrollView>(null);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const isToday = isSameDay(selectedDate, today);
  const [nowMinute, setNowMinute] = useState(() => today.getHours() * 60 + today.getMinutes());
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setNowMinute(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Open on the current hour (or the first block of another day).
  useEffect(() => {
    if (isLoading) return;
    const anchor = isToday ? nowMinute - 60 : (blocks[0]?.startMinute ?? 8 * 60) - 30;
    scrollRef.current?.scrollTo({ y: Math.max(0, top(anchor)), animated: false });
  }, [isLoading, selectedDate]);

  const background = blocks.filter((b) => b.kind === 'work' || b.kind === 'rest');
  const foreground = blocks.filter((b) => b.kind === 'habit' || b.kind === 'task');
  const doneCount = blocks.filter((b) => b.target && b.done).length;
  const markable = blocks.filter((b) => b.target).length;

  function renderLabel(block: AgendaBlock, color: string) {
    return (
      <Text fontSize="$2" fontWeight="700" color={color} numberOfLines={1}>
        {block.done ? '✓ ' : ''}
        {block.title}
      </Text>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <Stack.Screen
        options={{
          title: 'Calendario',
          headerShown: true,
          headerStyle: { backgroundColor: '#212e28' },
          headerTintColor: '#f2f7f4',
        }}
      />

      <YStack paddingHorizontal="$3" paddingTop="$3" gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <AppButton
            variant="ghost"
            onPress={() => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
          >
            ‹
          </AppButton>
          <Text fontWeight="700" textTransform="capitalize">
            {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <AppButton
            variant="ghost"
            onPress={() => setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
          >
            ›
          </AppButton>
        </XStack>
        <XStack gap="$1">
          {weekDays.map((day) => {
            const selected = isSameDay(day, selectedDate);
            return (
              <Pressable key={day.toISOString()} style={{ flex: 1 }} onPress={() => setSelectedDate(day)}>
                <YStack
                  alignItems="center"
                  paddingVertical="$2"
                  borderRadius="$3"
                  backgroundColor={selected ? '$accent' : 'transparent'}
                  borderWidth={isSameDay(day, today) && !selected ? 1 : 0}
                  borderColor="$accent"
                >
                  <Text fontSize="$1" color={selected ? '#0a1c13' : '$muted'}>
                    {DAY_ABBREVIATIONS_ES[day.getDay()]}
                  </Text>
                  <Text fontWeight="800" color={selected ? '#0a1c13' : '$color'}>
                    {day.getDate()}
                  </Text>
                </YStack>
              </Pressable>
            );
          })}
        </XStack>
        <Paragraph margin={0} size="$2" color="$muted">
          {markable > 0 ? `${doneCount} de ${markable} hechos · ` : ''}Toca un bloque o habito para marcarlo como hecho.
        </Paragraph>
      </YStack>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 40 }}>
        <YStack height={(LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT} marginTop="$2" position="relative">
          {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
            <XStack
              key={i}
              position="absolute"
              top={i * HOUR_HEIGHT}
              left={0}
              right={0}
              height={HOUR_HEIGHT}
              borderTopWidth={1}
              borderTopColor="rgba(255,255,255,0.06)"
            >
              <Text width={GRID_LEFT} paddingLeft="$2" fontSize="$1" color="$muted">
                {String(FIRST_HOUR + i).padStart(2, '0')}:00
              </Text>
            </XStack>
          ))}

          {background.map((block) =>
            block.kind === 'work' && block.segments.length > 0 ? (
              <Pressable
                key={block.id}
                disabled={busyId === block.id}
                onPress={() => mark(block)}
                style={{ position: 'absolute', top: top(block.startMinute), left: GRID_LEFT, right: 8 }}
              >
                {block.segments.map((segment, index) => {
                  const style = SEGMENT_STYLE[segment.type];
                  return (
                    <YStack
                      key={index}
                      position="absolute"
                      top={top(segment.startMinute) - top(block.startMinute)}
                      left={0}
                      right={0}
                      height={segmentHeight(segment.startMinute, segment.endMinute)}
                      borderRadius="$2"
                      borderWidth={1}
                      borderColor={style.color}
                      backgroundColor={segment.type === 'pomodoro' ? 'rgba(76,175,130,0.10)' : 'rgba(255,255,255,0.03)'}
                      paddingHorizontal="$2"
                      justifyContent="center"
                      opacity={block.done || block.skipped ? 0.45 : 1}
                    >
                      {segmentHeight(segment.startMinute, segment.endMinute) < 16 ? null : index === 0 ? (
                        renderLabel(block, style.color)
                      ) : (
                        <Text fontSize="$1" color={style.color} numberOfLines={1}>
                          {style.label} · {minuteLabel(segment.startMinute)}
                        </Text>
                      )}
                    </YStack>
                  );
                })}
              </Pressable>
            ) : (
              <Pressable
                key={block.id}
                disabled={busyId === block.id}
                onPress={() => mark(block)}
                style={{ position: 'absolute', top: top(block.startMinute), left: GRID_LEFT, right: 8 }}
              >
                <YStack
                  height={height(block.startMinute, block.endMinute)}
                  borderRadius="$2"
                  borderWidth={1}
                  borderColor={block.color}
                  backgroundColor="rgba(255,255,255,0.03)"
                  paddingHorizontal="$2"
                  justifyContent="center"
                  opacity={block.done ? 0.45 : 1}
                >
                  {renderLabel(block, block.color)}
                </YStack>
              </Pressable>
            ),
          )}

          {foreground.map((block) => {
            const isHabit = block.kind === 'habit';
            return (
              <Pressable
                key={block.id}
                disabled={!block.target || busyId === block.id}
                onPress={() => mark(block)}
                style={{ position: 'absolute', top: top(block.startMinute), left: GRID_LEFT + 24, right: 12, zIndex: 2 }}
              >
                <YStack
                  height={height(block.startMinute, block.endMinute)}
                  borderRadius="$2"
                  borderWidth={isHabit ? 1 : 0}
                  borderLeftWidth={isHabit ? 4 : 0}
                  borderColor={block.color}
                  backgroundColor={isHabit ? tint(block.color) : block.color}
                  paddingHorizontal="$2"
                  justifyContent="center"
                  opacity={block.done ? 0.5 : 1}
                >
                  {renderLabel(block, isHabit ? block.color : '#0a1c13')}
                </YStack>
              </Pressable>
            );
          })}

          {isToday && nowMinute >= FIRST_HOUR * 60 ? (
            <YStack
              position="absolute"
              top={top(nowMinute)}
              left={GRID_LEFT - 6}
              right={0}
              height={2}
              backgroundColor="$danger"
              zIndex={3}
            />
          ) : null}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
