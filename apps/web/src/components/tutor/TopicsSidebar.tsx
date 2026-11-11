import { useEffect, useMemo, useState } from 'react';
import {
  canRetire,
  DEFAULT_GAME_CONFIG,
  fillTopics,
  masteryPercent,
  retireTopic,
  topicKey,
  type TopicRef,
  type TopicSet,
} from '@calendar/shared';
import { AppButton, Text, XStack, YStack } from '@calendar/ui';
import { plainMath, sectionLabel } from '../../lib/studyGame/studySections';
import { tutorState, type TutorNoteSummary, type TutorSectionGame } from '../../lib/studyGame/tutorApi';
import { ProgressBar } from '../agenda/parts';

// The tutor's five working topics (2026-11-10): one bar of mastery each; a click switches the tutor
// to it; a mastered one can be retired and the next topic of the pensum takes its place. The set is
// kept on this device for now.

// v2 (2026-11-10): pensum order by note code instead of folder path; the first set had started on AN1.
const STORAGE_KEY = 'calendar.tutor.topics.v2';

function loadSet(): TopicSet {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as TopicSet) : null;
    if (v && Array.isArray(v.active) && Array.isArray(v.retired)) return v;
  } catch {
    /* fall through */
  }
  return { active: [], retired: [] };
}

function saveSet(set: TopicSet) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(set));
  } catch {
    /* per-device convenience */
  }
}

interface Mastery {
  theta: number;
  level: number;
  attempts: number;
}

