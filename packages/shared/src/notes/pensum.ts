// Reads the study plans ("pensums") in the user's Obsidian vault into study units the app can
// turn into tasks. Pure text -> data, no I/O, so both the import script and tests use it.
//
// Every pensum_*.md lists blocks of numbered sessions, under one of two heading styles:
//
//   ## Bloque 1 — Análisis real (AN1)          <- fundamentos: number, title, (note code)
//   ## A1 — La entropía $S_q$                  <- pillars: note code first
//   **7-9 sesiones**
//   1. Supremo, propiedad arquimediana, ... (secciones 1-2) — 2 sesiones.
//   3. ...; cierre 🔴/⚫ — 1 sesión (opcional si vas rápido).
//
// A "sesión" is ~90 minutes, i.e. one of the user's work blocks.

export interface StudyUnit {
  /** Stable across re-imports: `<pensum file>#<note code or block number>#<item number>`. */
  key: string;
  pensum: string;
  pensumTitle: string;
  blockNumber: number;
  blockTitle: string;
  /** The note code, e.g. "AN1", "01a", "A4". Null if the heading has none. */
  noteCode: string | null;
  itemNumber: number;
  topic: string;
  /** "secciones 1-2" / "sección 3" when the item names them. */
  sections: string | null;
  sessionsMin: number;
  sessionsMax: number;
  /** The session includes the hard closing exercises ("Cierre difícil", "cierre 🔴/⚫"). */
  isHardClosing: boolean;
  /** The pensum marks it optional ("opcional si vas rápido"). */
  isOptional: boolean;
  /** Position within the pensum, for keeping the plan's order. */
  order: number;
}

const BLOCK_HEADING = /^##\s+(?:Bloque\s+(\d+)|([A-Z]+\d+[a-z]?))\s*[—-]\s*(.+?)\s*$/;
const NOTE_CODE = /\(([^()]+)\)\s*$/;
// "1. Topic (secciones 1-2) — 1-2 sesiones." / "— 1 sesión (opcional ...)." / "— incluido ... o 1 sesión extra."
const ITEM = /^(\d+)\.\s+(.+?)\s+—\s+(.+?)\.?\s*$/;
const SESSIONS = /(\d+)(?:\s*-\s*(\d+))?\s+sesi[oó]n(?:es)?/i;
const SECTIONS = /\((secci[oó]n(?:es)?\s+[^)]+)\)\s*$/i;

export function parsePensum(fileName: string, markdown: string): StudyUnit[] {
  const lines = markdown.split(/\r?\n/);
  const pensumTitle = (lines.find((line) => line.startsWith('# ')) ?? fileName).replace(/^#\s+/, '').trim();
  const units: StudyUnit[] = [];
  let block: { number: number; title: string; code: string | null } | null = null;
  let blockCount = 0;

  for (const raw of lines) {
    const line = raw.trim();

    const heading = BLOCK_HEADING.exec(line);
    if (heading) {
      const title = heading[3];
      blockCount += 1;
      block = {
        number: heading[1] ? Number(heading[1]) : blockCount,
        title: title.replace(NOTE_CODE, '').trim(),
        code: heading[2] ?? NOTE_CODE.exec(title)?.[1] ?? null,
      };
      continue;
    }
    // Any other level-2 heading ends the blocks ("## Cómo encaja con el resto", "## Punto de control").
    if (line.startsWith('## ')) {
      block = null;
      continue;
    }
    if (!block) continue;

    const item = ITEM.exec(line);
    if (!item) continue;
    const sessions = SESSIONS.exec(item[3]);
    if (!sessions) continue;

    const min = Number(sessions[1]);
    const max = sessions[2] ? Number(sessions[2]) : min;
    const topicWithSections = item[2].trim();

    units.push({
      key: `${fileName}#${block.code ?? block.number}#${item[1]}`,
      pensum: fileName,
      pensumTitle,
      blockNumber: block.number,
      blockTitle: block.title,
      noteCode: block.code,
      itemNumber: Number(item[1]),
      topic: topicWithSections.replace(SECTIONS, '').trim(),
      sections: SECTIONS.exec(topicWithSections)?.[1] ?? null,
      sessionsMin: min,
      sessionsMax: max,
      isHardClosing: /cierre/i.test(topicWithSections),
      isOptional: /opcional/i.test(item[3]),
      order: units.length,
    });
  }

  return units;
}

/** Pomodoros for a unit: its sessions (the upper bound) times pomodoros per work block. */
export function unitPomodoros(unit: StudyUnit, pomodorosPerSession: number): number {
  return unit.sessionsMax * pomodorosPerSession;
}
