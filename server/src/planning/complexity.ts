import type { PlanningTask } from './planning.types';

// Task complexity for planning (task 8.13), inferred by Laya (services/laya): a small local
// decision model that answers a typed question in one forward pass instead of generating text.
// It runs zero-shot here -- no fine-tuning on this user's tasks yet -- so its scores are coarse,
// but they order tasks sensibly (a closing session above a light review). The planner uses them
// to put demanding tasks in the morning, and the validator to put the hardest task first in a block.

const LEVELS = [
  'muy fácil: lectura ligera, repaso u organización',
  'fácil: material introductorio o ejercicios directos',
  'media: teoría nueva con algunas derivaciones',
  'difícil: derivaciones y demostraciones largas, código no trivial',
  'muy difícil: cierre del tema, teoría abstracta y ejercicios duros',
];

const QUESTION = {
  complejidad: {
    type: 'score',
    instructions: '¿Qué tan difícil y exigente mentalmente es esta tarea de estudio o trabajo para un estudiante de física?',
    criteria: LEVELS,
  },
};

/** Laya's server takes at most 64 states per batch. */
const BATCH = 64;

/** Laya's 0-4 score onto the task's 1-10 complexity scale. */
export function toComplexity(score: number): number {
  return Math.min(10, Math.max(1, Math.round(1 + (score * 9) / (LEVELS.length - 1))));
}

/** What Laya reads about a task: the text, plus the marks the pensum import already put on it. */
export function layaState(task: PlanningTask): Record<string, string> {
  const state: Record<string, string> = { tarea: task.title };
  if (task.category) state.materia = task.category;
  if (task.description) state.detalle = task.description;
  if (task.difficulty === 'HARD') state.marca = 'Marcada como sesión de cierre difícil.';
  if (task.difficulty === 'EASY') state.marca = 'Marcada como tarea fácil.';
  if (task.priority === 'LOW') state.opcional = 'Sesión opcional o de baja prioridad.';
  return state;
}

// Laya picking the attention profile directly. Zero-shot it scored 45% on the reference labels
// (2026-10-01), below always answering LIGHT (58%): it only becomes useful once fine-tuned on
// them. Until then its answer is shown next to Gemini's, never used on its own.
const PROFILE_QUESTION = {
  perfil: {
    type: 'choice',
    instructions: '¿Cuánta concentración sostenida exige esta tarea de un estudiante de física?',
    criteria: {
      MECHANICAL: 'rutina mecánica: correos, formularios, registros, organizar; se retoma al instante',
      LIGHT: 'concentración media: leer teoría, repasar, ejercicios directos, comparar métodos; se retoma releyendo el último paso',
      DEEP: 'concentración profunda: demostraciones largas, cierres difíciles, teoría muy abstracta, programar o depurar desde cero',
    },
  },
};

export interface LayaProfileAnswer {
  profile: 'MECHANICAL' | 'LIGHT' | 'DEEP';
  confidence: number;
  probabilities: Record<string, number>;
}

export class LayaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 60_000,
  ) {}

  /** Laya's attention profile for one task description. Throws if Laya is down. */
  async profile(state: Record<string, string>): Promise<LayaProfileAnswer> {
    const res = await this.fetchImpl(`${this.baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ state, questions: PROFILE_QUESTION, model: 'multilingual' }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Laya respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as {
      answers?: { perfil?: { choice?: string; answer_confidence?: number; probabilities?: Record<string, number> } };
    };
    const answer = body.answers?.perfil;
    if (answer?.choice !== 'MECHANICAL' && answer?.choice !== 'LIGHT' && answer?.choice !== 'DEEP') {
      throw new Error('Laya devolvió un perfil inválido.');
    }
    return { profile: answer.choice, confidence: answer.answer_confidence ?? 0, probabilities: answer.probabilities ?? {} };
  }

  /** Complexity 1-10 per task id. Throws if Laya is down or answers something unexpected. */
  async score(tasks: PlanningTask[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    for (let i = 0; i < tasks.length; i += BATCH) {
      const chunk = tasks.slice(i, i + BATCH);
      const res = await this.fetchImpl(`${this.baseUrl}/v1/systemone/batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ states: chunk.map(layaState), questions: QUESTION, model: 'multilingual' }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) throw new Error(`Laya respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { results?: Array<{ answers?: { complejidad?: { score?: number } } }> };
      if (!Array.isArray(body.results) || body.results.length !== chunk.length) {
        throw new Error('Laya devolvió un número de resultados distinto al de tareas.');
      }
      chunk.forEach((task, j) => {
        const score = body.results![j].answers?.complejidad?.score;
        if (typeof score !== 'number' || !Number.isFinite(score)) throw new Error('Laya devolvió un puntaje inválido.');
        out.set(task.id, toComplexity(score));
      });
    }
    return out;
  }
}
