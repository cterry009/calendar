import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AttentionProfile } from '@prisma/client';

// Attention rating (docs/planning/normas-de-atencion.md). The (reentry, load) -> profile table
// mirrors packages/shared/src/attention/profiles.ts, which the server doesn't import; a test checks
// the two stay equal.

const PROFILE_TABLE: AttentionProfile[][] = [
  ['MECHANICAL', 'MECHANICAL', 'LIGHT', 'LIGHT'],
  ['MECHANICAL', 'LIGHT', 'LIGHT', 'LIGHT'],
  ['LIGHT', 'LIGHT', 'LIGHT', 'DEEP'],
  ['LIGHT', 'DEEP', 'DEEP', 'DEEP'],
];

/** Block length and pomodoros per block, as in packages/shared ATTENTION_PROFILE_SPECS. */
export const PROFILE_BLOCK: Record<AttentionProfile, { blockMin: number; pomodoros: number }> = {
  MECHANICAL: { blockMin: 60, pomodoros: 3 },
  LIGHT: { blockMin: 90, pomodoros: 3 },
  DEEP: { blockMin: 90, pomodoros: 2 },
};

export function attentionProfileFor(reentry: number, load: number): AttentionProfile {
  return PROFILE_TABLE[reentry][load];
}

export function isRating(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 3;
}

/** One reference label from docs/planning/anclas.json. */
export interface Anchor {
  /** `note:<pensum>#<note>#<n>` (the import's clientId), `titulo:<title>`, or `reglas:<id>`. */
  clave: string;
  titulo: string;
  tipo: string;
  R: number | null;
  C: number | null;
  perfil: string | null;
  porque: string;
}

export interface AttentionDocs {
  normas: string;
  anclas: Anchor[];
}

export async function loadAttentionDocs(dir: string): Promise<AttentionDocs> {
  const [normas, anclas] = await Promise.all([
    readFile(join(dir, 'normas-de-atencion.md'), 'utf8'),
    readFile(join(dir, 'anclas.json'), 'utf8').then((s) => (JSON.parse(s) as { anclas: Anchor[] }).anclas),
  ]);
  return { normas, anclas };
}

/**
 * The anchor that labels a task: by the import's clientId -- a session of a split unit
 * (`...#1.2`) takes its unit's label (`...#1`) -- or by exact title for loose tasks.
 */
export function anchorFor(anclas: Anchor[], task: { clientId: string | null; title: string }): Anchor | null {
  const unitId = task.clientId?.replace(/\.\d+$/, '');
  return (
    anclas.find((a) => task.clientId && (a.clave === task.clientId || a.clave === unitId)) ??
    anclas.find((a) => a.clave === `titulo:${task.title}`) ??
    null
  );
}

/** About 20 anchors that cover every profile and kind of work, as examples for the model. */
export function exampleAnchors(anclas: Anchor[], max = 20): Anchor[] {
  const rated = anclas.filter((a) => a.R !== null && a.C !== null);
  const picked: Anchor[] = [];
  // One of each (profile, type) pair first, then fill in pensum order.
  const seen = new Set<string>();
  for (const a of rated) {
    const key = `${a.perfil}/${a.tipo}`;
    if (!seen.has(key)) {
      seen.add(key);
      picked.push(a);
    }
  }
  for (const a of rated) {
    if (picked.length >= max) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked.slice(0, max);
}
