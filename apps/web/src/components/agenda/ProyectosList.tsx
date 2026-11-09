import { useMemo, useState } from 'react';
import { localDateKey, projectsNeedingAttention } from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useToday } from '../../hooks/useNow';
import type { SyncProject } from '../../lib/calendar/types';
import { Pill, ProgressBar, SectionTitle, StripeCard, SummaryLine } from './parts';

// projects-and-claude-bridge 3.2 (read side, in the agenda-redesign look): the user's projects with
// status, priority, progress (or "sin estimar"), next steps and why one needs attention. Editing comes
// with the rest of 3.2.

type Filter = 'abiertos' | 'ACTIVE' | 'PAUSED' | 'IDEA' | 'DONE' | 'todos';
const FILTERS: Array<[Filter, string]> = [
  ['abiertos', 'Abiertos'],
  ['ACTIVE', 'Activos'],
  ['PAUSED', 'Pausados'],
  ['IDEA', 'Ideas'],
  ['DONE', 'Completados'],
  ['todos', 'Todos'],
];
const STATUS: Record<SyncProject['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' }> = {
  ACTIVE: { label: 'activo', tone: 'success' },
  PAUSED: { label: 'pausado', tone: 'warning' },
  BLOCKED: { label: 'bloqueado', tone: 'danger' },
  IDEA: { label: 'idea', tone: 'warning' },
  DONE: { label: 'completado', tone: 'muted' },
};
const PRIORITY: Record<SyncProject['priority'], string> = { HIGH: 'alta', MEDIUM: 'media', LOW: 'baja' };
const ORDER = { BLOCKED: 0, ACTIVE: 1, PAUSED: 2, IDEA: 3, DONE: 4 } as const;
const PORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export function ProyectosList() {
  const data = useCalendarData();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('abiertos');
  const attention = useMemo(
    () =>
      new Map(
        projectsNeedingAttention(data.projects, data.projectLogEntries.map((l) => ({ ...l, date: l.date.slice(0, 10) })), localDateKey(today)).map((a) => [a.projectId, a]),
      ),
    [data.projects, data.projectLogEntries, today],
  );
  const lastLog = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of data.projectLogEntries) {
      const d = l.date.slice(0, 10);
      if (!m.has(l.projectId) || d > (m.get(l.projectId) ?? '')) m.set(l.projectId, d);
    }
    return m;
  }, [data.projectLogEntries]);

  const list = data.projects
    .filter((p) => (filter === 'todos' ? true : filter === 'abiertos' ? p.status !== 'DONE' : p.status === filter))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || PORDER[a.priority] - PORDER[b.priority] || a.title.localeCompare(b.title));
  const active = data.projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <YStack gap="$3">
      <SummaryLine>
        {active} activos · {attention.size} piden atención · {data.projects.length} en total
      </SummaryLine>
      <XStack gap="$1" flexWrap="wrap">
        {FILTERS.map(([id, label]) => (
          <AppButton key={id} variant={filter === id ? 'primary' : 'ghost'} size="$2" onPress={() => setFilter(id)}>
            {label}
          </AppButton>
        ))}
      </XStack>
      {data.projects.length === 0 ? (
        <Paragraph margin={0} color="$muted">
          Aún no hay proyectos. Los 9 de la agenda de Claude se cargan con el puente (projects-and-claude-bridge 6.1), y podrás crearlos aquí.
        </Paragraph>
      ) : list.length === 0 ? (
        <Paragraph margin={0} color="$muted">
          No hay proyectos en este filtro.
        </Paragraph>
      ) : (
        <XStack gap="$3" flexWrap="wrap" alignItems="flex-start">
        {list.map((p) => {
          const a = attention.get(p.id);
          const last = lastLog.get(p.id);
          return (
            <YStack key={p.id} flexBasis={320} flexGrow={1} maxWidth={520}>
            <StripeCard color={p.color}>
              <XStack gap="$1" flexWrap="wrap">
                <Pill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Pill>
                <Pill tone={p.priority === 'HIGH' ? 'danger' : p.priority === 'MEDIUM' ? 'warning' : 'muted'}>prioridad {PRIORITY[p.priority]}</Pill>
                {p.area ? <Pill>{p.area}</Pill> : null}
              </XStack>
              <Text fontWeight="700" fontSize="$5">
                {p.title}
              </Text>
              {p.summary ? (
                <Paragraph margin={0} size="$2" color="$muted">
                  {p.summary}
                </Paragraph>
              ) : null}
              {p.progress !== null ? (
                <YStack gap="$1">
                  <Text fontSize="$2" color="$muted">
                    Avance {p.progress} %
                  </Text>
                  <ProgressBar value={p.progress} color={p.color} />
                </YStack>
              ) : (
                <Text fontSize="$2" color="$muted">
                  Avance sin estimar
                </Text>
              )}
              {p.nextSteps.length ? (
                <YStack gap="$1">
                  <SectionTitle>Próximos pasos</SectionTitle>
                  {p.nextSteps.slice(0, 3).map((s) => (
                    <Text key={s} fontSize="$3">
                      • {s}
                    </Text>
                  ))}
                </YStack>
              ) : null}
              <Text fontSize="$2" color={a && a.kind !== 'stale' ? '$danger' : '$muted'}>
                {[a?.reason, p.deadline ? `Límite: ${p.deadline.slice(0, 10)}` : null, last ? `Último avance: ${last}` : null].filter(Boolean).join(' · ')}
              </Text>
            </StripeCard>
            </YStack>
          );
        })}
        </XStack>
      )}
    </YStack>
  );
}
