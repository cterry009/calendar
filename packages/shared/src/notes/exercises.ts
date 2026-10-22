// Reads the exercises written in the user's Obsidian notes into a catalog for the study game
// (openspec/changes/study-tutor-game, phase 1, 2026-10-20). Pure text -> data, no I/O, like
// pensum.ts. The formats below are the ones the notes actually use (checked against all 30 notes
// with exercises on 2026-10-21); nothing else is recognised.
//
//   ## 3. Sucesiones y series en $\mathbb{R}$        <- section "3"
//   ## Desarrollo  /  ### 4. Clustering             <- pillar notes: section "4"
//   **🟢 Sencillo.** <statement>                      <- or **🟡 Medio.**
//   *(tu respuesta aquí)*
//   > [!success]- Respuesta
//   > <answer>
//   > [!question]- Verdadero o falso (...)           <- one exercise per callout
//   > 1. <claim> — **Falso:** <why>
//   ## Cierre — 🔴 Difícil                             <- or ⚫ Muy difícil
//   **D2 (Picard-Lindelöf).** <statement>             <- ⚫ items are M1, M2...
//   *(tu intento aquí)*
//   > [!tip]- Pista
//   > [!success]- Solución

export type ExerciseKind = 'vf' | 'sencillo' | 'medio' | 'dificil' | 'muy_dificil';

export interface Exercise {
  /** Stable across re-parses: `${noteCode}#${section}#${n}` or `${noteCode}#cierre-rojo#D2`. */
  id: string;
  /** "AN1", "00b", "01a"...: the file name's prefix before the first "_". */
  noteCode: string;
  /** "3", or "cierre-rojo" / "cierre-negro" for the closing problems. */
  section: string;
  kind: ExerciseKind;
  /** Starting difficulty on the logit scale (the study game's b). */
  b0: number;
  /** The closing item's title, e.g. "Picard-Lindelöf". */
  title: string | null;
  /** Markdown with the LaTeX as written. */
  statement: string;
  /** The Respuesta / Solución callout, without the "> ". */
  answer: string | null;
  /** The Pista callout, without the "> ". */
  hint: string | null;
  /** Position within the note. */
  order: number;
}

export const EXERCISE_B0: Record<ExerciseKind, number> = {
  vf: -1.5,
  sencillo: -1,
  medio: 0,
  dificil: 1,
  muy_dificil: 2,
};

export const CLOSING_SECTIONS = ['cierre-rojo', 'cierre-negro'] as const;

export function isClosingSection(section: string): boolean {
  return (CLOSING_SECTIONS as readonly string[]).includes(section);
}

const NUMBERED_SECTION = /^##\s+(\d+)\.\s/;
// Pillar notes (A-D, B1, D1) keep their sections one level down, under "## Desarrollo" (D7).
const DEVELOPMENT = /^##\s+Desarrollo\b/;
const NUMBERED_SUBSECTION = /^###\s+(\d+)\.\s/;
const CLOSING = /^##\s+Cierre\b/;
const HEADING = /^#{1,6}\s/;
const SECTION_EXERCISE = /^\*\*(🟢 Sencillo|🟡 Medio)\.\*\*\s*(.*)$/u;
const TRUE_FALSE = /^>\s*\[!question\][-+]?\s*Verdadero o falso/i;
// Lazy title, so a title with its own parentheses ("$f(x)$") ends at the first ").**".
const CLOSING_ITEM = /^\*\*([DM]\d+)(?:\s*\((.*?)\))?\.\*\*\s*(.*)$/;
const CALLOUT = /^>\s*\[!(\w+)\]/;
const PLACEHOLDER = /^\*\(tu (respuesta|intento) aquí\)\*$/;
// "1. claim — **Falso:** why" -> the claim alone, so the statement doesn't give the answer away (D9).
const VERDICT = /\s+—\s+\*\*(Verdadero|Falso)\b.*$/;

type Context = 'section' | 'development' | 'closing' | null;

export interface NoteSection {
  /** Same keys as `Exercise.section`: "3", "cierre-rojo", "cierre-negro". */
  section: string;
  /** The heading without its #s, e.g. "3. Sucesiones y series en $\mathbb{R}$". */
  title: string;
  /** 1-based, the heading line. */
  startLine: number;
  /** 1-based, the last non-blank line before the next section or level-2 heading. */
  endLine: number;
}

/**
 * Each section's line range, with the same section rules as `parseExercises`. The tutor points
 * Claude at one range so it reads a section, not a 3 000-line note (study-tutor-game D29).
 */
export function noteSections(markdown: string): NoteSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: NoteSection[] = [];
  let open: NoteSection | null = null;
  let inDevelopment = false;

  const close = (beforeIndex: number) => {
    if (!open) return;
    let end = beforeIndex;
    while (end > open.startLine && lines[end - 1].trim() === '') end -= 1;
    open.endLine = end;
    sections.push(open);
    open = null;
  };
  const start = (section: string, index: number) => {
    open = {
      section,
      title: lines[index].trim().replace(/^#+\s+/, ''),
      startLine: index + 1,
      endLine: index + 1,
    };
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      close(i);
      const numbered = NUMBERED_SECTION.exec(line);
      inDevelopment = DEVELOPMENT.test(line);
      if (numbered) start(numbered[1], i);
      else if (CLOSING.test(line) && /🔴|⚫/u.test(line)) {
        start(line.includes('🔴') ? 'cierre-rojo' : 'cierre-negro', i);
      }
      return;
    }
    const sub = inDevelopment ? NUMBERED_SUBSECTION.exec(line) : null;
    if (sub) {
      close(i);
      start(sub[1], i);
    }
  });
  close(lines.length);
  return sections;
}

