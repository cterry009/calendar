import { projectProgress, projectsNeedingAttention } from '@calendar/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { patterns } from './patterns.js';
import {
  AREAS,
  dayKey,
  findProject,
  hhmm,
  localTime,
  projectChange,
  sendChange,
  snapshot,
  taskChange,
  toIso,
  weekday,
  type Project,
  type Snapshot,
} from './data.js';

// projects-and-claude-bridge 5.3-5.4: what a Claude chat (any Claude Project) can read and change in
// the calendar. Spanish names as in the app. One record per write; every change goes through
// /sync/batch, so it shows in the apps at once and can be undone there.

const text = (s: string) => ({ content: [{ type: 'text' as const, text: s }] });
const json = (summary: string, data: unknown) => text(`${summary}\n\n${JSON.stringify(data, null, 1)}`);

function attentionMap(snap: Snapshot) {
  const projects = snap.projects ?? [];
  const log = (snap.projectLogEntries ?? []).map((l) => ({ ...l, date: l.date.slice(0, 10) }));
  return new Map(projectsNeedingAttention(projects, log, dayKey()).map((a) => [a.projectId, a.reason]));
}

function brief(p: Project, reason?: string) {
  const pr = projectProgress({ progress: p.progress, specificObjectives: p.specificObjectives });
  return {
    id: p.id,
    titulo: p.title,
    area: AREAS[p.area ?? ''] ?? p.area,
    estado: p.status,
    prioridad: p.priority,
    avance: pr ? `${pr.value} %${pr.source === 'objectives' ? ' (por objetivos)' : ''}` : 'sin estimar',
    etiquetas: p.tags ?? [],
    atencion: reason ?? null,
  };
}

const openTasks = (snap: Snapshot) => snap.tasks.filter((t) => !t.deletedAt && t.status !== 'COMPLETED');

