import { readFile } from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import { TaskPriority } from '@prisma/client';
import type { PlanningConfig } from './planning.config';
import type { Assignment, PlanningContext } from './planning.types';
import { shortError } from './gemini-errors';
import { HeuristicPlanner } from './heuristic-planner';
import { loadReferenceLineMap, mapLinesWithModel } from './line-mapper';
import type { Planner } from './planner';

export { shortError };
import { dayOfWeek } from './slots';

// The LLM planner (task 8.13): Gemini reads the user's own planning rules (Prompt_app_calendario.md
// in the vault) plus the tasks and free blocks, and answers with JSON constrained by a schema. What
// it can do that the heuristic can't is match each study line to the block the rules give it
// (geometry to B1, analysis to B2, ...). Its answer is still only a proposal: validatePlan checks
// every assignment, and nothing is written until the user accepts in the app.

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const INSTRUCTIONS = `Eres el planificador de una app de calendario con pomodoros. Tu trabajo es decidir en qué día y en qué bloque de trabajo va cada tarea pendiente, siguiendo las reglas del usuario que van al final.

Cómo decidir:
1. Cada tarea de estudio pertenece a una línea (un pensum) y tiene un orden dentro de ella. Pon cada tarea en el bloque que las reglas del usuario le dan a su línea, según la fase y el contenido de los bloques (por ejemplo, la línea principal va en el bloque "Estudio B1" y la paralela en "Estudio B2"). Usa el título del bloque para reconocerlo. No pongas una línea en un bloque de otra categoría.
2. Dentro de una línea respeta el orden: una sesión nunca puede ir en una fecha anterior a la de una sesión con orden menor, y no saltes sesiones.
3. Capacidad: la suma de pomodoros de las tareas que pongas en un bloque, ese día, no puede pasar de sus pomodoros libres. No partas tareas. Si una tarea no cabe entera en ningún bloque que le corresponda, no la asignes.
4. Perfil de atención (MECHANICAL, LIGHT o DEEP; null si no está calificada) y complejidad (1-10): pon las tareas DEEP en los bloques de la mañana cuando las reglas lo permitan, y como mucho dos bloques DEEP por día. Las tareas MECHANICAL van de preferencia en la tarde: su bloque dura 60 minutos.
5. scheduleId null significa "ese día, sin bloque". Úsalo solo para tareas sueltas (sin línea) que no correspondan a ningún bloque.
6. Prioridad: conserva la de la tarea, salvo que una regla de ajuste del usuario diga otra cosa.
7. reason: una frase corta en español que diga por qué ese bloque y ese día, nombrando la regla que usaste.
8. No inventes bloques, fechas ni tareas. Usa solo los ids que te doy. Es mejor dejar una tarea sin asignar que asignarla mal.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          scheduleId: { type: ['string', 'null'] },
          priority: { type: 'string', enum: Object.values(TaskPriority) },
          reason: { type: 'string' },
        },
        required: ['taskId', 'date', 'scheduleId', 'priority', 'reason'],
      },
    },
  },
  required: ['assignments'],
};

export interface GenerateRequest {
  model: string;
  system: string;
  prompt: string;
  schema: unknown;
}
/** The one call the planner makes, so tests can stand in for Gemini. */
export type Generate = (req: GenerateRequest) => Promise<string>;

export function geminiGenerate(apiKey: string, timeoutMs = 180_000): Generate {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, system, prompt, schema }) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
    const text = res.text;
    if (!text) throw new Error(`Gemini no devolvió texto (finishReason: ${res.candidates?.[0]?.finishReason ?? 'desconocido'}).`);
    return text;
  };
}

/** What Gemini sees about the week: compact JSON, ids it must copy back verbatim. */
export function planningPrompt(ctx: PlanningContext): string {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const data = {
    dias: ctx.days,
    bloques: ctx.slots.map((s) => ({
      scheduleId: s.scheduleId,
      fecha: s.date,
      dia: WEEKDAYS[dayOfWeek(s.date)],
      titulo: s.label ?? 'Bloque de trabajo',
      horario: `${hhmm(s.startMinute)}-${hhmm(s.endMinute)}`,
      pomodorosLibres: s.capacity - s.used,
    })),
    tareas: ctx.tasks.map((t) => ({
      id: t.id,
      titulo: t.title,
      materia: t.category,
      linea: t.line?.id ?? null,
      orden: t.line?.order ?? null,
      pomodoros: t.pomodoros,
      prioridad: t.priority,
      complejidad: t.complexity,
      perfil: t.attentionProfile,
    })),
    yaEnElCalendario: ctx.scheduled
      .filter((t) => t.line && t.scheduledDate)
      .map((t) => ({ titulo: t.title, linea: t.line!.id, orden: t.line!.order, fecha: t.scheduledDate })),
  };
  return `Planifica estas tareas en estos bloques. Devuelve solo las asignaciones.\n\n${JSON.stringify(data)}`;
}

export function parseAssignments(text: string): Assignment[] {
  const body = JSON.parse(text) as { assignments?: unknown };
  if (!Array.isArray(body.assignments)) throw new Error('La respuesta de Gemini no trae "assignments".');
  return body.assignments.map((raw, i) => {
    const a = raw as Record<string, unknown>;
    const str = (k: string) => {
      if (typeof a[k] !== 'string') throw new Error(`Asignación ${i}: "${k}" no es texto.`);
      return a[k] as string;
    };
    if (a.scheduleId !== null && typeof a.scheduleId !== 'string') throw new Error(`Asignación ${i}: "scheduleId" inválido.`);
    return {
      taskId: str('taskId'),
      date: str('date'),
      scheduleId: (a.scheduleId as string | null) ?? null,
      priority: str('priority') as TaskPriority,
      reason: str('reason'),
    };
  });
}

export class GeminiPlanner implements Planner {
  readonly name = 'gemini';
  private readonly generate: Generate;

  constructor(
    private readonly config: PlanningConfig,
    generate?: Generate,
    private readonly readRules: (path: string) => Promise<string> = (p) => readFile(p, 'utf8'),
  ) {
    this.generate = generate ?? geminiGenerate(config.geminiApiKey);
  }

  private readonly heuristic = new HeuristicPlanner();

  async propose(ctx: PlanningContext, notes: string[] = []): Promise<Assignment[]> {
    if (ctx.tasks.length === 0 || ctx.slots.length === 0) return [];
    const rules = await this.readRules(this.config.rulesPath).catch(() => {
      throw new Error(`No se pudieron leer las reglas de planificación en ${this.config.rulesPath}.`);
    });
    const request = { system: `${INSTRUCTIONS}