export function noteCodeOf(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.md$/i, '');
  return base.split('_')[0];
}

export function parseExercises(fileName: string, markdown: string): Exercise[] {
  const lines = markdown.split(/\r?\n/);
  const noteCode = noteCodeOf(fileName);
  const exercises: Exercise[] = [];
  const countBySection = new Map<string, number>();
  let context: Context = null;
  let section: string | null = null;

  const push = (
    exercise: Omit<Exercise, 'id' | 'noteCode' | 'section' | 'b0' | 'order'>,
    label?: string,
  ) => {
    if (section === null) return;
    let n = label;
    if (n === undefined) {
      const next = (countBySection.get(section) ?? 0) + 1;
      countBySection.set(section, next);
      n = String(next);
    }
    exercises.push({
      id: `${noteCode}#${section}#${n}`,
      noteCode,
      section,
      b0: EXERCISE_B0[exercise.kind],
      order: exercises.length,
      ...exercise,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('## ')) {
      const numbered = NUMBERED_SECTION.exec(line);
      if (numbered) {
        context = 'section';
        section = numbered[1];
      } else if (DEVELOPMENT.test(line)) {
        context = 'development';
        section = null;
      } else if (CLOSING.test(line) && /🔴|⚫/u.test(line)) {
        context = 'closing';
        section = line.includes('🔴') ? 'cierre-rojo' : 'cierre-negro';
      } else {
        // Any other level-2 heading ends the context ("## Todo", "## Conexión con...").
        context = null;
        section = null;
      }
      i += 1;
      continue;
    }
    if (context === 'development') {
      const sub = NUMBERED_SUBSECTION.exec(line);
      if (sub) {
        section = sub[1];
        i += 1;
        continue;
      }
    }
    if (section === null) {
      i += 1;
      continue;
    }

    if (context === 'section' || context === 'development') {
      const marker = SECTION_EXERCISE.exec(line);
      if (marker) {
        const read = readExercise(lines, i, marker[2]);
        push({
          kind: marker[1].includes('Sencillo') ? 'sencillo' : 'medio',
          title: null,
          statement: read.statement,
          answer: read.answer,
          hint: read.hint,
        });
        i = read.next;
        continue;
      }
      if (TRUE_FALSE.test(line)) {
        const body = readCalloutBody(lines, i + 1);
        push({
          kind: 'vf',
          title: null,
          statement: body.lines
            .map((l) => l.replace(VERDICT, ''))
            .join('\n')
            .trim(),
          answer: body.lines.join('\n').trim() || null,
          hint: null,
        });
        i = body.next;
        continue;
      }
    }

    if (context === 'closing') {
      const item = CLOSING_ITEM.exec(line);
      if (item) {
        const read = readExercise(lines, i, item[3]);
        push(
          {
            kind: section === 'cierre-rojo' ? 'dificil' : 'muy_dificil',
            title: item[2]?.trim() || null,
            statement: read.statement,
            answer: read.answer,
            hint: read.hint,
          },
          item[1],
        );
        i = read.next;
        continue;
      }
    }

    i += 1;
  }

  return exercises;
}

function isExerciseStart(line: string): boolean {
  return SECTION_EXERCISE.test(line) || CLOSING_ITEM.test(line) || TRUE_FALSE.test(line);
}

/**
 * The statement runs from the marker to the first callout (or the next exercise / heading); then
 * the Pista and Respuesta/Solución callouts that follow it, separated by blank lines, are read.
 */
function readExercise(
  lines: string[],
  start: number,
  firstLine: string,
): { statement: string; answer: string | null; hint: string | null; next: number } {
  const statement: string[] = [firstLine];
  let i = start + 1;
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (CALLOUT.test(line) || HEADING.test(line) || isExerciseStart(line)) break;
    if (PLACEHOLDER.test(line)) continue;
    statement.push(lines[i].trimEnd());
  }

  let answer: string | null = null;
  let hint: string | null = null;
  while (i < lines.length) {
    let j = i;
    while (j < lines.length && lines[j].trim() === '') j += 1;
    const callout = j < lines.length ? CALLOUT.exec(lines[j].trim()) : null;
    const type = callout?.[1].toLowerCase();
    if (type !== 'success' && type !== 'tip') break;
    const body = readCalloutBody(lines, j + 1);
    const text = body.lines.join('\n').trim() || null;
    if (type === 'success') answer = text;
    else hint = text;
    i = body.next;
  }

  return { statement: statement.join('\n').trim(), answer, hint, next: i };
}

/** The "> " lines after a callout header, without the "> ". */
function readCalloutBody(lines: string[], start: number): { lines: string[]; next: number } {
  const body: string[] = [];
  let i = start;
  while (i < lines.length && lines[i].trimStart().startsWith('>')) {
    body.push(lines[i].trimStart().replace(/^>\s?/, '').trimEnd());
    i += 1;
  }
  return { lines: body, next: i };
}
