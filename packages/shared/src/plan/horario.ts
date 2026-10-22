// The user's study/work timetable (given 2026-10-15, starting Monday 2026-10-19), copied verbatim
// from the JSON they provided -- don't add content here that isn't in it. The weekly template
// becomes the user's recurring blocks (plan.ts's templateToSchedules); phases, suggested pomodoros,
// milestones and adjustment rules live in the synced StudyPlan.
//
// One change by the user after the JSON (2026-10-22, dynamic-study-blocks): the morning study blocks
// are no longer 09:30-12:30 with a fixed sequence but a window, 08:00-12:00, for two blocks that start
// when the user starts them, sized by a check-in (bloques_manana; the rules are in morning.ts).

import type { SequenceSegment } from './sequence.js';

export const PLAN_CATEGORIES = [
  'estudio_b1',
  'estudio_b2',
  'codigo_academico',
  'codigo_datos',
  'carrera',
  'pilar_e',
  'investigacion',
  'repaso',
] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];

export interface PlanCategoryInfo {
  name: string;
  /** Suggested color from the prompt (azul, azul claro, verde, ...). */
  color: string;
}

export const PLAN_CATEGORY_INFO: Record<PlanCategory, PlanCategoryInfo> = {
  estudio_b1: { name: 'Estudio B1', color: '#2563eb' },
  estudio_b2: { name: 'Estudio B2', color: '#60a5fa' },
  codigo_academico: { name: 'Código académico 🎓', color: '#16a34a' },
  codigo_datos: { name: 'Análisis de datos 📊', color: '#f97316' },
  carrera: { name: 'Carrera', color: '#9333ea' },
  pilar_e: { name: 'Pilar E 🔬', color: '#14b8a6' },
  investigacion: { name: 'Investigación 🎓🔬', color: '#166534' },
  repaso: { name: 'Repaso y planeación', color: '#6b7280' },
};

export function isPlanCategory(value: string | null | undefined): value is PlanCategory {
  return !!value && (PLAN_CATEGORIES as readonly string[]).includes(value);
}

export const PLAN_DAY_KEYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;
export type PlanDayKey = (typeof PLAN_DAY_KEYS)[number];

export interface TemplateBlock {
  inicio: string;
  fin: string;
  categoria: PlanCategory;
  titulo: string;
}

export interface TemplateBreak {
  inicio: string;
  fin: string;
  titulo: string;
}

export interface WeeklyTemplate {
  lunes: TemplateBlock[];
  martes: TemplateBlock[];
  miercoles: TemplateBlock[];
  jueves: TemplateBlock[];
  viernes: TemplateBlock[];
  sabado: TemplateBlock[];
  descansos_lun_vie: TemplateBreak[];
  descansos_sabado: TemplateBreak[];
}

export interface PlanPhase {
  nombre: string;
  /** First and last week, inclusive. */
  semanas: [number, number];
  contenido: Partial<Record<PlanCategory, string>>;
}

export interface PlanMilestone {
  semana: number;
  titulo: string;
  categoria: PlanCategory;
}

/** Fixed, clock-anchored sequences. The morning has none since 2026-10-22 (bloques_manana). */
export interface PlanSequences {
  tarde: SequenceSegment[];
  sabado: SequenceSegment[];
}

export interface MorningBlocksSetting {
  ventana: { inicio: string; fin: string };
  bloques: number;
  /** Energy E = round((motivation + concentration) / 2) -> block and focus minutes. */
  tabla_energia: Array<{ energia: string; bloque_min: number; foco_min: number }>;
  pausas: string;
  bloque_cumplido: string;
  nota: string;
}

export interface HorarioData {
  plantilla_semanal: WeeklyTemplate;
  bloques_manana: MorningBlocksSetting;
  secuencias_pomodoro: PlanSequences;
  nota_secuencias: string;
  pomodoros_sugeridos: Partial<Record<PlanCategory, string[]>>;
  fases: PlanPhase[];
  hitos: PlanMilestone[];
  reglas_de_ajuste: string[];
}

export const PLAN_WEEKS = 14;

