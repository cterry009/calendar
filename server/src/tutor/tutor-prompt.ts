import type { ExerciseKind, NoteSection } from '@calendar/shared';
import type { CatalogNote } from './catalog';

/** The exercise on the table, as the client sends it back each turn and the server returns it. */
export interface TutorExercise {
  exerciseId: string;
  source: 'nota' | 'generado';
  noteCode: string;
  section: string;
  kind: ExerciseKind | null;
  b: number;
  title: string | null;
  statement: string;
  answer: string | null;
  hint: string | null;
}

export interface TurnPromptInput {
  message: string;
  note: CatalogNote;
  section: NoteSection | null;
  theta: number;
  level: number;
  attempts: number;
  studySession: string | null;
  current: TutorExercise | null;
  /** The engine wants a new exercise at this b (no catalog exercise is close enough). */
  generateAt: number | null;
}

const KIND_LABEL: Record<ExerciseKind, string> = {
  vf: 'verdadero o falso',
  sencillo: '🟢 sencillo',
  medio: '🟡 medio',
  dificil: '🔴 difícil (jefe)',
  muy_dificil: '⚫ muy difícil (jefe)',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The context block the code puts before the student's message (study-tutor-game D29): enough to
 * grade and explain without reading the whole note, plus the line range for a bounded Read.
 */
export function buildTurnPrompt(input: TurnPromptInput): string {
  const { note, section, current } = input;
  const out: string[] = ['[Contexto de la app]'];

  const range = section
    ? `sección «${section.title}», líneas ${section.startLine}-${section.endLine}`
    : 'sección sin rango conocido';
  out.push(`Nota: ${note.noteCode} — ${note.relativePath} (${range}).`);
  out.push(`Ruta para Read: ${note.path}`);
  if (input.studySession) out.push(`Sesión de estudio del bloque: ${input.studySession}.`);
  out.push(
    `Habilidad en la sección: θ = ${round2(input.theta)}, nivel ${input.level}, ${input.attempts} intentos.`,
  );
  out.push('');

  if (current) {
    const kind = current.kind ? KIND_LABEL[current.kind] : 'generado';
    const title = current.title ? ` — ${current.title}` : '';
    out.push(
      `Ejercicio en la mesa: ${current.exerciseId} (${kind}${title}, b = ${round2(current.b)}).`,
    );
    out.push('Enunciado:');
    out.push(current.statement);
    if (current.answer) {
      out.push('');
      out.push('Respuesta de referencia (no la reveles mientras el estudiante intenta):');
      out.push(current.answer);
    }
    if (current.hint) {
      out.push('');
      out.push('Pista de la nota:');
      out.push(current.hint);
    }
  } else if (input.generateAt !== null) {
    out.push(
      `No hay ejercicio de la nota a la dificultad justa: escribe uno nuevo de la sección con b ≈ ${round2(input.generateAt)} ` +
        '(accion "proponer_ejercicio" con ejercicioGenerado: enunciado y respuesta completa) y preséntaselo al estudiante.',
    );
  } else {
    out.push('No hay ejercicio en la mesa.');
  }

  out.push('');
  out.push('[Mensaje del estudiante]');
  out.push(input.message);
  return out.join('\n');
}
