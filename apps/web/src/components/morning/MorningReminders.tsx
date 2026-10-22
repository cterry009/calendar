import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { dueBlockReminder, localDateKey, type BlockReminder } from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useDayBlocks } from '../../hooks/useMorningWindow';
import { notifySystem } from '../../lib/desktop/notify';
import { focusView } from '../../lib/focusView/store';

// Soft reminders at the suggested times (dynamic-study-blocks D28): at 09:00, 11:00, 14:00 and 16:00,
// when nothing is running and that suggestion hasn't been started, once each. A system notification
// plus a small card with "Empezar"; the ids already shown live in localStorage per day (a per-device
// convenience: the phone has its own).

const CHECK_MS = 60_000;

function sentKey(date: string): string {
  return `calendar:block-reminders:${date}`;
}

function loadSent(date: string): string[] {
  try {
    const raw = window.localStorage.getItem(sentKey(date));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveSent(date: string, sent: string[]) {
  try {
    window.localStorage.setItem(sentKey(date), JSON.stringify(sent));
  } catch {
    // Private mode: it may remind again after a reload, which is harmless.
  }
}

export function MorningReminders() {
  const day = useDayBlocks();
  const { pomodoroSessions } = useCalendarData();
  const { session } = usePomodoro();
  const [shown, setShown] = useState<BlockReminder | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), CHECK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!day.suggestions.length || session?.active) return;
    const now = new Date();
    const date = localDateKey(now);
    const sent = loadSent(date);
    const reminder = dueBlockReminder({
      now,
      suggestions: day.suggestions.map((s) => ({
        scheduleId: s.schedule.id,
        startMinute: s.schedule.startMinute,
        label: s.schedule.label,
      })),
      sessions: pomodoroSessions ?? [],
      sent,
    });
    if (!reminder) return;
    saveSent(date, [...sent, reminder.id]);
    setShown(reminder);
    void notifySystem(reminder.title, reminder.body);
  }, [tick, day.suggestions, pomodoroSessions, session?.active]);

  // A block started (here or on the phone): the card has done its job.
  useEffect(() => {
    if (session?.active) setShown(null);
  }, [session?.active]);

  if (!shown || typeof document === 'undefined') return null;
  return createPortal(
    <YStack
      position="fixed"
      bottom={16}
      left={16}
      zIndex={9996}
      maxWidth={380}
      gap="$2"
      padding="$3"
      borderRadius="$6"
      backgroundColor="rgba(33, 40, 54, 0.96)"
      borderWidth={1}
      borderColor="rgba(78,224,160,0.5)"
    >
      <Text fontWeight="700">{shown.title}</Text>
      <Paragraph margin={0} fontSize="$3">
        {shown.body}
      </Paragraph>
      <XStack gap="$2" justifyContent="flex-end">
        <AppButton variant="ghost" onPress={() => setShown(null)}>
          Cerrar
        </AppButton>
        <AppButton
          variant="primary"
          onPress={() => {
            setShown(null);
            focusView.openStarter(shown.scheduleId);
          }}
        >
          Empezar
        </AppButton>
      </XStack>
    </YStack>,
    document.body,
  );
}
