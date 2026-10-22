// What Claude must answer (passed as --json-schema) and the code's own check of it (study-tutor-game
// D31). The schema only shapes the reply; the rules that matter (which exercise may be graded, which
// b a generated exercise gets) are enforced here, because the model proposes and the code decides.

export const TUTOR_ACTIONS = ['explicar', 'proponer_ejercicio', 'pista', 'calificar'] as const;
export type TutorAction = (typeof TUTOR_ACTIONS)[number];

export const TUTOR_REPLY_SCHEMA = {
  type: 'object',
  properties: {
    mensaje: { type: 'string', description: 'Lo que ve el estudiante: markdown con LaTeX.' },
    accion: { type: 'string', enum: [...TUTOR_ACTIONS] },
    calificacion: {
      type: 'object',
      description: 'Solo con accion "calificar".',
      properties: {
        exerciseId: { type: 'string' },
        r: { type: 'number', enum: [0, 0.5, 1] },
        pistas: { type: 'integer', minimum: 0 },
        justificacion: { type: 'string' },
      },
      required: ['exerciseId', 'r', 'pistas', 'justificacion'],
    },
    ejercicioGenerado: {
      type: 'object',
      description: 'Solo con accion "proponer_ejercicio", cuando la app pide un ejercicio nuevo.',
      properties: {
        enunciado: { type: 'string' },
        respuesta: { type: 'string' },
        b: { type: 'number' },
      },
      required: ['enunciado', 'respuesta'],
    },
  },
  required: ['mensaje', 'accion'],
} as const;

export interface TutorReply {
  mensaje: string;
  accion: TutorAction;
  calificacion?: { exerciseId: string; r: 0 | 0.5 | 1; pistas: number; justificacion: string };
  ejercicioGenerado?: { enunciado: string; respuesta: string };
}

/** The reply's shape, or a reason it can't be used. Exercise-level rules are checked by the service. */
export function parseTutorReply(output: unknown): TutorReply | string {
  if (!output || typeof output !== 'object') return 'la respuesta no es un objeto';
  const o = output as Record<string, unknown>;
  if (typeof o.mensaje !== 'string' || !o.mensaje.trim()) return 'falta el mensaje';
  if (!TUTOR_ACTIONS.includes(o.accion as TutorAction))
    return `acción desconocida: ${String(o.accion)}`;
  const reply: TutorReply = { mensaje: o.mensaje, accion: o.accion as TutorAction };

  if (o.calificacion !== undefined && o.calificacion !== null) {
    const c = o.calificacion as Record<string, unknown>;
    if (typeof c.exerciseId !== 'string') return 'la calificación no dice qué ejercicio';
    if (c.r !== 0 && c.r !== 0.5 && c.r !== 1) return `calificación inválida: r = ${String(c.r)}`;
    if (!Number.isInteger(c.pistas) || (c.pistas as number) < 0) return 'número de pistas inválido';
    if (typeof c.justificacion !== 'string') return 'falta la justificación';
    reply.calificacion = {
      exerciseId: c.exerciseId,
      r: c.r,
      pistas: c.pistas as number,
      justificacion: c.justificacion,
    };
  }
  if (reply.accion === 'calificar' && !reply.calificacion)
    return 'acción calificar sin calificación';

  if (o.ejercicioGenerado !== undefined && o.ejercicioGenerado !== null) {
    const g = o.ejercicioGenerado as Record<string, unknown>;
    if (typeof g.enunciado !== 'string' || !g.enunciado.trim())
      return 'ejercicio generado sin enunciado';
    reply.ejercicioGenerado = {
      enunciado: g.enunciado,
      respuesta: typeof g.respuesta === 'string' ? g.respuesta : '',
    };
  }
  return reply;
}
