import { shortError } from './gemini-errors';
import type { Generate } from './gemini-planner';
import { exampleAnchors, isRating, type AttentionDocs } from './attention';

// Rates tasks the reference labels don't cover, by asking Gemini to apply the rubric with ~20
// anchors as examples (tried on 2026-10-01: 70% exact profile, 98% within one level). The model
// only classifies -- type, R, C and why; the profile comes from the fixed table, in the caller.

export interface TaskToRate {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
}

export interface ModelRating {
  taskId: string;
  tipo: string;
  reentry: number;
  load: number;
  reason: string;
}

const SCHEMA = {
  type: 'object',
  properties: {
    etiquetas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          tipo: { type: 'string' },
          R: { type: 'integer', minimum: 0, maximum: 3 },
          C: { type: 'integer', minimum: 0, maximum: 3 },
          porque: { type: 'string' },
        },
        required: ['id', 'tipo', 'R', 'C', 'porque'],
      },
    },
  },
  required: ['etiquetas'],
};

export function labelingRequest(docs: AttentionDocs, tasks: TaskToRate[]): { system: string; prompt: string; schema: unknown } {
  const examples = exampleAnchors(docs.anclas)
    .map((a) => `- "${a.titulo}" → tipo ${a.tipo}, R${a.R}, C${a.C}: ${a.porque}`)
    .join('\n');
  const system =
    'Etiquetas tareas según estas normas. Para cada tarea devuelve tipo, R y C (0-3) y una frase corta de por qué, en español. ' +
    `No calcules el perfil.\n\n${docs.normas}\n\n# Ejemplos ya etiquetados\n${examples}`;
  // Short numeric ids: the model copies them back, and they can't be confused with each other.
  const prompt =
    'Etiqueta estas tareas (de un estudiante de física):\n' +
    tasks
      .map((t, i) => {
        const extra = [t.category, t.description?.split('\n')[0]].filter(Boolean).join(' — ');
        return `${i}. ${t.title}${extra ? ` (${extra})` : ''}`;
      })
      .join('\n');
  return { system, prompt, schema: SCHEMA };
}

export function parseRatings(text: string, tasks: TaskToRate[]): ModelRating[] {
  const body = JSON.parse(text) as { etiquetas?: Array<Record<string, unknown>> };
  if (!Array.isArray(body.etiquetas)) throw new Error('La respuesta no trae "etiquetas".');
  const out: ModelRating[] = [];
  const seen = new Set<number>();
  for (const e of body.etiquetas) {
    const i = e.id;
    if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= tasks.length || seen.has(i as number)) continue;
    if (!isRating(e.R) || !isRating(e.C) || typeof e.tipo !== 'string' || typeof e.porque !== 'string') continue;
    seen.add(i as number);
    out.push({ taskId: tasks[i as number].id, tipo: e.tipo, reentry: e.R, load: e.C, reason: e.porque });
  }
  return out;
}

/** Ratings for as many tasks as the first model that answers can give; throws if none answers. */
export async function rateWithModel(
  docs: AttentionDocs,
  tasks: TaskToRate[],
  generate: Generate,
  models: string[],
  notes: string[],
): Promise<ModelRating[]> {
  if (tasks.length === 0) return [];
  const request = labelingRequest(docs, tasks);
  const failures: string[] = [];
  for (const model of models) {
    try {
      const ratings = parseRatings(await generate({ ...request, model }), tasks);
      notes.push(`Etiquetas hechas con ${model}.`, ...failures);
      return ratings;
    } catch (error) {
      failures.push(`${model} falló: ${shortError(error)}`);
    }
  }
  throw new Error(failures.join(' | ') || 'No hay modelos de Gemini configurados.');
}