export function registerTools(server: McpServer): void {
  server.registerTool(
    'hoy',
    {
      title: 'Hoy',
      description: 'El día de hoy en el calendario: bloques del horario, tareas para hoy, tareas de prioridad alta sin fecha y proyectos que piden atención.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const snap = await snapshot();
      const today = dayKey();
      const wd = weekday();
      const blocks = snap.schedules
        .filter((s) => s.enabled && s.daysOfWeek.includes(wd))
        .sort((a, b) => a.startMinute - b.startMinute)
        .map((s) => `${hhmm(s.startMinute)}–${hhmm(s.endMinute)} ${s.label ?? (s.kind === 'WORK' ? 'Trabajo' : 'Descanso')}`);
      const open = openTasks(snap);
      const forToday = open
        .filter((t) => t.scheduledAt && dayKey(new Date(t.scheduledAt)) <= today)
        .map((t) => ({ id: t.id, titulo: t.title, hora: localTime(t.scheduledAt!), prioridad: t.priority }));
      const high = open.filter((t) => !t.scheduledAt && t.priority === 'HIGH').map((t) => ({ id: t.id, titulo: t.title }));
      const att = attentionMap(snap);
      const attention = (snap.projects ?? []).filter((p) => att.has(p.id)).map((p) => `${p.title}: ${att.get(p.id)}`);
      return json(
        `Hoy ${today}: ${blocks.length} bloques, ${forToday.length} tareas para hoy, ${attention.length} proyectos piden atención.`,
        { bloques: blocks, tareas_hoy: forToday, prioridad_alta_sin_fecha: high, proyectos_atencion: attention },
      );
    },
  );

  server.registerTool(
    'habitos',
    {
      title: 'Hábitos de hoy',
      description: 'Los hábitos activos con su meta y lo registrado hoy (o el día indicado).',
      inputSchema: { fecha: z.string().optional().describe('YYYY-MM-DD; por defecto hoy.') },
      annotations: { readOnlyHint: true },
    },
    async ({ fecha }) => {
      const snap = await snapshot();
      const day = fecha ?? dayKey();
      const list = (snap.habits ?? [])
        .filter((h) => !h.archived)
        .map((h) => {
          const r = (snap.habitRecords ?? []).find((x) => x.habitId === h.id && x.date.slice(0, 10) === day);
          return { id: h.id, habito: h.title, meta: `${h.dailyGoalValue} ${h.dailyGoalUnit}`, tipo: h.type, hoy: r?.value ?? 0 };
        });
      return json(`Hábitos (${day}):`, list);
    },
  );

  server.registerTool(
    'registrar_habito',
    {
      title: 'Registrar hábito',
      description: 'Registra el valor de un hábito en un día (por defecto hoy; valor por defecto = su meta). Acepta el id o parte del nombre. Sustituye lo registrado ese día.',
      inputSchema: {
        habito: z.string(),
        valor: z.number().min(0).optional(),
        fecha: z.string().optional().describe('YYYY-MM-DD; por defecto hoy.'),
      },
    },
    async ({ habito, valor, fecha }) => {
      const snap = await snapshot();
      const habits = (snap.habits ?? []).filter((h) => !h.archived);
      const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const hits = habits.filter((h) => h.id === habito || fold(h.title).includes(fold(habito)));
      if (!hits.length) return text(`No hay un hábito que coincida con "${habito}". Usa habitos para ver los nombres.`);
      const h = hits[0];
      const day = fecha ?? dayKey();
      const existing = (snap.habitRecords ?? []).find((x) => x.habitId === h.id && x.date.slice(0, 10) === day);
      const result = await sendChange('habitRecords', {
        ...(existing ? { id: existing.id } : { clientId: crypto.randomUUID() }),
        updatedAt: new Date().toISOString(),
        habitId: h.id,
        date: day,
        value: valor ?? h.dailyGoalValue,
        status: 'DONE',
      });
      const note = hits.length > 1 ? ` (había ${hits.length} con ese nombre; usé el primero)` : '';
      return text(`"${h.title}" = ${valor ?? h.dailyGoalValue} el ${day}${note}: ${result}`);
    },
  );

  server.registerTool(
    'patrones',
    {
      title: 'Patrones de trabajo',
      description:
        'Cómo trabaja Cristo según el calendario (no según el chat): minutos y mejores horas de foco, duración típica de sesión, bloques hechos/saltados/sin marcar por categoría y sus razones, tareas completadas y vencidas, ejercicios del tutor y tiempo de juego. Para ajustar cuándo y cuánto proponer.',
      inputSchema: { dias: z.number().int().min(7).max(90).optional().describe('Ventana en días, por defecto 28.') },
      annotations: { readOnlyHint: true },
    },
    async ({ dias }) => json(`Patrones de los últimos ${dias ?? 28} días:`, patterns(await snapshot(), dias ?? 28)),
  );

  server.registerTool(
    'semana',
    {
      title: 'Próximos 7 días',
      description: 'Tareas con fecha y fechas límite de proyectos en los próximos 7 días.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const snap = await snapshot();
      const days: Record<string, string[]> = {};
      for (let i = 0; i <= 7; i++) days[dayKey(new Date(Date.now() + i * 86_400_000))] = [];
      for (const t of openTasks(snap)) {
        const k = t.scheduledAt ? dayKey(new Date(t.scheduledAt)) : null;
        if (k && k in days) days[k].push(`${localTime(t.scheduledAt!)} ${t.title}`);
      }
      for (const p of snap.projects ?? []) {
        const k = p.deadline?.slice(0, 10);
        if (k && k in days && p.status !== 'DONE') days[k].push(`Fecha límite: ${p.title}`);
      }
      return json('Próximos 7 días:', days);
    },
  );

  server.registerTool(
    'proyectos',
    {
      title: 'Proyectos',
      description: `Lista los proyectos con área, estado, avance, etiquetas y si piden atención. Áreas: ${Object.keys(AREAS).join(', ')}.`,
      inputSchema: {
        area: z.string().optional().describe('Filtra por área (clave, p. ej. academico-maestria).'),
        incluir_terminados: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ area, incluir_terminados }) => {
      const snap = await snapshot();
      const att = attentionMap(snap);
      const list = (snap.projects ?? [])
        .filter((p) => (incluir_terminados ? true : p.status !== 'DONE'))
        .filter((p) => !area || p.area === area)
        .map((p) => brief(p, att.get(p.id)));
      return json(`${list.length} proyectos.`, list);
    },
  );

  server.registerTool(
    'proyecto',
    {
      title: 'Proyecto',
      description: 'Todo de un proyecto: objetivo general, objetivos específicos, etiquetas, próximos pasos, bitácora reciente y tareas vinculadas. Acepta el id o parte del nombre.',
      inputSchema: { proyecto: z.string().describe('Id o parte del nombre, p. ej. "maestría" o "paper".') },
      annotations: { readOnlyHint: true },
    },
    async ({ proyecto }) => {
      const snap = await snapshot();
      const p = findProject(snap.projects ?? [], proyecto);
      const att = attentionMap(snap);
      const log = (snap.projectLogEntries ?? [])
        .filter((l) => l.projectId === p.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10)
        .map((l) => `${l.date.slice(0, 10)} (${l.source === 'CLAUDE' ? 'Claude' : 'app'}): ${l.text}`);
      const tasks = openTasks(snap)
        .filter((t) => t.projectId === p.id)
        .map((t) => ({ id: t.id, titulo: t.title, fecha: t.scheduledAt ? dayKey(new Date(t.scheduledAt)) : null }));
      return json(`${p.title}`, {
        ...brief(p, att.get(p.id)),
        resumen: p.summary,
        objetivo_general: p.generalObjective ?? null,
        objetivos_especificos: (p.specificObjectives ?? []).map((o, i) => `${i + 1}. [${o.done ? 'x' : ' '}] ${o.text}`),
        proximos_pasos: p.nextSteps,
        bloqueo: p.blocker,
        fecha_limite: p.deadline?.slice(0, 10) ?? null,
        carpeta: p.localPath ?? null,
        archivos_y_enlaces: p.links ?? [],
        bitacora_reciente: log,
        tareas_abiertas: tasks,
      });
    },
  );

  server.registerTool(
    'tareas',
    {
      title: 'Tareas',
      description: 'Tareas abiertas, opcionalmente de un proyecto.',
      inputSchema: { proyecto: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ proyecto }) => {
      const snap = await snapshot();
      const pid = proyecto ? findProject(snap.projects ?? [], proyecto).id : null;
      const list = openTasks(snap)
        .filter((t) => !pid || t.projectId === pid)
        .map((t) => ({ id: t.id, titulo: t.title, fecha: t.scheduledAt ? `${dayKey(new Date(t.scheduledAt))} ${localTime(t.scheduledAt)}` : null, prioridad: t.priority }));
      return json(`${list.length} tareas abiertas.`, list);
    },
  );

  server.registerTool(
    'crear_tarea',
    {
      title: 'Crear tarea',
      description: 'Crea una tarea en el calendario (aparece en todos los dispositivos). Úsala para fechas de cierre, entregas y pasos concretos.',
      inputSchema: {
        titulo: z.string().min(1).max(200),
        fecha: z.string().optional().describe('YYYY-MM-DD o YYYY-MM-DDTHH:mm en hora de Bogotá. Sin fecha queda en la lista.'),
        minutos: z.number().int().min(5).max(600).optional().describe('Estimación, por defecto 25.'),
        prioridad: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
        proyecto: z.string().optional().describe('Id o nombre del proyecto al que se vincula.'),
        descripcion: z.string().max(2000).optional(),
      },
    },
    async ({ titulo, fecha, minutos, prioridad, proyecto, descripcion }) => {
      const snap = await snapshot();
      const projectId = proyecto ? findProject(snap.projects ?? [], proyecto).id : undefined;
      const result = await sendChange('tasks', {
        clientId: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        title: titulo,
        description: descripcion,
        scheduledAt: fecha ? toIso(fecha) : undefined,
        estimatedMinutes: minutos ?? 25,
        difficulty: 'MEDIUM',
        complexity: 5,
        priority: prioridad ?? 'MEDIUM',
        status: 'PENDING',
        projectId,
      });
      return text(`Tarea "${titulo}": ${result}`);
    },
  );

  server.registerTool(
    'completar_tarea',
    {
      title: 'Completar tarea',
      description: 'Marca una tarea como hecha (por id; búscalo con tareas).',
      inputSchema: { id: z.string(), minutos_reales: z.number().int().min(0).optional() },
    },
    async ({ id, minutos_reales }) => {
      const snap = await snapshot();
      const t = snap.tasks.find((x) => x.id === id);
      if (!t) return text(`No hay una tarea con id ${id}.`);
      const result = await sendChange(
        'tasks',
        taskChange(t, { status: 'COMPLETED', completedAt: new Date().toISOString(), actualMinutes: minutos_reales ?? t.estimatedMinutes }),
      );
      return text(`"${t.title}" completada: ${result}`);
    },
  );

  server.registerTool(
    'registrar_avance',
    {
      title: 'Registrar avance',
      description: 'Agrega una entrada a la bitácora de un proyecto (queda marcada como escrita por Claude). Úsala al final de una sesión de trabajo o cuando un radar encuentre algo.',
      inputSchema: {
        proyecto: z.string(),
        texto: z.string().min(1).max(5000),
        fecha: z.string().optional().describe('YYYY-MM-DD; por defecto hoy.'),
      },
    },
    async ({ proyecto, texto, fecha }) => {
      const snap = await snapshot();
      const p = findProject(snap.projects ?? [], proyecto);
      const result = await sendChange('projectLogEntries', {
        clientId: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        projectId: p.id,
        date: fecha ?? dayKey(),
        text: texto,
        source: 'CLAUDE',
      });
      return text(`Avance en "${p.title}": ${result}`);
    },
  );

  server.registerTool(
    'crear_proyecto',
    {
      title: 'Crear proyecto',
      description: `Crea un proyecto en la app. Áreas: ${Object.entries(AREAS).map(([k, v]) => `${k} (${v})`).join(', ')}.`,
      inputSchema: {
        titulo: z.string().min(1).max(200),
        area: z.enum(Object.keys(AREAS) as [string, ...string[]]),
        objetivo_general: z.string().max(500).optional(),
        objetivos_especificos: z.array(z.string().min(1).max(300)).max(30).optional(),
        etiquetas: z.array(z.string().min(1).max(40)).max(12).optional(),
        prioridad: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        estado: z.enum(['ACTIVE', 'PAUSED', 'BLOCKED', 'IDEA', 'DONE']).optional(),
        resumen: z.string().max(500).optional(),
      },
    },
    async (a) => {
      const result = await sendChange('projects', {
        clientId: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        title: a.titulo,
        summary: a.resumen ?? null,
        status: a.estado ?? 'ACTIVE',
        priority: a.prioridad ?? 'MEDIUM',
        area: a.area,
        generalObjective: a.objetivo_general ?? null,
        specificObjectives: (a.objetivos_especificos ?? []).map((t) => ({ text: t, done: false })),
        tags: a.etiquetas ?? [],
        nextSteps: [],
      });
      return text(`Proyecto "${a.titulo}": ${result}`);
    },
  );

  server.registerTool(
    'actualizar_proyecto',
    {
      title: 'Actualizar proyecto',
      description: 'Cambia campos de un proyecto: estado, prioridad, avance, objetivo general, marcar u agregar objetivos específicos, etiquetas, próximos pasos, bloqueo o fecha límite. Solo cambia lo que se pasa.',
      inputSchema: {
        proyecto: z.string(),
        estado: z.enum(['ACTIVE', 'PAUSED', 'BLOCKED', 'IDEA', 'DONE']).optional(),
        prioridad: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
        avance: z.number().int().min(0).max(100).nullable().optional().describe('null = calcularlo por objetivos.'),
        objetivo_general: z.string().max(500).optional(),
        marcar_objetivos: z.array(z.number().int().min(1)).optional().describe('Números (1, 2, …) de los objetivos específicos a marcar como hechos.'),
        desmarcar_objetivos: z.array(z.number().int().min(1)).optional(),
        agregar_objetivos: z.array(z.string().min(1).max(300)).optional(),
        agregar_etiquetas: z.array(z.string().min(1).max(40)).optional(),
        quitar_etiquetas: z.array(z.string()).optional(),
        proximos_pasos: z.array(z.string().min(1).max(300)).max(30).optional().describe('Reemplaza la lista completa.'),
        bloqueo: z.string().max(500).nullable().optional(),
        fecha_limite: z.string().nullable().optional().describe('YYYY-MM-DD o null.'),
      },
    },
    async (a) => {
      const snap = await snapshot();
      const p = findProject(snap.projects ?? [], a.proyecto);
      let objs = [...(p.specificObjectives ?? [])];
      for (const n of a.marcar_objetivos ?? []) if (objs[n - 1]) objs[n - 1] = { ...objs[n - 1], done: true };
      for (const n of a.desmarcar_objetivos ?? []) if (objs[n - 1]) objs[n - 1] = { ...objs[n - 1], done: false };
      objs = [...objs, ...(a.agregar_objetivos ?? []).map((t) => ({ text: t, done: false }))].slice(0, 30);
      const quitar = new Set(a.quitar_etiquetas ?? []);
      const tags = [...new Set([...(p.tags ?? []).filter((t) => !quitar.has(t)), ...(a.agregar_etiquetas ?? [])])].slice(0, 12);
      const patch: Partial<Project> = { specificObjectives: objs, tags };
      if (a.estado) patch.status = a.estado;
      if (a.prioridad) patch.priority = a.prioridad;
      if (a.avance !== undefined) patch.progress = a.avance;
      if (a.objetivo_general !== undefined) patch.generalObjective = a.objetivo_general;
      if (a.proximos_pasos) patch.nextSteps = a.proximos_pasos;
      if (a.bloqueo !== undefined) patch.blocker = a.bloqueo;
      if (a.fecha_limite !== undefined) patch.deadline = a.fecha_limite;
      const result = await sendChange('projects', projectChange(p, patch));
      return text(`"${p.title}" actualizado: ${result}`);
    },
  );
}