export const HORARIO_2026: HorarioData = {
  plantilla_semanal: {
    lunes: [
      { inicio: '08:00', fin: '12:00', categoria: 'estudio_b1', titulo: 'Estudio B1' },
      { inicio: '14:00', fin: '15:25', categoria: 'codigo_academico', titulo: 'Código de las notas' },
      { inicio: '15:35', fin: '17:00', categoria: 'carrera', titulo: 'Maestrías: investigar programas' },
    ],
    martes: [
      { inicio: '08:00', fin: '12:00', categoria: 'estudio_b1', titulo: 'Estudio B1' },
      { inicio: '14:00', fin: '15:25', categoria: 'codigo_datos', titulo: 'Proyecto de datos' },
      { inicio: '15:35', fin: '17:00', categoria: 'carrera', titulo: 'CV: las 3 versiones + CV académico' },
    ],
    miercoles: [
      { inicio: '08:00', fin: '12:00', categoria: 'estudio_b2', titulo: 'Estudio B2' },
      { inicio: '14:00', fin: '15:25', categoria: 'investigacion', titulo: 'Investigación PINN (experimentos del Pilar E)' },
      { inicio: '15:35', fin: '17:00', categoria: 'carrera', titulo: 'Maestrías: documentos (carta, SOP)' },
    ],
    jueves: [
      { inicio: '08:00', fin: '12:00', categoria: 'estudio_b1', titulo: 'Estudio B1' },
      { inicio: '14:00', fin: '15:25', categoria: 'codigo_datos', titulo: 'SQL + proyecto de datos' },
      { inicio: '15:35', fin: '17:00', categoria: 'carrera', titulo: 'Trabajo: aplicaciones dirigidas' },
    ],
    viernes: [
      { inicio: '08:00', fin: '12:00', categoria: 'pilar_e', titulo: 'Estudio Pilar E' },
      { inicio: '14:00', fin: '15:25', categoria: 'codigo_academico', titulo: 'Código de las notas' },
      {
        inicio: '15:35',
        fin: '17:00',
        categoria: 'carrera',
        titulo: 'Maestrías: correos a profesores y recomendadores + registro y plan de la semana',
      },
    ],
    sabado: [
      {
        inicio: '09:00',
        fin: '10:30',
        categoria: 'repaso',
        titulo: 'Repaso y ejercicios atrasados: rehacer 2-3 ejercicios sin mirar la solución',
      },
      { inicio: '11:00', fin: '12:30', categoria: 'repaso', titulo: 'Código pendiente + revisar convocatorias y planear la semana' },
    ],
    descansos_lun_vie: [
      { inicio: '12:30', fin: '14:00', titulo: 'Almuerzo' },
      { inicio: '15:25', fin: '15:35', titulo: 'Descanso' },
    ],
    descansos_sabado: [{ inicio: '10:30', fin: '11:00', titulo: 'Descanso' }],
  },

  // 2026-10-22: replaces secuencias_pomodoro.manana (30+5+40+15+40+10+20+5+15 anchored to 09:30).
  bloques_manana: {
    ventana: { inicio: '08:00', fin: '12:00' },
    bloques: 2,
    tabla_energia: [
      { energia: 'E ≤ 2', bloque_min: 90, foco_min: 20 },
      { energia: 'E = 3', bloque_min: 120, foco_min: 30 },
      { energia: 'E ≥ 4', bloque_min: 150, foco_min: 40 },
    ],
    pausas: '5 min después de un foco de 20-30 y 10 min después de uno de 40; el bloque cierra con un tramo de cierre de 15 min.',
    bloque_cumplido: 'Al menos 60 min de foco real; la mañana se cumple con dos bloques cumplidos.',
    nota: 'El horario es una recomendación: cada bloque empieza cuando lo inicias y su secuencia se ancla a esa hora. Al iniciar, motivación y concentración (1 a 5) proponen la duración del bloque (90-150) y de los focos (20-40); se pueden ajustar. La pausa arranca sola y el foco no. A las 12:00 no empieza ningún foco nuevo: el que corre termina y sigue el cierre; la tarde no se mueve.',
  },

  secuencias_pomodoro: {
    tarde: [
      { tipo: 'foco', minutos: 25, etiqueta: 'Pomodoro 1' },
      { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' },
      { tipo: 'foco', minutos: 25, etiqueta: 'Pomodoro 2' },
      { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' },
      { tipo: 'foco', minutos: 25, etiqueta: 'Pomodoro 3' },
    ],
    sabado: [
      { tipo: 'foco', minutos: 25, etiqueta: 'Pomodoro 1' },
      { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' },
      { tipo: 'foco', minutos: 25, etiqueta: 'Pomodoro 2' },
      { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' },
      { tipo: 'foco', minutos: 25, etiqueta: 'Pomodoro 3' },
      { tipo: 'pausa', minutos: 5, etiqueta: 'Pausa' },
    ],
  },

  nota_secuencias:
    'Los bloques de la mañana (estudio_b1, estudio_b2, pilar_e) no tienen secuencia fija desde el 2026-10-22: siguen bloques_manana. Los de la tarde usan secuencias_pomodoro.tarde; los del sábado, secuencias_pomodoro.sabado. En la tarde y el sábado, las etiquetas de los pomodoros salen de pomodoros_sugeridos según la categoría.',

  pomodoros_sugeridos: {
    codigo_academico: ['Planear y escribir', 'Escribir y probar', 'Probar, documentar, commit'],
    codigo_datos: ['Planear y escribir', 'Escribir y probar', 'Probar, documentar, commit'],
    investigacion: ['Montar el experimento', 'Correr y registrar', 'Analizar, graficar, anotar conclusiones'],
    carrera: ['Tarea principal', 'Tarea principal', 'Cierre: anotar qué sigue'],
    repaso: ['Repaso', 'Repaso', 'Planear'],
  },

  fases: [
    {
      nombre: 'Fase 1: fundamentos + mapa de maestrías + base de datos',
      semanas: [1, 4],
      contenido: {
        estudio_b1: 'Pensum geometría: 00b → 01a → AN1b (secciones 4-6) → 01 → 02',
        estudio_b2: 'Pensum análisis: AN1 → AN1c → 03 → AN2',
        codigo_academico:
          'Integradores simplécticos (02), Picard (AN1), caminata aleatoria (03), autovalores discretizados (AN2); crear repo computational-stat-phys',
        codigo_datos: 'SQL (joins, agregaciones, ventanas) + Proyecto 1: análisis exploratorio con datos.gov.co',
        carrera:
          'Tabla de 8-12 maestrías con requisitos y fecha de cierre (buscar grupos en transporte óptimo, ML para EDPs, análisis estocástico); CV académico',
        pilar_e: 'E0 (mapa) → E1 (NTK y PINNs); si hace falta, AN2 §5 antes',
        investigacion: 'NTK empírico de PINN-NS y PINN-LBM: espectros y trazas por bloque; pesos adaptativos por traza',
      },
    },
    {
      nombre: 'Fase 2: núcleo estocástico + Fourier + Pilar A + documentos',
      semanas: [5, 9],
      contenido: {
        estudio_b1: 'Notas 04 → 07 (procesos estocásticos, Itô, SDEs, Fokker-Planck)',
        estudio_b2: 'AN3 → AN4 → Pilar A (A1-A5)',
        codigo_academico:
          'FFT y ecuación del calor (AN3), Kramers-Kronig (AN4), Euler-Maruyama y Milstein (05-06), Fokker-Planck numérica (07), q-Gaussianas (A4)',
        codigo_datos:
          'Proyecto 2: dashboard (Streamlit o Power BI) + análisis estadístico con incertidumbres; opción: tablero de experimentos PINN del Pilar E',
        carrera:
          'SOP base (alrededor de la pregunta del Pilar E) y adaptaciones; pedir cartas de recomendación; 3-5 aplicaciones de trabajo por semana',
        pilar_e: 'E2: Wasserstein, JKO, GENERIC, redes de campo medio (empezar al terminar la nota 07)',
        investigacion: 'Distribución empírica de los pesos y distancia W2 a la inicialización; ¿régimen de núcleo o de campo medio?',
      },
    },
    {
      nombre: 'Fase 3: pilares B, C, D + enviar aplicaciones',
      semanas: [10, 14],
      contenido: {
        estudio_b1: 'Pilar C → Pilar D',
        estudio_b2: 'Pilar B',
        codigo_academico: 'Barabási-Albert y SIS (B), CSA/FSA/GSA (C), SINDy y Kramers-Moyal (D2)',
        codigo_datos: 'Proyecto 3: modelo predictivo + pipeline reproducible; preparar entrevistas de SQL y caso práctico',
        carrera: 'Enviar aplicaciones de maestría según fechas; preparar entrevistas; seguimiento de aplicaciones de trabajo',
        pilar_e: 'E3 (SGD como SDE) → E4 (Fisher, gradiente natural) → E5 (cálculo estocástico en variedades)',
        investigacion: 'Temperatura efectiva del ruido del minibatch; gradiente natural aproximado; informe técnico de 4-6 páginas',
      },
    },
  ],

  hitos: [
    { semana: 1, titulo: 'Tabla de maestrías con fechas de cierre', categoria: 'carrera' },
    { semana: 1, titulo: 'Definir a quién pedir las cartas de recomendación', categoria: 'carrera' },
    { semana: 2, titulo: 'CV académico v1', categoria: 'carrera' },
    { semana: 3, titulo: 'computational-stat-phys público con las primeras 2 carpetas', categoria: 'codigo_academico' },
    { semana: 4, titulo: 'Proyecto 1 publicado en data-portfolio', categoria: 'codigo_datos' },
    { semana: 4, titulo: 'NTK empírico funcionando en PINN-NS y PINN-LBM', categoria: 'investigacion' },
    { semana: 5, titulo: 'SOP base v1', categoria: 'carrera' },
    { semana: 6, titulo: 'Cartas de recomendación pedidas', categoria: 'carrera' },
    { semana: 9, titulo: 'Proyecto 2 publicado (dashboard desplegado)', categoria: 'codigo_datos' },
    { semana: 9, titulo: 'Figura de espectros NTK y distancias W2; pregunta de investigación redactada', categoria: 'investigacion' },
    { semana: 10, titulo: 'Aplicaciones de maestría enviadas según fechas', categoria: 'carrera' },
    { semana: 12, titulo: 'Informe técnico del Pilar E (4-6 páginas)', categoria: 'investigacion' },
    { semana: 14, titulo: 'Proyecto 3 publicado; los tres CVs actualizados', categoria: 'codigo_datos' },
  ],

  reglas_de_ajuste: [
    'Si se atrasa el estudio, recortar primero estudio_b2, nunca el bloque de carrera.',
    'Cuando se acerque una fecha de cierre de maestría, el bloque de 14:00 con codigo_academico (notas) pasa a carrera (documentos de la aplicación).',
    'Si hay un proceso de selección con prueba técnica, esa semana los bloques de codigo_academico (notas) pasan a codigo_datos (preparación).',
    'Si cambia la prioridad hacia el trabajo, el bloque de 14:00 del lunes o del viernes pasa de codigo_academico a codigo_datos.',
  ],
};
