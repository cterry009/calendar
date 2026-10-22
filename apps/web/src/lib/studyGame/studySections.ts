// Which note and sections a study block is about, read from its study task (study-tutor-game D37).
// The importer (scripts/import-study-notes.mjs) writes the note code into the clientId,
// `note:pensum_analisis.md#AN1#3.1`, and the sections into the description, "Secciones: 4-5.".

export interface StudySections {
  noteCode: string;
  /** In order: "4", "5", and the closings when the session is a closing one. */
  sections: string[];
}

const CLIENT_ID = /^note:[^#]+#([^#]+)#/;
const SECTIONS_LINE = /Secciones:\s*([^\n.]+)/i;

export function studySectionsOf(task: {
  clientId: string | null;
  title: string;
  description: string | null;
}): StudySections | null {
  const noteCode = task.clientId ? CLIENT_ID.exec(task.clientId)?.[1] : undefined;
  // Pillar blocks without a note code ("Bloque 3") have no exercises to match.
  if (!noteCode || /^\d+$/.test(noteCode)) return null;

  const sections: string[] = [];
  const listed = task.description ? SECTIONS_LINE.exec(task.description)?.[1] : undefined;
  for (const part of listed?.split(/,|\by\b/) ?? []) {
    const range = /(\d+)\s*-\s*(\d+)/.exec(part);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n += 1) sections.push(String(n));
    } else {
      const single = /(\d+)/.exec(part);
      if (single) sections.push(single[1]);
    }
  }
  if (/cierre/i.test(`${task.title}\n${task.description ?? ''}`)) {
    sections.push('cierre-rojo', 'cierre-negro');
  }
  return { noteCode, sections: [...new Set(sections)] };
}

export function sectionLabel(section: string): string {
  if (section === 'cierre-rojo') return 'Cierre 🔴';
  if (section === 'cierre-negro') return 'Cierre ⚫';
  return `§${section}`;
}

const DOUBLE_STRUCK: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ' };

/**
 * A heading's LaTeX as plain text, for places that can't render it (a native `<select>`):
 * "Sucesiones y series en $\mathbb{R}$" -> "Sucesiones y series en ℝ".
 */
export function plainMath(text: string): string {
  return text
    .replace(/\\mathbb\{([A-Z])\}/g, (_, letter: string) => DOUBLE_STRUCK[letter] ?? letter)
    .replace(/\\(?:mathrm|mathcal|text|operatorname)\{([^}]*)\}/g, '$1')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[${}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
