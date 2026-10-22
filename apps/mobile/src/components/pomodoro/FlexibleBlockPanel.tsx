import {
  BAND_LABELS,
  BLOCK_DONE_FOCUS_MIN,
  BLOCK_MIN_MAX,
  BLOCK_MIN_MIN,
  BLOCK_MIN_STEP,
  FOCUS_MIN_MAX,
  FOCUS_MIN_MIN,
  FOCUS_MIN_STEP,
  adjustPlannedBlock,
  clampBlockMin,
  clampFocusMin,
  diagnosisBand,
  diagnosisProposal,
  elapsedBlockMinutes,
  focusMinFor,
  lastFocusWasCut,
  nextFlexibleWork,
} from '@calendar/shared';
import { AppButton, AppCard, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useEffect, useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { usePomodoro } from '../../context/PomodoroContext';
import { useDayBlocks, type DaySuggestion } from '../../hooks/useDayBlocks';
import { flexibleStore, todaysDiagnosis, useFlexibleState } from '../../lib/pomodoro/flexibleStore';
import { ScaleInput, Stepper } from './ScaleInput';

// Flexible blocks on the phone (dynamic-study-blocks revision 2, user-requested 2026-10-22): today's
// suggested blocks with "Empezar", the first diagnosis that sizes the block, and -- while one runs --
// the plan as a budget, the diagnosis before each focus with the ±10 rule, "Cortar tramo" and
// "Terminar bloque". The same rules and logs as the PC (packages/shared/src/plan/morning.ts).

function hhmm(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function StartSheet({ target, onClose }: { target: DaySuggestion; onClose: () => void }) {
  const { startFlexibleBlock, isMutating } = usePomodoro();
  const last = todaysDiagnosis(useFlexibleState());
  const [motivation, setMotivation] = useState<number | null>(last?.motivation ?? null);
  const [concentration, setConcentration] = useState<number | null>(last?.concentration ?? null);
  const [blockMin, setBlockMin] = useState(90);
  const [focusMin, setFocusMin] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const proposal = motivation !== null && concentration !== null ? diagnosisProposal(motivation, concentration) : null;
  const afterWindow = !!target.windowEnd && new Date() >= target.windowEnd;

  useEffect(() => {
    if (!proposal) return;
    setBlockMin(proposal.blockMin);
    setFocusMin(proposal.focusMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motivation, concentration]);

  async function start() {
    if (!proposal) return;
    flexibleStore.setLastDiagnosis(motivation!, concentration!);
    const id = await startFlexibleBlock({
      scheduleId: target.schedule.id,
      windowEndAt: afterWindow ? null : target.windowEnd,
      blockMin,
      focusMin,
      taskId: target.studyTask?.id ?? null,
      label: target.focusLabels?.[0],
      checkIn: { motivation: motivation!, concentration: concentration!, band: proposal.band, proposed: { blockMin: proposal.blockMin, focusMin: proposal.focusMin } },
    }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'No se pudo empezar el bloque.');
      return null;
    });
    if (id) onClose();
    else setError((current) => current ?? 'No se pudo empezar: ya hay un pomodoro corriendo.');
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <YStack flex={1} justifyContent="flex-end" backgroundColor="rgba(0,0,0,0.55)">
        <YStack backgroundColor="$background" padding="$5" borderTopLeftRadius="$6" borderTopRightRadius="$6" maxHeight="92%">
          <ScrollView contentContainerStyle={{ gap: 14 }}>
            <Text color="$accent" fontWeight="700">
              {target.schedule.label} · sugerido a las {hhmm(target.start)}
            </Text>
            <Text fontSize="$6" fontWeight="700">
              ¿Cómo llegas a este bloque?
            </Text>
            {target.studyTask ? (
              <Paragraph margin={0} color="$muted">
                Sesión: {target.studyTask.title}
              </Paragraph>
            ) : null}
            <ScaleInput label="Motivación" value={motivation} onChange={setMotivation} />
            <ScaleInput label="Concentración" value={concentration} onChange={setConcentration} />
            {proposal ? (
              <YStack gap="$2">
                <Text fontWeight="700">
                  Energía {BAND_LABELS[proposal.band].toLowerCase()}: {proposal.blockMin} min, primer foco de {proposal.focusMin}
                </Text>
                <Stepper label="Bloque" value={blockMin} min={BLOCK_MIN_MIN} max={BLOCK_MIN_MAX} step={BLOCK_MIN_STEP} onChange={(v) => setBlockMin(clampBlockMin(v))} />
                <Stepper label="Primer foco" value={focusMin} min={FOCUS_MIN_MIN} max={FOCUS_MIN_MAX} step={FOCUS_MIN_STEP} onChange={(v) => setFocusMin(clampFocusMin(v))} />
                <Paragraph margin={0} color="$muted" fontSize="$2">
                  Antes de cada foco das otra vez el diagnóstico; el bloque se ajusta ±10 min. Se cumple con {BLOCK_DONE_FOCUS_MIN} min de foco.
                  {afterWindow ? ' La ventana ya cerró: sin límite de hora.' : target.windowEnd ? ` A las ${hhmm(target.windowEnd)} no empieza otro foco.` : ''}
                </Paragraph>
              </YStack>
            ) : (
              <Paragraph margin={0} color="$muted" fontSize="$2">
                Toca las dos barras: con ellas la app propone la duración del bloque y del primer foco.
              </Paragraph>
            )}
            {error ? <Text color="$danger">{error}</Text> : null}
            <AppButton variant="primary" disabled={!proposal || isMutating} onPress={() => void start()}>
              Empezar
            </AppButton>
            <AppButton variant="ghost" onPress={onClose}>
              Ahora no
            </AppButton>
          </ScrollView>
        </YStack>
      </YStack>
    </Modal>
  );
}

/** The pause of a running flexible block: the next diagnosis, the ±10 rule, and starting the focus. */
function NextFocus() {
  const { session, startFocus, endBlock, isMutating } = usePomodoro();
  const flexible = useFlexibleState();
  const day = useDayBlocks();
  const last = todaysDiagnosis(flexible);
  const key = `${session?.id}:${session?.segmentIndex}:${session?.startedAt}`;
  const [motivation, setMotivation] = useState<number | null>(last?.motivation ?? null);
  const [concentration, setConcentration] = useState<number | null>(last?.concentration ?? null);
  const [touched, setTouched] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [planned, setPlanned] = useState<number | null>(null);

  useEffect(() => {
    setMotivation(last?.motivation ?? null);
    setConcentration(last?.concentration ?? null);
    setTouched(false);
    setMinutes(null);
    setPlanned(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!session) return null;
  const band = motivation !== null && concentration !== null ? diagnosisBand(motivation, concentration) : null;
  const rating =
    flexible.lastRating?.sessionId === session.id && flexible.lastRating.cycle === session.completedCycles ? flexible.lastRating.rating : null;
  const plannedBefore = session.plannedBlockMin ?? BLOCK_MIN_MAX;
  const rule = band
    ? adjustPlannedBlock({ planned: plannedBefore, lastRating: rating, band, lastCut: lastFocusWasCut(session), workedMin: elapsedBlockMinutes(session) })
    : null;
  const plannedNow = planned ?? rule?.planned ?? plannedBefore;
  const next = nextFlexibleWork(session, Date.now(), plannedNow);
  const proposedFocus = band && next?.tipo === 'foco' ? Math.min(focusMinFor(band), next.minutes) : null;
  const focusNow = minutes ?? proposedFocus ?? 30;
  const labels = day.suggestions.find((s) => s.schedule.id === session.scheduleId)?.focusLabels;

  if (!next) {
    return (
      <AppButton variant="primary" disabled={isMutating} onPress={() => void endBlock()}>
        Terminar bloque
      </AppButton>
    );
  }
  if (next.tipo === 'cierre') {
    return (
      <YStack gap="$2">
        <Paragraph margin={0} color="$muted" textAlign="center">
          {next.closingOnly && session.windowEndAt
            ? `Ya son más de las ${hhmm(session.windowEndAt)}: sigue el cierre.`
            : 'Otro foco ya no cabe en el bloque planeado: sigue el cierre.'}
        </Paragraph>
        <AppButton variant="primary" disabled={isMutating} onPress={() => void startFocus({ closing: true })}>
          Empezar cierre ({next.minutes} min)
        </AppButton>
      </YStack>
    );
  }
  return (
    <YStack gap="$3" width="100%">
      <Text fontWeight="700" textAlign="center">
        ¿Cómo llegas al foco {next.focusesDone + 1}?
      </Text>
      <ScaleInput
        label="Motivación"
        value={motivation}
        onChange={(v) => {
          setMotivation(v);
          setTouched(true);
          setMinutes(null);
          setPlanned(null);
        }}
      />
      <ScaleInput
        label="Concentración"
        value={concentration}
        onChange={(v) => {
          setConcentration(v);
          setTouched(true);
          setMinutes(null);
          setPlanned(null);
        }}
      />
      {band && rule ? (
        <YStack gap="$2">
          <Text fontSize="$2" color="$muted">
            {rule.reason}
            {rating === null ? ' (sin calificación del pomodoro anterior)' : ` · último pomodoro ${rating}/100`}
          </Text>
          <Stepper label="Bloque" value={plannedNow} min={BLOCK_MIN_MIN} max={BLOCK_MIN_MAX} step={BLOCK_MIN_STEP} onChange={(v) => setPlanned(clampBlockMin(v))} />
          <Stepper label="Este foco" value={focusNow} min={FOCUS_MIN_MIN} max={FOCUS_MIN_MAX} step={FOCUS_MIN_STEP} onChange={(v) => setMinutes(clampFocusMin(v))} />
          <AppButton
            variant="primary"
            disabled={isMutating || !touched}
            onPress={() => {
              flexibleStore.setLastDiagnosis(motivation!, concentration!);
              void startFocus({
                minutes: focusNow,
                plannedBlockMin: plannedNow,
                label: labels?.[next.focusesDone],
                diagnosis: { motivation: motivation!, concentration: concentration!, band, proposedFocusMin: proposedFocus ?? focusNow, plannedBefore, rule: rule.reason },
              });
            }}
          >
            {`Empezar foco de ${focusNow} min`}
          </AppButton>
          {!touched ? (
            <Text fontSize="$1" color="$muted" textAlign="center">
              Toca las barras (aunque sea para confirmar) para empezar.
            </Text>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}

/** The pomodoro screen's flexible-block part: the day's suggestions, or the running block's controls. */
export function FlexibleBlockPanel() {
  const { session, cutSegment, canCutSegment, endBlock, isMutating } = usePomodoro();
  const day = useDayBlocks();
  const [starting, setStarting] = useState<DaySuggestion | null>(null);

  if (session?.active && session.flexible) {
    const focus = session.state === 'FOCUS';
    const planned = session.plannedBlockMin ?? null;
    const elapsed = Math.round(elapsedBlockMinutes(session));
    const worked = session.focusMinutes ?? 0;
    return (
      <AppCard>
        <YStack gap="$3">
          {planned ? (
            <Text fontSize="$2" color="$muted" textAlign="center">
              Bloque planeado {planned} min · llevas {elapsed} · quedan {Math.max(0, planned - elapsed)} · foco real {worked} min
              {worked >= BLOCK_DONE_FOCUS_MIN ? ' (cumplido)' : ''}
            </Text>
          ) : null}
          {!focus && !session.pausedAt ? <NextFocus /> : null}
          <XStack gap="$2" justifyContent="center" flexWrap="wrap">
            {focus && canCutSegment ? (
              <AppButton variant="ghost" disabled={isMutating} onPress={() => void cutSegment()}>
                Cortar tramo
              </AppButton>
            ) : null}
            <AppButton variant="ghost" disabled={isMutating} onPress={() => void endBlock()}>
              Terminar bloque
            </AppButton>
          </XStack>
        </YStack>
      </AppCard>
    );
  }
  if (session?.active || !day.suggestions.length) return null;

  return (
    <AppCard>
      <YStack gap="$2">
        <Text fontWeight="700">Bloques de hoy</Text>
        <Text fontSize="$2" color="$muted">
          Mínimo del día: {day.morning.done} de {day.morning.target} de la mañana{day.morning.fulfilled ? ' · cumplido' : ''}
        </Text>
        {day.suggestions.map((s) => (
          <XStack key={s.schedule.id} alignItems="center" justifyContent="space-between" gap="$2">
            <YStack flex={1}>
              <Text fontWeight="600">
                {hhmm(s.start)} · {s.schedule.label}
              </Text>
              {s.studyTask ? (
                <Text fontSize="$2" color="$muted" numberOfLines={1}>
                  {s.studyTask.title}
                </Text>
              ) : null}
            </YStack>
            {s.started ? (
              <Text color="$muted" fontSize="$2">
                Empezado
              </Text>
            ) : (
              <AppButton variant="ghost" onPress={() => setStarting(s)}>
                Empezar
              </AppButton>
            )}
          </XStack>
        ))}
      </YStack>
      {starting ? <StartSheet target={starting} onClose={() => setStarting(null)} /> : null}
    </AppCard>
  );
}
