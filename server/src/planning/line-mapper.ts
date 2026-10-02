import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { shortError } from './gemini-errors';
import type { Generate } from './gemini-planner';
import type { PlanningContext } from './planning.types';

// The fallback when no model can produce a whole plan (the free tier's Flash models are often all
// busy, and Flash-Lite answers an empty plan): ask only the one question the heuristic can't answer
// -- which WORK block each study line belongs in, by the user's rules -- and let the heuristic pack
// the blocks with that map. A small question even Flash-Lite gets right.

/** Study line id -> the WORK schedules its sessions may go in. */
export type LineBlocks = Map<string, Set<string>>;

const SCHEMA = {
  type: 'object',
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { linea: { type: 'string' }, bloques: { type: 'array', items: { type: 'string' } } },
        required: ['linea', 'bloques'],
      },
    },
  },
  required: ['lineas'],
};

export function lineMapRequest(ctx: PlanningContext, rules: string): { system: string; prompt: string; schema: unknown } {
  const lines = new Map<string, { category: string | null; examples: string[] }>();
  for (const t of ctx.tasks) {
    if (!t.line) continue;
    const entry = lines.get(t.line.id) ?? { category: t.category, examples: [] };
    if (entry.examples.length < 3) entry.examples.push(t.title);
    lines.set(t.line.id, entry);
  }
  const blocks = new Map<string, { label: string | null; days: number[]; start: number }>();
  for (const s of ctx.slots) {
    const b = blocks.get(s.scheduleId) ?? { label: s.label, days: [], start: s.startMinute };
    const day = new Date(`${s.date}T00:00:00Z`).getUTCDay();
    if (!b.days.includes(day)) b.days.push(day);
    blocks.set(s.scheduleId, b);
  }
  const system =
    'Eres el planificador de una app de calendario. Según las reglas del usuario (abajo), di en qué bloques de trabajo va cada línea de estudio. ' +
    'Una línea es un pensum; un bloque es un horario de trabajo con su título. Usa el título del bloque y el contenido de cada fase para decidir ' +
    '(por ejemplo, la línea principal va en "Estudio B1" y la paralela en "Estudio B2"). Una línea puede ir en varios bloques. ' +
    'Si una línea no corresponde a ningún bloque en la fase actual, devuélvela con la lista vacía. Copia los ids tal cual; no inventes.\n\n' +
    `# Reglas del usuario\n\n${rules}`;
  const prompt = JSON.stringify({
    lineas: [...lines].map(([id, l]) => ({ linea: id, materia: l.category, ejemplos: l.examples })),
    bloques: [...blocks].map(([id, b]) => ({ scheduleId: id, titulo: b.label, dias: b.days.sort(), inicio: `${Math.floor(b.start / 60)}:${String(b.start % 60).padStart(2, '0')}` })),
  });
  return { system, prompt, schema: SCHEMA };
}

export function parseLineMap(text: string, ctx: PlanningContext): LineBlocks {
  const body = JSON.parse(text) as { lineas?: Array<{ linea?: unknown; bloques?: unknown }> };
  if (!Array.isArray(body.lineas)) throw new Error('La respuesta no trae "lineas".');
  const knownLines = new Set(ctx.tasks.filter((t) => t.line).map((t) => t.line!.id));
  const knownBlocks = new Set(ctx.slots.map((s) => s.scheduleId));
  const map: LineBlocks = new Map();
  for (const entry of body.lineas) {
    if (typeof entry.linea !== 'string' || !knownLines.has(entry.linea) || !Array.isArray(entry.bloques)) continue;
    map.set(entry.linea, new Set(entry.bloques.filter((b): b is string => typeof b === 'string' && knownBlocks.has(b))));
  }
  if (![...map.values()].some((blocks) => blocks.size > 0)) throw new Error('El mapa de líneas a bloques vino vacío.');
  return map;
}

export async function mapLinesWithModel(
  ctx: PlanningContext,
  rules: string,
  generate: Generate,
  models: string[],
  failures: string[],
): Promise<{ map: LineBlocks; model: string }> {
  const request = lineMapRequest(ctx, rules);
  for (const model of models) {
    try {
      return { map: parseLineMap(await generate({ ...request, model }), ctx), model };
    } catch (error) {
      failures.push(`${model} (mapa de líneas) falló: ${shortError(error)}`);
    }
  }
  throw new Error(failures.join(' | ') || 'No hay modelos de Gemini configurados.');
}

/** Per WORK schedule, the lines it takes sessions from, in order: one is finished before the next. */
export type BlockSequence = Map<string, string[]>;

/**
 * The reference map written once from the user's rules (docs/planning/mapa-lineas.json), for when
 * Gemini answers nothing at all. Blocks are found by a piece of their title; each gets its lines in
 * phase order. Null when the file is missing or matches none of the context's blocks.
 */
export async function loadReferenceLineMap(dir: string, ctx: PlanningContext): Promise<{ map: LineBlocks; sequence: BlockSequence } | null> {
  let doc: { bloques?: Array<{ titulo_contiene?: string; lineas?: string[] }> };
  try {
    doc = JSON.parse(await readFile(join(dir, 'mapa-lineas.json'), 'utf8'));
  } catch {
    return null;
  }
  const map: LineBlocks = new Map();
  const sequence: BlockSequence = new Map();
  const schedules = new Map(ctx.slots.map((s) => [s.scheduleId, s.label ?? '']));
  for (const rule of doc.bloques ?? []) {
    const needle = rule.titulo_contiene?.toLowerCase();
    if (!needle || !Array.isArray(rule.lineas)) continue;
    for (const [scheduleId, label] of schedules) {
      if (!label.toLowerCase().includes(needle)) continue;
      sequence.set(scheduleId, rule.lineas);
      for (const line of rule.lineas) map.set(line, new Set([...(map.get(line) ?? []), scheduleId]));
    }
  }
  return sequence.size ? { map, sequence } : null;
}
