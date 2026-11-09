import { useMemo, useState } from 'react';
import { localDateKey, projectProgress, projectsNeedingAttention } from '@calendar/shared';
import { AppButton, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { useCalendarData } from '../../hooks/useCalendarData';
import { useToday } from '../../hooks/useNow';
import type { SyncProject } from '../../lib/calendar/types';
import { areaLabel, projectArea, type ProjectAreaKey } from '../../lib/projects/areas';
import { saveProject } from '../../lib/projects/sync';
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

export function ProyectosList({ areas }: { areas?: readonly ProjectAreaKey[] }) {
  const data = useCalendarData();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('abiertos');
  const [tag, setTag] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  async function save(p: SyncProject, patch: Partial<SyncProject>) {
    setSaving(p.id);
    try {
      await saveProject(p, patch);
      await data.refetch();
    } finally {
      setSaving(null);
    }
  }
  function addTag(p: SyncProject) {
    const t = (tagDraft[p.id] ?? '').trim();
    if (!t || (p.tags ?? []).includes(t)) return;
    setTagDraft((d) => ({ ...d, [p.id]: '' }));
    void save(p, { tags: [...(p.tags ?? []), t].slice(0, 12) });
  }
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

  const inArea = data.projects.filter((p) => !areas || areas.includes(projectArea(p.area)));
  const allTags = [...new Set(inArea.flatMap((p) => p.tags ?? []))].sort((a, b) => a.localeCompare(b));
  const list = inArea
    .filter((p) => !tag || (p.tags ?? []).includes(tag))
    .filter((p) => (filter === 'todos' ? true : filter === 'abiertos' ? p.status !== 'DONE' : p.status === filter))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || PORDER[a.priority] - PORDER[b.priority] || a.title.localeCompare(b.title));
  const active = inArea.filter((p) => p.status === 'ACTIVE').length;
  const flagged = inArea.filter((p) => attention.has(p.id)).length;

  return (
    <YStack gap="$3">
      <SummaryLine>
        {active} activos · {flagged} piden atención · {inArea.length} en total
      </SummaryLine>
      <XStack gap="$1" flexWrap="wrap">
        {FILTERS.map(([id, label]) => (
          <AppButton key={id} variant={filter === id ? 'primary' : 'ghost'} size="$2" onPress={() => setFilter(id)}>
            {label}
          </AppButton>
        ))}
      </XStack>
      {allTags.length ? (
        <XStack gap="$1" flexWrap="wrap" alignItems="center">
          <Text fontSize="$2" color="$muted">
            Etiquetas:
          </Text>
          {allTags.map((t) => (
            <AppButton key={t} variant={tag === t ? 'primary' : 'ghost'} size="$2" onPress={() => setTag(tag === t ? null : t)}>
              #{t}
            </AppButton>
          ))}
        </XStack>
      ) : null}
      {inArea.length === 0 ? (
        <Paragraph margin={0} color="$muted">
          No hay proyectos en esta área.
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
                <Pill>{areaLabel(p.area)}</Pill>
              </XStack>
              <Text fontWeight="700" fontSize="$5">
                {p.title}
              </Text>
              {p.summary ? (
                <Paragraph margin={0} size="$2" color="$muted">
                  {p.summary}
                </Paragraph>
              ) : null}
              {p.generalObjective ? (
                <YStack gap="$1">
                  <SectionTitle>Objetivo general</SectionTitle>
                  <Text fontSize="$3">{p.generalObjective}</Text>
                </YStack>
              ) : (
                <Text fontSize="$2" color="$warning">
                  Sin objetivo general definido
                </Text>
              )}
              {p.specificObjectives?.length ? (
                <YStack gap="$1">
                  <SectionTitle>Objetivos específicos</SectionTitle>
                  {p.specificObjectives.map((o, i) => (
                    <XStack key={`${i}-${o.text}`} gap="$2" alignItems="flex-start">
                      <input
                        type="checkbox"
                        checked={o.done}
                        disabled={saving === p.id}
                        aria-label={o.text}
                        style={{ width: 16, height: 16, marginTop: 3 }}
                        onChange={() =>
                          void save(p, {
                            specificObjectives: (p.specificObjectives ?? []).map((x, j) => (j === i ? { ...x, done: !x.done } : x)),
                          })
                        }
                      />
                      <Text flex={1} fontSize="$3" color={o.done ? '$muted' : '$color'} textDecorationLine={o.done ? 'line-through' : 'none'}>
                        {o.text}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              ) : null}
              {(() => {
                const pr = projectProgress({ progress: p.progress, specificObjectives: p.specificObjectives });
                return pr ? (
                  <YStack gap="$1">
                    <Text fontSize="$2" color="$muted">
                      Avance {pr.value} %{pr.source === 'objectives' ? ' (por objetivos cumplidos)' : ''}
                    </Text>
                    <ProgressBar value={pr.value} color={p.color} />
                  </YStack>
                ) : (
                  <Text fontSize="$2" color="$muted">
                    Avance sin estimar
                  </Text>
                );
              })()}
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
              <XStack gap="$1" flexWrap="wrap" alignItems="center">
                {(p.tags ?? []).map((t) => (
                  <XStack key={t} alignItems="center" gap={2}>
                    <Pill>#{t}</Pill>
                    <AppButton
                      variant="ghost"
                      size="$1"
                      aria-label={`Quitar etiqueta ${t}`}
                      disabled={saving === p.id}
                      onPress={() => void save(p, { tags: (p.tags ?? []).filter((x) => x !== t) })}
                    >
                      ×
                    </AppButton>
                  </XStack>
                ))}
                <input
                  value={tagDraft[p.id] ?? ''}
                  placeholder="+ etiqueta"
                  maxLength={40}
                  disabled={saving === p.id}
                  onChange={(e) => setTagDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTag(p);
                  }}
                  aria-label={`Nueva etiqueta para ${p.title}`}
                  style={{ width: 110, padding: '2px 6px', fontSize: 12, border: '1px dashed currentColor', borderRadius: 999, background: 'transparent', color: 'inherit', opacity: 0.7 }}
                />
              </XStack>
            </StripeCard>
            </YStack>
          );
        })}
        </XStack>
      )}
    </YStack>
  );
}
