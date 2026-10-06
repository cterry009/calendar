import { BLOCK_RATINGS, BLOCK_REVIEW_TAGS, studyLineOf } from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { Input } from 'tamagui';
import { useCalendarData } from '../hooks/useCalendarData';
import { closeReviewSheet, markReviewed, subscribeReviewSheet, type ReviewRequest } from '../lib/blockPrompt/reviewSheet';
import { logFocusEvent } from '../lib/focusEvents/log';

// The one thing a block asks, at its end (user-requested, 2026-10-07): how it went on a 1-5 scale,
// what applied (productive, concentrated, distracted...), a comment on what could have gone better,
// and -- for a study block -- whether the session got done (done completes it; otherwise it stays
// pending and is the session of the line's next block). Logged as a CHECK_IN focus event.

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Text
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderRadius="$6"
        borderWidth={1}
        borderColor={selected ? '$accent' : '$borderColor'}
        color={selected ? '$accent' : '$color'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BlockReviewSheet() {
  const [request, setRequest] = useState<ReviewRequest | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [sessionDone, setSessionDone] = useState<boolean | null>(null);
  const { schedules, tasks, completeTask } = useCalendarData();

  useEffect(() => subscribeReviewSheet(setRequest), []);
  useEffect(() => {
    setRating(request?.rating ?? null);
    setTags([]);
    setComment('');
    setSessionDone(null);
  }, [request]);

  if (!request) return null;
  const schedule = schedules.find((s) => s.id === request.scheduleId);
  const task = request.taskId ? tasks.find((t) => t.id === request.taskId) : null;
  const studyTask = task && studyLineOf(task) && task.status !== 'COMPLETED' ? task : null;

  const toggleTag = (tag: string) => setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));

  async function finish(save: boolean) {
    if (!request) return;
    if (save && rating) {
      logFocusEvent({
        kind: 'CHECK_IN',
        scheduleId: request.scheduleId,
        taskId: request.taskId ?? undefined,
        value: rating,
        meta: { review: true, rating, tags, comment: comment.trim() || undefined, sessionDone: sessionDone ?? undefined },
      });
      if (studyTask && sessionDone) await completeTask(studyTask).catch(() => undefined);
    }
    await markReviewed(request.key);
    closeReviewSheet();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => void finish(false)}>
      <YStack flex={1} justifyContent="flex-end" backgroundColor="rgba(0,0,0,0.55)">
        <YStack backgroundColor="$background" padding="$5" borderTopLeftRadius="$6" borderTopRightRadius="$6" maxHeight="90%">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Text fontSize="$6" fontWeight="700">
              ¿Cómo te fue?
            </Text>
            <Paragraph margin={0} color="$muted">
              {schedule?.label ?? 'Bloque de trabajo'}
            </Paragraph>

            <XStack gap="$2" flexWrap="wrap">
              {BLOCK_RATINGS.map((option) => (
                <Chip key={option.value} label={`${option.value} · ${option.label}`} selected={rating === option.value} onPress={() => setRating(option.value)} />
              ))}
            </XStack>

            <Text fontWeight="700">¿Qué pasó?</Text>
            <XStack gap="$2" flexWrap="wrap">
              {BLOCK_REVIEW_TAGS.map((tag) => (
                <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
              ))}
            </XStack>

            {studyTask ? (
              <>
                <Text fontWeight="700">¿Completaste la sesión «{studyTask.title}»?</Text>
                <XStack gap="$2">
                  <Chip label="Sí, completada" selected={sessionDone === true} onPress={() => setSessionDone(true)} />
                  <Chip label="No, pasa al próximo bloque" selected={sessionDone === false} onPress={() => setSessionDone(false)} />
                </XStack>
              </>
            ) : null}

            <Text fontWeight="700">¿Qué pudo haber sido mejor?</Text>
            <Input placeholder="Comentario (opcional)" value={comment} onChangeText={setComment} multiline numberOfLines={3} />

            <AppButton variant="primary" disabled={!rating} onPress={() => void finish(true)}>
              Guardar
            </AppButton>
            <AppButton variant="ghost" onPress={() => void finish(false)}>
              Ahora no
            </AppButton>
          </ScrollView>
        </YStack>
      </YStack>
    </Modal>
  );
}
