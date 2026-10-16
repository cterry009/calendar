import { z } from 'zod';

// Horario 2026-10-19 (plan/horario.ts, plan/plan.ts).

export const SequenceSegmentSchema = z.object({
  tipo: z.enum(['foco', 'pausa', 'cierre']),
  minutos: z.number().int().min(1).max(600),
  etiqueta: z.string().max(200),
});

const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const PlanCategorySchema = z.enum([
  'estudio_b1',
  'estudio_b2',
  'codigo_academico',
  'codigo_datos',
  'carrera',
  'pilar_e',
  'investigacion',
  'repaso',
]);

/** StudyPlan.planData: one per user, like DetoxPlan. */
export const StudyPlanDataSchema = z.object({
  startDate: DateKeySchema,
  weeks: z.number().int().min(1).max(104),
  fases: z.array(
    z.object({
      nombre: z.string(),
      semanas: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
      contenido: z.record(z.string()),
    }),
  ),
  pomodoros_sugeridos: z.record(z.array(z.string())),
  hitos: z.array(z.object({ semana: z.number().int().min(1), titulo: z.string(), categoria: PlanCategorySchema })),
  reglas_de_ajuste: z.array(z.string()),
});

/** A one-off change to one block on one day. */
export const ScheduleExceptionSchema = z.object({
  id: z.string().optional(),
  scheduleId: z.string().min(1),
  date: DateKeySchema,
  category: z.string().max(40).optional().nullable(),
  label: z.string().max(200).optional().nullable(),
  startMinute: z.number().int().min(0).max(1439).optional().nullable(),
  endMinute: z.number().int().min(1).max(1440).optional().nullable(),
});

export type ScheduleException = z.infer<typeof ScheduleExceptionSchema>;
