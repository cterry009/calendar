import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { localDateKey, projectProgress, projectsNeedingAttention } from '@calendar/shared';
import { AppButton, H1, Paragraph, Text, XStack, YStack } from '@calendar/ui';
import { ProjectChat } from '../components/agenda/ProjectChat';
import { ProjectsRail } from '../components/agenda/ProjectsRail';
import { Pill, ProgressBar, SectionTitle } from '../components/agenda/parts';
import { usePanel } from '../context/PanelContext';
import { useCalendarData } from '../hooks/useCalendarData';
import { useNativeFieldStyle } from '../hooks/useNativeFieldStyle';
import { useToday } from '../hooks/useNow';
import type { SyncProject } from '../lib/calendar/types';
import { openInVsCode, openLink } from '../lib/desktop/launch';
import { areaLabel, projectArea } from '../lib/projects/areas';
import { PRIORITY_LABEL } from '../lib/projects/order';
import { addLogEntry, saveProject } from '../lib/projects/sync';

// 2026-11-10: one project's page -- its description and objectives, where it stands (progress, next
// steps, log, tasks) and what to do from here: the tutor for a study project, its folder in VS Code,
// its files and links. The projects rail stays on the right.

const STATUS_LABEL: Record<SyncProject['status'], string> = { ACTIVE: 'Activo', PAUSED: 'Pausado', BLOCKED: 'Bloqueado', IDEA: 'Idea', DONE: 'Completado' };

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <YStack backgroundColor="$surface" borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$4" gap="$3">
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <SectionTitle>{title}</SectionTitle>
        {action}
      </XStack>
      {children}
    </YStack>
  );
}

