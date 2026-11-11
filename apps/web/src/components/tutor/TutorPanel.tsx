import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { usePomodoro } from '../../context/PomodoroContext';
import { useNativeFieldStyle } from '../../hooks/useNativeFieldStyle';
import { useTasks } from '../../hooks/useTasks';
import { ApiError } from '../../lib/api';
import { sendExerciseAttempt } from '../../lib/studyGame/attempts';
import {
  EMPTY_CHAT,
  loadChat,
  saveChat,
  withSystemMessage,
  withTurn,
  withUserMessage,
  type ChatState,
} from '../../lib/studyGame/chat';
import { plainMath, sectionLabel, studySectionsOf } from '../../lib/studyGame/studySections';
import {
  currentForTurn,
  tutorNotes,
  tutorState,
  tutorTurn,
  type TutorNoteSummary,
  type TutorSectionGame,
  type TutorTurnResult,
} from '../../lib/studyGame/tutorApi';
import { ExerciseCard } from './ExerciseCard';
import { GameStrip, TUTOR_ANIMATIONS } from './GameStrip';
import { TopicsSidebar } from './TopicsSidebar';
import { Markdown } from './Markdown';

// The study tutor in the pomodoro page (study-tutor-game phase 4). In a study block it starts on
// the block's note and sections; otherwise the user picks any note and section (Saturday review).
// The server picks the exercise and records the grades; this panel only talks and shows the game.

interface SectionChoice {
  noteCode: string;
  section: string;
}

const GRADE_LABEL: Record<number, string> = {
  0: '0 · no salió',
  0.5: '½ · con ayuda',
  1: '1 · resuelto',
};

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return `El tutor no está disponible: ${error.message}`;
    if (error.status === 502)
      return `El tutor respondió algo que la app no pudo usar (${error.message}). Prueba de nuevo.`;
    if (error.status === 429) return 'El tutor todavía está respondiendo el mensaje anterior.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'No se pudo hablar con el tutor.';
}

// The "Temas en curso" column in the focus view (2026-11-11): drag its edge to resize it; past the
// limit it folds into a slim rail that brings it back.
const SIDE_KEY = 'calendar.tutor.sidePane';
const SIDE_MIN = 220;
const SIDE_MAX = 480;
const SIDE_FOLD = 150;
type SidePane = { width: number; collapsed: boolean };
function loadSide(): SidePane {
  try {
    const raw = window.localStorage.getItem(SIDE_KEY);
    if (raw) return { width: 270, collapsed: false, ...(JSON.parse(raw) as Partial<SidePane>) };
  } catch {
    // Private mode: defaults.
  }
  return { width: 270, collapsed: false };
}
function saveSide(side: SidePane) {
  try {
    window.localStorage.setItem(SIDE_KEY, JSON.stringify(side));
  } catch {
    // Not remembered.
  }
}

/**
 * `fullHeight`: inside the focus view (2026-10-22) the chat takes the screen's height instead of the
 * page's 380 px.
 */