# Reglas del usuario

${rules}`, prompt: planningPrompt(ctx), schema: RESPONSE_SCHEMA };
    const failures: string[] = [];
    // Flash-Lite can't plan a whole week (tried 2026-10-02: an empty plan, then 5 placements with 9
    // rejected and a habit put in a study block), but it answers the line map below well. So the
    // whole plan is asked of the full models only.
    const planModels = this.config.geminiModels.filter((m) => !/lite/i.test(m));
    for (const model of planModels.length ? planModels : this.config.geminiModels) {
      try {
        const assignments = parseAssignments(await this.generate({ ...request, model }));
        // A small model sometimes answers an empty plan rather than a wrong one; that's a miss too.
        if (assignments.length === 0) throw new Error('devolvió un plan vacío');
        notes.push(`Plan hecho con ${model}.`, ...failures);
        return assignments;
      } catch (error) {
        failures.push(`${model} falló: ${shortError(error)}`);
      }
    }

    // No model produced a whole plan: ask only which block each study line goes in, and let the
    // heuristic pack the blocks with that map (throws if even that fails; the service then falls
    // back to the plain heuristic).
    // The map written once from the user's rules knows the phase order (finish analysis before
    // Pilar A in B2); a small model's improvised map doesn't (2026-10-02: Flash-Lite put Pilar B,
    // phase 3, in B2). So the reference map goes first, and Gemini's only where there is none.
    const reference = await loadReferenceLineMap(this.config.attentionDocsPath, ctx);
    if (reference) {
      notes.push('Ningún modelo armó el plan completo (nivel gratis saturado); el código llenó los bloques con el mapa de referencia de tus reglas (docs/planning/mapa-lineas.json). Las tareas sueltas quedan para el próximo plan con IA.', ...failures);
      return this.heuristic.proposeWith(ctx, reference.map, reference.sequence);
    }
    const { map, model } = await mapLinesWithModel(ctx, rules, this.generate, this.config.geminiModels, failures);
    notes.push(`Ningún modelo armó el plan completo; ${model} decidió qué línea va en qué bloque y el código llenó los bloques.`, ...failures);
    return this.heuristic.proposeWith(ctx, map);
  }
}
