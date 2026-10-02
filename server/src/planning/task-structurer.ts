import { TaskDifficulty, TaskPriority, type AttentionProfile } from '@prisma/client';
import { attentionProfileFor, exampleAnchors, isRating, type AttentionDocs } from './attention';
import { shortError } from './gemini-errors';
import type { Generate } from './gemini-planner';

// "Structure this task" (task 8.13): the user types a loose idea ("repasar Darboux para el
// parcial") and Gemini turns it into a task the app can plan, using everything it knows -- the
// user's own rules (weekly template, phases, lines), the attention rubric with its anchors, the
// study lines already in progress, and the WORK blocks. Like every other model output here it is a
// proposal: the profile still comes from the fixed table, and nothing is saved unless asked.

export interface StructureContext {
  /** Prompt_app_calendario.md, or '' when it can't be read. */
  rules: string;
  docs: AttentionDocs;
  /** Study lines in progress: category and how many sessions are still pending. */
  lines: Array<{ category: string; pending: number }>;
  blocks: Array<{ scheduleId: string; label: string | null; days: number[]; start: string; end: string }>;
}

export interface StructuredTask {
  title: string;
  description: string;
  category: string | null;
  /** Number of sessions (one block each) it needs. */
  sessions: number;
  type: string;
  reentry: number;
  load: number;
  profile: AttentionProfile;
  reason: string;
  /** The WORK block it belongs in, by the user's rules; null for "any time". */
  scheduleId: string | null;
  priority: TaskPriority;
  difficulty: TaskDifficulty;
  /** What each pomodoro of a session is for, in order. */
  steps: string[];
}

const SCHEMA = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    descripcion: { type: 'string' },
    categoria: { type: ['string', 'null'] },
    sesiones: { type: 'integer', minimum: 1, maximum: 6 },
    tipo: { type: 'string' },
    R: { type: 'integer', minimum: 0, maximum: 3 },
    C: { type: 'integer', minimum: 0, maximum: 3 },
    porque: { type: 'string' },
    scheduleId: { type: ['string', 'null'] },
    prioridad: { type: 'string', enum: Object.values(TaskPriority) },
    dificultad: { type: 'string', enum: Object.values(TaskDifficulty) },
    pasos: { type: 'array', items: { type: 'string' } },
  },
  required: ['titulo', 'descripcion', 'categoria', 'sesiones', 'tipo', 'R', 'C', 'porque', 'scheduleId', 'prioridad', 'dificultad', 'pasos'],
};

const INSTRUCTIONS = `Eres el asistente de planificación de una app de calendario con pomodoros. El usuario escribe una tarea suelta y tú la conviertes en una tarea estructurada, usando todo lo que sabes de él: sus reglas (plantilla semanal, fases, líneas de estudio, reglas de ajuste), las normas de atención con sus ejemplos, las líneas de estudio que tiene en curso y sus bloques de trabajo.

Qué devolver:
- titulo: corto y concreto, al estilo de sus tareas ("AN2 · Teorema espectral" si es de una línea conocida).
- descripcion: qué hay que hacer y cuál es el resultado esperado, en 1-3 frases.
- categoria: la de una línea de estudio existente si la tarea pertenece a ella (cópiala tal cual), si no una corta o null.
- sesiones: cuántas sesiones de un bloque necesita (un bloque es 90 min, o 60 si es mecánica). Sé realista.
- tipo, R, C, porque: según las normas de atención (R y C de 0 a 3). No calcules el perfil.
- scheduleId: el bloque de trabajo que le corresponde según las reglas del usuario (copia el id), o null si puede ir en cualquiera.
- prioridad y dificultad: según las reglas de ajuste y el tipo de tarea.
- pasos: qué hacer en cada pomodoro de una sesión, en orden (como los "pomodoros sugeridos" de sus reglas).
No inventes líneas, bloques ni hechos que no estén en el contexto.`;

export function structureRequest(ctx: StructureContext, text: string): { system: string; prompt: string; schema: unknown } {
  const examples = exampleAnchors(ctx.docs.anclas)
    .map((a) => `- "${a.titulo}" → tipo ${a.tipo}, R${a.R}, C${a.C}: ${a.porque}`)
    .join('\n');
  const system = [
    INSTRUCTIONS,
    `# Reglas del usuario\n\n${ctx.rules || '(no disponibles)'}`,
    `# Normas de atención\n\n${ctx.docs.normas}`,
    `# Ejemplos de tareas ya calificadas\n${examples}`,
  ].join('\n\n');
  const prompt =
    `Líneas de estudio en curso: ${JSON.stringify(ctx.lines)}\n` +
    `Bloques de trabajo: ${JSON.stringify(ctx.blocks)}\n\n` +
    `Tarea que escribió el usuario: "${text}"`;
  return { system, prompt, schema: SCHEMA };
}

export function parseStructured(text: string, ctx: StructureContext): StructuredTask {
  const b = JSON.parse(text) as Record<string, unknown>;
  const str = (k: string) => {
    if (typeof b[k] !== 'string' || !(b[k] as string).trim()) throw new Error(`"${k}" vacío o inválido.`);
    return (b[k] as string).trim();
  };
  if (!isRating(b.R) || !isRating(b.C)) throw new Error('R o C fuera de 0-3.');
  const sessions = Number.isInteger(b.sesiones) ? Math.min(6, Math.max(1, b.sesiones as number)) : 1;
  const priority = Object.values(TaskPriority).includes(b.prioridad as TaskPriority) ? (b.prioridad as TaskPriority) : 'MEDIUM';
  const difficulty = Object.values(TaskDifficulty).includes(b.dificultad as TaskDifficulty) ? (b.dificultad as TaskDifficulty) : 'MEDIUM';
  // Only ids that exist; anything else becomes "any block".
  const scheduleId = ctx.blocks.some((x) => x.scheduleId === b.scheduleId) ? (b.scheduleId as string) : null;
  return {
    title: str('titulo'),
    description: str('descripcion'),
    category: typeof b.categoria === 'string' && b.categoria.trim() ? b.categoria.trim() : null,
    sessions,
    type: str('tipo'),
    reentry: b.R as number,
    load: b.C as number,
    profile: attentionProfileFor(b.R as number, b.C as number),
    reason: str('porque'),
    scheduleId,
    priority,
    difficulty,
    steps: Array.isArray(b.pasos) ? (b.pasos as unknown[]).filter((s): s is string => typeof s === 'string') : [],
  };
}

export async function structureWithModel(
  ctx: StructureContext,
  text: string,
  generate: Generate,
  models: string[],
  notes: string[],
): Promise<StructuredTask> {
  const request = structureRequest(ctx, text);
  const failures: string[] = [];
  for (const model of models) {
    try {
      const task = parseStructured(await generate({ ...request, model }), ctx);
      notes.push(`Estructurada con ${model}.`, ...failures);
      return task;
    } catch (error) {
      failures.push(`${model} falló: ${shortError(error)}`);
    }
  }
  throw new Error(failures.join(' | ') || 'No hay modelos de Gemini configurados.');
}