export function TopicsSidebar({
  notes,
  choice,
  game,
  disabled,
  autoPick,
  pinned,
  onChoose,
  width = 270,
  fill = false,
}: {
  notes: TutorNoteSummary[] | null;
  choice: TopicRef | null;
  game: TutorSectionGame | null;
  disabled?: boolean;
  /** Open the first topic when nothing is chosen (outside a study block). */
  autoPick?: boolean;
  /** The study block's topic: always in the set, first, while the block runs. */
  pinned?: TopicRef | null;
  onChoose: (topic: TopicRef) => void;
  /** Column width; the focus view lets you drag it. */
  width?: number;
  /** Fill the column's height and scroll inside it (focus view). */
  fill?: boolean;
}) {
  const pensum = useMemo<TopicRef[]>(
    // Pensum order = note code order (00b sets, 01a topology, then AN1, AN1b... analysis), sections as written.
    () =>
      [...(notes ?? [])]
        .sort((a, b) => a.noteCode.localeCompare(b.noteCode, 'es', { numeric: true }))
        .flatMap((n) => n.sections.map((s) => ({ noteCode: n.noteCode, section: s.section }))),
    [notes],
  );
  const titles = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of notes ?? []) for (const s of n.sections) m.set(topicKey({ noteCode: n.noteCode, section: s.section }), plainMath(s.title.replace(/^\d+\.\s*/, '')));
    return m;
  }, [notes]);
  const [mastery, setMastery] = useState<Record<string, Mastery>>({});
  const levelOf = (t: TopicRef) => mastery[topicKey(t)]?.level;
  const [set, setSet] = useState<TopicSet>(loadSet);

  const pinnedKey = pinned ? topicKey(pinned) : '';
  // Top the set up whenever the pensum or the known levels change.
  useEffect(() => {
    if (!pensum.length) return;
    setSet((current) => {
      const withPin =
        pinned && pensum.some((t) => topicKey(t) === topicKey(pinned)) && !current.active.some((t) => topicKey(t) === topicKey(pinned))
          ? { ...current, active: [pinned, ...current.active].slice(0, 5) }
          : current;
      const next = fillTopics(pensum, withPin, (t) => mastery[topicKey(t)]?.level);
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      saveSet(next);
      return next;
    });
  }, [pensum, mastery, pinnedKey]); // pinned is a fresh object each render: keyed

  // Fetch the mastery of the active topics we don't know yet.
  const activeKeys = set.active.map(topicKey).join('|');
  useEffect(() => {
    const missing = set.active.filter((t) => !mastery[topicKey(t)]);
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map((t) =>
        tutorState(t.noteCode, t.section)
          .then((g) => [topicKey(t), { theta: g.theta, level: g.level, attempts: g.attempts }] as const)
          .catch(() => null),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const found = rows.filter((r): r is NonNullable<typeof r> => r !== null);
      if (found.length) setMastery((m) => ({ ...m, ...Object.fromEntries(found) }));
    });
    return () => {
      cancelled = true;
    };
  }, [activeKeys]); // refetch only when the set changes

  // The tutor's latest game for the open topic updates its bar right away.
  useEffect(() => {
    if (!game) return;
    setMastery((m) => ({ ...m, [topicKey(game)]: { theta: game.theta, level: game.level, attempts: game.attempts } }));
  }, [game]);

  useEffect(() => {
    if (autoPick && !choice && set.active[0]) onChoose(set.active[0]);
  }, [autoPick, choice, set.active, onChoose]);

  function retire(t: TopicRef) {
    const next = retireTopic(pensum, set, t, levelOf);
    setSet(next);
    saveSet(next);
    if (choice && topicKey(choice) === topicKey(t) && next.active[0]) onChoose(next.active[0]);
  }

  if (!notes) return null;
  const thresholds = DEFAULT_GAME_CONFIG.sectionLevelThresholds;

  return (
    <YStack width={width} flexShrink={0} gap="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4" backgroundColor="$surface" alignSelf={fill ? 'stretch' : 'flex-start'} style={fill ? { overflowY: 'auto', gap: 'var(--tutor-gap, 8px)' } : undefined}>
      <Text fontSize={12} fontWeight="700" letterSpacing={1.2} color="$muted" textTransform="uppercase">
        Temas en curso
      </Text>
      {set.active.length === 0 ? (
        <Text fontSize="$2" color="$muted">
          No quedan temas sin dominar en el pensum.
        </Text>
      ) : null}
      {set.active.map((t) => {
        const k = topicKey(t);
        const m = mastery[k];
        const selected = choice !== null && topicKey(choice) === k;
        const pct = masteryPercent(m?.theta, thresholds);
        const mastered = canRetire(m?.level);
        return (
          <YStack
            key={k}
            gap="$1"
            padding="$2"
            borderRadius="$3"
            borderWidth={1}
            borderColor={selected ? '$accent' : '$borderColor'}
            backgroundColor={selected ? '$accentBackground' : 'transparent'}
            cursor={disabled ? 'default' : 'pointer'}
            opacity={disabled && !selected ? 0.6 : 1}
            onPress={() => {
              if (!disabled && !selected) onChoose(t);
            }}
            role="button"
            aria-pressed={selected}
            aria-label={`Tema ${t.noteCode} ${sectionLabel(t.section)}`}
          >
            <Text fontSize="$2" color="$muted">
              {t.noteCode} · {sectionLabel(t.section)}
            </Text>
            <Text fontSize="$3" fontWeight="600" numberOfLines={2}>
              {titles.get(k) ?? t.section}
            </Text>
            <YStack opacity={m && m.attempts === 0 ? 0.45 : 1}>
              <ProgressBar value={pct} />
            </YStack>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$2" color={mastered ? '$success' : '$muted'}>
                {!m
                  ? '…'
                  : mastered
                    ? `Dominado · nivel ${m.level}`
                    : m.attempts === 0
                      ? `Sin intentos · arranca en nivel ${m.level}`
                      : `Nivel ${m.level} · ${pct} % · ${m.attempts} ${m.attempts === 1 ? 'intento' : 'intentos'}`}
              </Text>
              {mastered ? (
                <AppButton variant="ghost" size="$2" disabled={disabled} onPress={() => retire(t)}>
                  Descartar
                </AppButton>
              ) : null}
            </XStack>
          </YStack>
        );
      })}
      <Text fontSize="$1" color="$muted">
        Se domina en el nivel 3. Al descartar uno entra el siguiente tema del pensum.
      </Text>
    </YStack>
  );
}