export function ProyectoPage() {
  const { id } = useParams<{ id: string }>();
  const data = useCalendarData();
  const today = useToday();
  const navigate = useNavigate();
  const { openPanel } = usePanel();
  const field = useNativeFieldStyle();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [pathDraft, setPathDraft] = useState<string | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkPath, setLinkPath] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const p = data.projects.find((x) => x.id === id) ?? null;
  const attention = useMemo(
    () =>
      projectsNeedingAttention(data.projects, data.projectLogEntries.map((l) => ({ ...l, date: l.date.slice(0, 10) })), localDateKey(today)).find(
        (a) => a.projectId === id,
      ),
    [data.projects, data.projectLogEntries, today, id],
  );
  const log = data.projectLogEntries.filter((l) => l.projectId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);
  const tasks = data.tasks.filter((t) => !t.deletedAt && t.status !== 'COMPLETED' && (t as { projectId?: string | null }).projectId === id);

  if (!p) {
    return (
      <YStack padding="$6" gap="$3">
        <Paragraph color="$muted">{data.isLoading ? 'Cargando…' : 'Ese proyecto no existe o fue borrado.'}</Paragraph>
        <AppButton variant="ghost" alignSelf="flex-start" onPress={() => navigate('/proyectos')}>
          ← Proyectos
        </AppButton>
      </YStack>
    );
  }
  const project = p;

  async function save(patch: Partial<SyncProject>) {
    setBusy(true);
    try {
      await saveProject(project, patch);
      await data.refetch();
    } finally {
      setBusy(false);
    }
  }

  const pr = projectProgress({ progress: project.progress, specificObjectives: project.specificObjectives });
  const area = projectArea(project.area);
  const isStudy = area === 'academico-estudio';
  // Study: the tutor's attempts on the notes named in the tags (e.g. 00b, AN1); all of them otherwise.
  const noteTags = new Set((project.tags ?? []).map((t) => t.toLowerCase()));
  const attempts = isStudy ? data.exerciseAttempts.filter((a) => noteTags.has(a.noteCode.toLowerCase())) : [];
  const studyAttempts = isStudy && attempts.length === 0 ? data.exerciseAttempts : attempts;
  const sessions = new Set(studyAttempts.map((a) => a.occurredAt.slice(0, 10))).size;
  const solved = studyAttempts.filter((a) => a.r === 1).length;

  return (
    <XStack flex={1} minHeight="100vh" backgroundColor="$background" padding="$5" gap="$5" flexWrap="wrap" alignItems="flex-start" style={{ width: '100%', maxWidth: 1800, margin: '0 auto', boxSizing: 'border-box' }}>
      <YStack flexGrow={1} flexShrink={1} flexBasis={560} minWidth={0} gap="$4">
        <AppButton variant="ghost" size="$3" alignSelf="flex-start" onPress={() => navigate('/proyectos')}>
          ← Proyectos
        </AppButton>
        <YStack gap="$2" borderLeftWidth={5} borderLeftColor={project.color ?? '$accent'} paddingLeft="$4">
          <H1 margin={0} fontFamily="$heading" fontSize="$9" fontWeight="500">
            {project.title}
          </H1>
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <Pill>{areaLabel(project.area)}</Pill>
            {(project.tags ?? []).map((t) => (
              <Pill key={t}>#{t}</Pill>
            ))}
            {attention ? <Pill tone={attention.kind === 'stale' ? 'warning' : 'danger'}>{attention.reason}</Pill> : null}
          </XStack>
          <XStack gap="$3" flexWrap="wrap" alignItems="center">
            <label>
              <Text fontSize="$2" color="$muted">Prioridad </Text>
              <select value={project.priority} disabled={busy} onChange={(e) => void save({ priority: e.target.value as SyncProject['priority'] })} style={{ ...field, padding: '2px 6px', borderRadius: 6 }}>
                {(['HIGH', 'MEDIUM', 'LOW'] as const).map((k) => (
                  <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>
                ))}
              </select>
            </label>
            <label>
              <Text fontSize="$2" color="$muted">Estado </Text>
              <select value={project.status} disabled={busy} onChange={(e) => void save({ status: e.target.value as SyncProject['status'] })} style={{ ...field, padding: '2px 6px', borderRadius: 6 }}>
                {(Object.keys(STATUS_LABEL) as SyncProject['status'][]).map((k) => (
                  <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                ))}
              </select>
            </label>
            {project.deadline ? <Text fontSize="$2" color="$muted">Fecha límite: {project.deadline.slice(0, 10)}</Text> : null}
          </XStack>
        </YStack>

        <Card title="Descripción y objetivo general">
          {project.summary ? <Paragraph margin={0}>{project.summary}</Paragraph> : null}
          {project.generalObjective ? (
            <Paragraph margin={0} fontWeight="600">{project.generalObjective}</Paragraph>
          ) : (
            <Text color="$warning" fontSize="$2">Sin objetivo general definido.</Text>
          )}
          {project.blocker ? <Text color="$danger">Bloqueo: {project.blocker}</Text> : null}
        </Card>

        <Card title="Objetivos específicos">
          {(project.specificObjectives ?? []).map((o, i) => (
            <XStack key={`${i}-${o.text}`} gap="$2" alignItems="flex-start">
              <input
                type="checkbox"
                checked={o.done}
                disabled={busy}
                aria-label={o.text}
                style={{ width: 18, height: 18, marginTop: 2 }}
                onChange={() => void save({ specificObjectives: (project.specificObjectives ?? []).map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
              />
              <Text flex={1} color={o.done ? '$muted' : '$color'} textDecorationLine={o.done ? 'line-through' : 'none'}>
                {o.text}
              </Text>
            </XStack>
          ))}
          <XStack gap="$2">
            <input
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              placeholder="Nuevo objetivo específico"
              maxLength={300}
              style={{ ...field, flex: 1, padding: '6px 8px', borderRadius: 6 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newObjective.trim()) {
                  void save({ specificObjectives: [...(project.specificObjectives ?? []), { text: newObjective.trim(), done: false }] });
                  setNewObjective('');
                }
              }}
            />
          </XStack>
          <YStack gap="$1">
            <Text fontSize="$2" color="$muted">
              {pr ? `Avance ${pr.value} %${pr.source === 'objectives' ? ' (por objetivos cumplidos)' : ''}` : 'Avance sin estimar'}
            </Text>
            <ProgressBar value={pr?.value ?? 0} color={project.color} />
          </YStack>
        </Card>

        <Card title="Dónde vamos">
          {project.nextSteps.length ? (
            <YStack gap="$1">
              <Text fontWeight="600">Próximos pasos</Text>
              {project.nextSteps.map((s) => (
                <Text key={s}>• {s}</Text>
              ))}
            </YStack>
          ) : null}
          {tasks.length ? (
            <YStack gap="$1">
              <Text fontWeight="600">Tareas abiertas</Text>
              {tasks.map((t) => (
                <Text key={t.id}>
                  • {t.title}
                  {t.scheduledAt ? ` · ${t.scheduledAt.slice(0, 10)}` : ''}
                </Text>
              ))}
            </YStack>
          ) : null}
          <YStack gap="$1">
            <Text fontWeight="600">Bitácora</Text>
            <XStack gap="$2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Registrar un avance (Enter)"
                maxLength={5000}
                style={{ ...field, flex: 1, padding: '6px 8px', borderRadius: 6 }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && note.trim()) {
                    setBusy(true);
                    try {
                      await addLogEntry(project.id, note.trim(), localDateKey(today));
                      setNote('');
                      await data.refetch();
                    } finally {
                      setBusy(false);
                    }
                  }
                }}
              />
            </XStack>
            {log.length === 0 ? <Text color="$muted" fontSize="$2">Sin avances registrados.</Text> : null}
            {log.map((l) => (
              <XStack key={l.id} gap="$2">
                <Text fontSize="$2" color="$muted" width={90}>
                  {l.date.slice(0, 10)}
                </Text>
                <Text flex={1} fontSize="$3">
                  {l.text}
                  {l.source === 'CLAUDE' ? <Text color="$accent"> · Claude</Text> : null}
                </Text>
              </XStack>
            ))}
          </YStack>
        </Card>

        {isStudy ? (
          <Card
            title="Estudio con el tutor"
            action={
              <AppButton variant="primary" size="$3" onPress={() => openPanel('pomodoro')}>
                Iniciar tutor
              </AppButton>
            }
          >
            <XStack gap="$5" flexWrap="wrap">
              <Text><Text fontWeight="800" fontSize="$7">{sessions}</Text> días de sesión</Text>
              <Text><Text fontWeight="800" fontSize="$7">{studyAttempts.length}</Text> ejercicios</Text>
              <Text><Text fontWeight="800" fontSize="$7">{solved}</Text> resueltos solos</Text>
            </XStack>
            <Text fontSize="$2" color="$muted">
              {attempts.length ? 'Cuenta los ejercicios de las notas en las etiquetas del proyecto.' : 'Agrega como etiqueta el código de sus notas (p. ej. 00b, AN1) para contar solo las de este proyecto.'}
            </Text>
          </Card>
        ) : null}

        <Card
          title="Carpeta del proyecto"
          action={
            project.localPath ? (
              <XStack gap="$2">
                <AppButton variant="primary" size="$3" onPress={async () => setMessage(await openInVsCode(project.localPath!))}>
                  Abrir en VS Code
                </AppButton>
                <AppButton variant="ghost" size="$3" onPress={async () => setMessage(await openLink(project.localPath!, project.title))}>
                  Abrir carpeta
                </AppButton>
              </XStack>
            ) : null
          }
        >
          <XStack gap="$2">
            <input
              value={pathDraft ?? project.localPath ?? ''}
              onChange={(e) => setPathDraft(e.target.value)}
              placeholder="C:\Users\cterr\Proyectos\…"
              style={{ ...field, flex: 1, padding: '6px 8px', borderRadius: 6, fontFamily: 'IBM Plex Mono, monospace' }}
            />
            {pathDraft !== null && pathDraft !== (project.localPath ?? '') ? (
              <AppButton
                size="$3"
                disabled={busy}
                onPress={async () => {
                  await save({ localPath: pathDraft.trim() || null });
                  setPathDraft(null);
                }}
              >
                Guardar
              </AppButton>
            ) : null}
          </XStack>
        </Card>

        <Card title="Archivos y enlaces">
          {(project.links ?? []).map((l, i) => (
            <XStack key={`${i}-${l.path}`} gap="$2" alignItems="center">
              <AppButton variant="ghost" size="$3" onPress={async () => setMessage(await openLink(l.path, l.label))}>
                {l.label}
              </AppButton>
              <Text flex={1} fontSize="$1" color="$muted" numberOfLines={1}>
                {l.path}
              </Text>
              <AppButton variant="ghost" size="$2" aria-label={`Quitar ${l.label}`} disabled={busy} onPress={() => void save({ links: (project.links ?? []).filter((_, j) => j !== i) })}>
                ×
              </AppButton>
            </XStack>
          ))}
          <XStack gap="$2" flexWrap="wrap">
            <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Nombre" maxLength={120} style={{ ...field, width: 160, padding: '6px 8px', borderRadius: 6 }} />
            <input value={linkPath} onChange={(e) => setLinkPath(e.target.value)} placeholder="Ruta del archivo o URL" maxLength={1000} style={{ ...field, flex: 1, minWidth: 200, padding: '6px 8px', borderRadius: 6 }} />
            <AppButton
              size="$3"
              disabled={busy || !linkLabel.trim() || !linkPath.trim()}
              onPress={async () => {
                await save({ links: [...(project.links ?? []), { label: linkLabel.trim(), path: linkPath.trim() }] });
                setLinkLabel('');
                setLinkPath('');
              }}
            >
              Agregar
            </AppButton>
          </XStack>
        </Card>
        {message ? <Text color="$warning">{message}</Text> : null}

        <Card title="Chat del proyecto (Claude)">
          <ProjectChat projectId={project.id} onSaved={() => void data.refetch()} />
        </Card>
      </YStack>
      <ProjectsRail currentId={project.id} />
    </XStack>
  );
}
