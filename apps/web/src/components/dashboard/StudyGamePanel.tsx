import { AppCard, H2, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { sectionLabel } from '../../lib/studyGame/studySections';
import type { GameDashboard } from '../../lib/studyGame/summary';

// The study game across notes (study-tutor-game D44): replayed on the client from the pulled
// attempts. Bosses need the vault's catalog, so they stay in the tutor panel.
export function StudyGamePanel({ game }: { game: GameDashboard }) {
  const progress = Math.min(100, Math.round((100 * game.xp) / Math.max(1, game.nextLevelXp)));
  return (
    <AppCard>
      <YStack gap="$4">
        <YStack gap="$1">
          <H2 margin={0} fontSize="$6">
            Juego de ejercicios
          </H2>
          <Paragraph color="$muted" margin={0}>
            Nivel {game.level} · {game.xp} XP (el siguiente pide {game.nextLevelXp}) ·{' '}
            {game.attempts} intentos con el tutor.
          </Paragraph>
          <div style={{ height: 8, borderRadius: 6, background: 'rgba(127,127,127,0.18)' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 6,
                background: '#4ee0a0',
              }}
            />
          </div>
        </YStack>

        <YStack gap="$3">
          {game.notes.map((note) => (
            <YStack key={note.noteCode} gap="$1">
              <Text fontWeight="700">{note.noteCode}</Text>
              <XStack gap="$3" flexWrap="wrap">
                {note.sections.map((s) => (
                  <Text key={s.section} fontSize="$2" color="$muted">
                    {sectionLabel(s.section)}: θ {s.theta.toFixed(2)} · nivel {s.level} ·{' '}
                    {s.attempts} int.
                  </Text>
                ))}
              </XStack>
            </YStack>
          ))}
        </YStack>

        {game.review.length ? (
          <YStack gap="$1">
            <Text fontWeight="700">Para repasar el sábado ({game.review.length})</Text>
            <Paragraph color="$muted" margin={0}>
              {game.review.map((r) => r.exerciseId).join(' · ')}
            </Paragraph>
          </YStack>
        ) : null}
      </YStack>
    </AppCard>
  );
}