export function TutorPanel({ fullHeight = false }: { fullHeight?: boolean } = {}) {
  const pomodoro = usePomodoro();
  const { tasks } = useTasks();
  const fieldStyle = useNativeFieldStyle();
  const session = pomodoro.session;

  // The study session the running pomodoro is on: a block's, or one picked by hand on the pomodoro
  // page (2026-10-22: the tutor starts on its note there too).
  const blockTask = useMemo(() => {
    if (!session?.active || !session.taskId) return null;
    return tasks.find((t) => t.id === session.taskId) ?? null;
  }, [session?.active, session?.taskId, tasks]);
  const blockSections = useMemo(() => (blockTask ? studySectionsOf(blockTask) : null), [blockTask]);

  const [notes, setNotes] = useState<TutorNoteSummary[] | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [choice, setChoice] = useState<SectionChoice | null>(null);
  const [chat, setChat] = useState<ChatState>(EMPTY_CHAT);
  const [game, setGame] = useState<TutorSectionGame | null>(null);
  const [draft, setDraft] = useState('');
  const [thinkingSince, setThinkingSince] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [xpFloat, setXpFloat] = useState<{ key: string; xp: number } | null>(null);
  const [levelUp, setLevelUp] = useState<{ key: string; text: string } | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    tutorNotes()
      .then(setNotes)
      .catch((e: unknown) => setNotesError(errorText(e)));
  }, []);

  // Sections the block offers, limited to those with exercises in the vault.
  const blockOptions = useMemo(() => {
    if (!blockSections || !notes) return [];
    const note = notes.find((n) => n.noteCode === blockSections.noteCode);
    const available = new Set(note?.sections.map((s) => s.section) ?? []);
    return blockSections.sections.filter((s) => available.has(s));
  }, [blockSections, notes]);

  // Start on the block's first section; keep whatever the user picked otherwise.
  useEffect(() => {
    if (blockSections && blockOptions.length) {
      setChoice((current) =>
        current?.noteCode === blockSections.noteCode && blockOptions.includes(current.section)
          ? current
          : { noteCode: blockSections.noteCode, section: blockOptions[0] },
      );
    }
  }, [blockSections, blockOptions]);

  const refreshGame = useCallback(async (target: SectionChoice) => {
    try {
      setGame(await tutorState(target.noteCode, target.section));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    if (!choice) return;
    setChat(loadChat(choice.noteCode, choice.section));
    setError(null);
    setXpFloat(null);
    setLevelUp(null);
    void refreshGame(choice);
  }, [choice, refreshGame]);

  useEffect(() => {
    if (choice) saveChat(choice.noteCode, choice.section, chat);
  }, [choice, chat]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages.length, thinkingSince]);

  useEffect(() => {
    if (thinkingSince === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [thinkingSince]);

  const celebrate = (before: TutorSectionGame | null, turn: TutorTurnResult) => {
    if (!turn.attempt) return;
    setXpFloat({ key: turn.attempt.id, xp: turn.attempt.xpGained });
    if (before && turn.game.globalLevel > before.globalLevel) {
      setLevelUp({ key: turn.attempt.id, text: `⭐ ¡Subiste al nivel ${turn.game.globalLevel}!` });
    } else if (before && turn.game.level > before.level) {
      setLevelUp({
        key: turn.attempt.id,
        text: `⬆️ ${sectionLabel(turn.game.section)}: nivel ${turn.game.level}`,
      });
    } else {
      setLevelUp(null);
    }
  };

  const send = async (message: string) => {
    const text = message.trim();
    if (!choice || !text || thinkingSince !== null) return;
    const before = game;
    setDraft('');
    setError(null);
    setChat((c) => withUserMessage(c, text));
    setThinkingSince(Date.now());
    setNow(Date.now());
    try {
      const turn = await tutorTurn({
        noteCode: choice.noteCode,
        section: choice.section,
        message: text,
        sessionId: chat.sessionId ?? undefined,
        current: currentForTurn(chat.current),
        pomodoroSessionId: blockTask && session ? session.id : undefined,
        studyTaskId: blockTask?.id,
      });
      setChat((c) => withTurn(c, turn));
      setGame(turn.game);
      celebrate(before, turn);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setThinkingSince(null);
    }
  };

  const correct = async (r: 0 | 0.5 | 1) => {
    const graded = chat.lastAttempt;
    if (!choice || !graded || graded.r === r) return;
    setCorrecting(true);
    const { attempt, sent } = sendExerciseAttempt({
      exerciseId: graded.exerciseId,
      exerciseSource: graded.exerciseSource,
      noteCode: graded.noteCode,
      section: graded.section,
      b: graded.b,
      r,
      hints: graded.hints,
      minutes: null,
      gradedBy: 'usuario',
      supersedes: graded.id,
      pomodoroSessionId: blockTask && session ? session.id : null,
      studyTaskId: blockTask?.id ?? null,
    });
    const reached = await sent;
    setChat((c) =>
      withSystemMessage(
        {
          ...c,
          lastAttempt: { ...graded, id: attempt.id, r, gradedBy: 'usuario', supersedes: graded.id },
        },
        `Calificación corregida: ${GRADE_LABEL[graded.r]} → ${GRADE_LABEL[r]}.${reached ? '' : ' Se enviará al volver la conexión.'}`,
      ),
    );
    if (reached) await refreshGame(choice);
    setCorrecting(false);
  };

  const [side, setSide] = useState<SidePane>(() =>
    typeof window === 'undefined' ? { width: 270, collapsed: false } : loadSide(),
  );
  const [sideDrag, setSideDrag] = useState<{ x: number; w: number; scale: number } | null>(null);
  useEffect(() => {
    if (!sideDrag) return;
    let latest: SidePane | null = null;
    const onMove = (e: PointerEvent) => {
      const w = sideDrag.w + (sideDrag.x - e.clientX) / sideDrag.scale;
      setSide((current) => {
        latest =
          w < SIDE_FOLD
            ? { ...current, collapsed: true }
            : { width: Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, w))), collapsed: false };
        return latest;
      });
    };
    const onUp = () => {
      if (latest) saveSide(latest);
      setSideDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
  }, [sideDrag]);
  const startSideDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    // The chat may be zoomed (A−/A+): pointer pixels are screen pixels, widths are CSS pixels.
    const scale = el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
    setSideDrag({ x: e.clientX, w: side.collapsed ? 0 : side.width, scale: scale || 1 });
  };
  const openSide = () => {
    const next = { width: Math.max(SIDE_MIN, side.width), collapsed: false };
    setSide(next);
    saveSide(next);
  };

  // The header (title, note and section pickers) folds into a thin bar in the focus view.
  const [headerFolded, setHeaderFolded] = useState(() => {
    try {
      return window.localStorage.getItem('calendar.tutor.headerFolded') === '1';
    } catch {
      return false;
    }
  });
  const toggleHeader = () => {
    const next = !headerFolded;
    setHeaderFolded(next);
    try {
      window.localStorage.setItem('calendar.tutor.headerFolded', next ? '1' : '0');
    } catch {
      // Not remembered.
    }
  };
  const folded = fullHeight && headerFolded;

  const thinking = thinkingSince !== null;
  const selectedNote = notes?.find((n) => n.noteCode === choice?.noteCode) ?? null;

  return (
    <XStack
      gap={fullHeight ? 0 : '$3'}
      alignItems="stretch"
      // In the focus view the topics stay on the right whatever the text size (no wrapping below).
      flexWrap={fullHeight ? 'nowrap' : 'wrap'}
      flex={fullHeight ? 1 : undefined}
      minHeight={fullHeight ? 0 : undefined}
    >

    <AppCard flex={1} minWidth={fullHeight ? 0 : 320} minHeight={fullHeight ? 0 : undefined}>
      <style>{TUTOR_ANIMATIONS}</style>
      <YStack gap="$3" flex={fullHeight ? 1 : undefined} minHeight={fullHeight ? 0 : undefined}>
        <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
          <XStack gap="$2" alignItems="baseline" flexShrink={1} minWidth={0}>
            <Text fontSize={folded ? '$3' : '$6'} fontWeight="800">
              Tutor
            </Text>
            {folded && choice ? (
              <Text color="$muted" fontSize="$2" numberOfLines={1}>
                {choice.noteCode} · {sectionLabel(choice.section)}
              </Text>
            ) : blockTask ? (
              <Text color="$muted" fontSize="$2" numberOfLines={1}>
                Sesión: {blockTask.title}
              </Text>
            ) : null}
          </XStack>
          {fullHeight ? (
            // Focus view: the level line sits on the title's right instead of taking its own row.
            <XStack gap="$2" alignItems="center" marginLeft="auto">
              {choice && game ? (
                <GameStrip game={game} xpFloat={xpFloat} levelUp={levelUp} compact />
              ) : null}
              <AppButton
                variant="ghost"
                size="$2"
                onPress={toggleHeader}
                aria-expanded={!folded}
                aria-label={folded ? 'Mostrar el encabezado' : 'Ocultar el encabezado'}
              >
                {folded ? '▾' : '▴'}
              </AppButton>
            </XStack>
          ) : null}
        </XStack>

        {folded ? null : (<>
        {notesError ? (
          <Paragraph color="$error" margin={0}>
            {notesError}
          </Paragraph>
        ) : null}

        {blockSections && blockOptions.length ? (
          <XStack gap="$2" flexWrap="wrap">
            {blockOptions.map((s) => (
              <AppButton
                key={s}
                variant={
                  choice?.section === s && choice.noteCode === blockSections.noteCode
                    ? 'primary'
                    : 'ghost'
                }
                disabled={thinking}
                onPress={() => setChoice({ noteCode: blockSections.noteCode, section: s })}
              >
                {`${blockSections.noteCode} ${sectionLabel(s)}`}
              </AppButton>
            ))}
          </XStack>
        ) : (
          <XStack gap="$2" flexWrap="wrap">
            <select
              aria-label="Nota"
              value={choice?.noteCode ?? ''}
              disabled={thinking || !notes}
              onChange={(e) => {
                const note = notes?.find((n) => n.noteCode === e.target.value);
                setChoice(
                  note?.sections[0]
                    ? { noteCode: note.noteCode, section: note.sections[0].section }
                    : null,
                );
              }}
              style={{
                minHeight: 40,
                borderRadius: 8,
                padding: '0 10px',
                flex: '1 1 200px',
                ...fieldStyle,
              }}
            >
              <option value="">{notes ? 'Elige una nota' : 'Cargando notas…'}</option>
              {notes?.map((n) => (
                <option key={n.noteCode} value={n.noteCode}>
                  {n.noteCode} — {plainMath(n.title)}
                </option>
              ))}
            </select>
            {selectedNote ? (
              <select
                aria-label="Sección"
                value={choice?.section ?? ''}
                disabled={thinking}
                onChange={(e) =>
                  setChoice({ noteCode: selectedNote.noteCode, section: e.target.value })
                }
                style={{
                  minHeight: 40,
                  borderRadius: 8,
                  padding: '0 10px',
                  flex: '1 1 160px',
                  ...fieldStyle,
                }}
              >
                {selectedNote.sections.map((s) => (
                  <option key={s.section} value={s.section}>
                    {sectionLabel(s.section)} · {plainMath(s.title.replace(/^\d+\.\s*/, ''))} (
                    {s.exercises})
                  </option>
                ))}
              </select>
            ) : null}
          </XStack>
        )}

        </>)}

        {choice && game && !fullHeight ? <GameStrip game={game} xpFloat={xpFloat} levelUp={levelUp} /> : null}

        {choice ? (
          <>
            <div
              ref={scroller}
              style={{
                // In the focus view the chat fills the card down to the composer.
                ...(fullHeight ? { flex: '1 1 0', minHeight: 120 } : { maxHeight: 380 }),
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 4,
              }}
            >
              {chat.messages.length === 0 ? (
                <Paragraph color="$muted" margin={0}>
                  Saluda al tutor o pídele el primer ejercicio. Las respuestas tardan unos segundos.
                </Paragraph>
              ) : null}
              {chat.messages.map((m, i) => (
                <YStack
                  key={`${m.at}-${i}`}
                  alignSelf={m.role === 'user' ? 'flex-end' : 'stretch'}
                  maxWidth={m.role === 'user' ? '85%' : '100%'}
                  padding="$2"
                  paddingHorizontal="$3"
                  borderRadius="$4"
                  backgroundColor={
                    m.role === 'user'
                      ? '$accentBackground'
                      : m.role === 'system'
                        ? 'transparent'
                        : '$surfaceHover'
                  }
                >
                  {m.role === 'system' ? (
                    <Text fontSize="$2" color="$muted">
                      {m.text}
                    </Text>
                  ) : (
                    <Markdown text={m.text} />
                  )}
                  {m.attempt ? (
                    <Text fontSize="$2" color="$accent" fontWeight="700" marginTop="$1">
                      Calificación {GRADE_LABEL[m.attempt.r]} · +{m.attempt.xpGained} XP · θ{' '}
                      {m.attempt.thetaBefore.toFixed(2)} → {m.attempt.thetaAfter.toFixed(2)}
                    </Text>
                  ) : null}
                </YStack>
              ))}
              {thinking ? (
                <Text color="$muted" fontSize="$2">
                  El tutor está pensando…{' '}
                  {Math.max(0, Math.round((now - (thinkingSince ?? now)) / 1000))} s
                </Text>
              ) : null}
            </div>

            {chat.lastAttempt ? (
              <XStack gap="$2" alignItems="center" flexWrap="wrap">
                <Text fontSize="$2" color="$muted">
                  ¿La calificación de {chat.lastAttempt.exerciseId} no fue justa? Corregir:
                </Text>
                {([0, 0.5, 1] as const).map((r) => (
                  <AppButton
                    key={r}
                    variant={chat.lastAttempt?.r === r ? 'primary' : 'ghost'}
                    disabled={correcting || thinking || chat.lastAttempt?.r === r}
                    onPress={() => void correct(r)}
                  >
                    {r === 0.5 ? '½' : String(r)}
                  </AppButton>
                ))}
              </XStack>
            ) : null}

            {chat.current ? (
              <ExerciseCard
                exercise={chat.current}
                disabled={thinking}
                onShortcut={(m) => void send(m)}
              />
            ) : chat.generateAt !== null ? (
              <Paragraph color="$muted" margin={0}>
                No quedan ejercicios de la nota a tu nivel en esta sección: el tutor escribirá uno
                nuevo en tu próximo mensaje.
              </Paragraph>
            ) : null}

            {error ? (
              <Paragraph color="$error" margin={0}>
                {error}
              </Paragraph>
            ) : null}

            <XStack gap="$2" alignItems="flex-end">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                placeholder="Escribe tu respuesta o pregunta (LaTeX con $...$). Enter envía, Shift+Enter salta línea."
                rows={3}
                disabled={thinking}
                style={{ flex: 1, borderRadius: 8, padding: 10, resize: 'vertical', ...fieldStyle }}
              />
              <AppButton
                variant="primary"
                disabled={thinking || !draft.trim()}
                onPress={() => void send(draft)}
              >
                Enviar
              </AppButton>
            </XStack>
            {chat.messages.length ? (
              <AppButton
                variant="ghost"
                disabled={thinking}
                onPress={() =>
                  setChat({ ...EMPTY_CHAT, current: chat.current, generateAt: chat.generateAt })
                }
              >
                Nueva conversación
              </AppButton>
            ) : null}
          </>
        ) : (
          <Paragraph color="$muted" margin={0}>
            Elige una nota y una sección para practicar con el tutor.
          </Paragraph>
        )}
      </YStack>
    </AppCard>
    {fullHeight ? (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={side.collapsed ? 'Mostrar temas en curso' : 'Ajustar el ancho de los temas'}
        title={side.collapsed ? 'Clic o arrastra para mostrar los temas' : 'Arrastra para ajustar; llévalo a la derecha para ocultar'}
        onPointerDown={startSideDrag}
        onClick={side.collapsed ? openSide : undefined}
        style={{
          width: side.collapsed ? 22 : 12,
          flexShrink: 0,
          cursor: side.collapsed ? 'pointer' : 'col-resize',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          borderRadius: 6,
          background: side.collapsed ? 'rgba(127,127,127,0.10)' : undefined,
        }}
      >
        {side.collapsed ? (
          <span style={{ writingMode: 'vertical-rl', fontSize: 11, opacity: 0.7, letterSpacing: 1 }}>◂ TEMAS</span>
        ) : (
          <div style={{ width: 4, height: 64, borderRadius: 2, background: sideDrag ? 'rgba(78,224,160,0.9)' : 'rgba(127,127,127,0.35)' }} />
        )}
      </div>
    ) : null}
    {/* Folded, it stays mounted (hidden): it still picks the first topic. */}
    <div style={fullHeight ? { display: side.collapsed ? 'none' : 'flex', minHeight: 0 } : { display: 'contents' }}>
      <TopicsSidebar notes={notes} choice={choice} game={game} disabled={thinking} autoPick={!blockSections}
        pinned={blockSections && blockOptions[0] ? { noteCode: blockSections.noteCode, section: blockOptions[0] } : null}
        onChoose={setChoice}
        width={fullHeight ? side.width : 270}
        fill={fullHeight}
      />
    </div>
    </XStack>
  );
}
