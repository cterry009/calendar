import { Text, XStack, YStack } from '@calendar/ui';
import { sectionLabel } from '../../lib/studyGame/studySections';
import type { TutorSectionGame } from '../../lib/studyGame/tutorApi';

// The game around the chat (study-tutor-game D41): θ and the section level on a bar, global level
// and XP, the combo, and the note's bosses. The "+N XP" float and the level-up notice are keyed
// by the panel so each grade animates once; CSS only, and nothing moves under reduced motion.

export const TUTOR_ANIMATIONS = `
@keyframes tutor-xp-float { 0% { opacity: 0; transform: translateY(6px) } 15% { opacity: 1 } 100% { opacity: 0; transform: translateY(-28px) } }
@keyframes tutor-pop { 0% { transform: scale(0.85); opacity: 0 } 60% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
.tutor-xp-float { animation: tutor-xp-float 1.8s ease-out forwards; }
.tutor-pop { animation: tutor-pop 0.45s ease-out; }
.tutor-theta-fill { transition: width 0.8s ease-out; }
.tutor-markdown p { margin: 0 0 0.5em; }
.tutor-markdown p:last-child { margin-bottom: 0; }
.tutor-markdown ul, .tutor-markdown ol { margin: 0.25em 0 0.5em; padding-left: 1.4em; }
.tutor-markdown .katex-display { margin: 0.4em 0; overflow-x: auto; overflow-y: hidden; }
@media (prefers-reduced-motion: reduce) {
  .tutor-xp-float, .tutor-pop { animation: none; }
  .tutor-xp-float { opacity: 0; }
  .tutor-theta-fill { transition: none; }
}
`;

const THETA_MIN = -3;
const THETA_MAX = 3;
const LEVEL_MARKS = [-1, 0, 1, 2];

const thetaPercent = (theta: number) =>
  Math.round(
    (100 * (Math.min(THETA_MAX, Math.max(THETA_MIN, theta)) - THETA_MIN)) / (THETA_MAX - THETA_MIN),
  );

export function GameStrip({
  game,
  xpFloat,
  levelUp,
}: {
  game: TutorSectionGame;
  /** "+N XP" of the grade that just came in, keyed so it animates once. */
  xpFloat: { key: string; xp: number } | null;
  levelUp: { key: string; text: string } | null;
}) {
  const fill = thetaPercent(game.theta);
  return (
    <YStack gap="$2" position="relative">
      <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
        <Text fontWeight="700">
          {sectionLabel(game.section)} · nivel {game.level}
        </Text>
        <XStack gap="$3" alignItems="center">
          {game.combo >= 2 ? (
            <Text
              key={`combo-${game.combo}`}
              className="tutor-pop"
              color="$accent"
              fontWeight="800"
            >
              🔥 Combo ×{Math.min(1.5, 1 + 0.1 * game.combo).toFixed(1)}
            </Text>
          ) : null}
          <Text color="$muted">
            Nivel {game.globalLevel} · {game.xp} XP
          </Text>
        </XStack>
      </XStack>

      <div
        style={{
          position: 'relative',
          height: 10,
          borderRadius: 6,
          background: 'rgba(127,127,127,0.18)',
        }}
        title={`θ = ${game.theta.toFixed(2)}`}
      >
        <div
          className="tutor-theta-fill"
          style={{
            width: `${fill}%`,
            height: '100%',
            borderRadius: 6,
            background: 'linear-gradient(90deg, #4caf82, #4ee0a0)',
          }}
        />
        {LEVEL_MARKS.map((mark) => (
          <div
            key={mark}
            style={{
              position: 'absolute',
              top: -2,
              bottom: -2,
              width: 2,
              left: `${thetaPercent(mark)}%`,
              background: 'rgba(127,127,127,0.5)',
            }}
          />
        ))}
      </div>
      <XStack justifyContent="space-between">
        <Text fontSize="$1" color="$muted">
          θ = {game.theta.toFixed(2)} · {game.attempts} intentos
        </Text>
        <Text fontSize="$1" color="$muted">
          marcas: 🟢 🟡 🔴 ⚫
        </Text>
      </XStack>

      {game.bosses.length ? (
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Text fontSize="$2" color="$muted">
            Jefes:
          </Text>
          {game.bosses.map((boss) => (
            <Text
              key={boss.exerciseId}
              fontSize="$2"
              opacity={boss.beaten || boss.unlocked ? 1 : 0.55}
              title={
                boss.beaten
                  ? 'Vencido'
                  : boss.unlocked
                    ? 'Desbloqueado'
                    : 'Bloqueado: sube θ en la nota'
              }
            >
              {boss.kind === 'dificil' ? '🔴' : '⚫'} {boss.exerciseId.split('#').pop()}{' '}
              {boss.beaten ? '✅' : boss.unlocked ? '🔓' : '🔒'}
            </Text>
          ))}
        </XStack>
      ) : null}

      {xpFloat && xpFloat.xp > 0 ? (
        <span
          key={xpFloat.key}
          className="tutor-xp-float"
          style={{
            position: 'absolute',
            right: 8,
            top: -6,
            fontWeight: 800,
            color: '#4ee0a0',
            pointerEvents: 'none',
          }}
        >
          +{xpFloat.xp} XP
        </span>
      ) : null}
      {levelUp ? (
        <Text
          key={levelUp.key}
          className="tutor-pop"
          color="$accent"
          fontWeight="800"
          textAlign="center"
        >
          {levelUp.text}
        </Text>
      ) : null}
    </YStack>
  );
}
