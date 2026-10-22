import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { noteSections, parseExercises, type Exercise, type NoteSection } from '@calendar/shared';

export interface CatalogNote {
  noteCode: string;
  /** Absolute path, for Claude's Read. */
  path: string;
  /** Relative to the vault, for people. */
  relativePath: string;
  /** The note's "# " heading, or its file name. */
  title: string;
  sections: NoteSection[];
}

export interface Catalog {
  exercises: Exercise[];
  notes: Map<string, CatalogNote>;
}

interface CachedFile {
  mtimeMs: number;
  exercises: Exercise[];
  note: CatalogNote | null;
}

/**
 * The exercises written in the vault's notes, parsed with the same code the clients use. Each file
 * is re-parsed only when its mtime changes, so a turn doesn't re-read ~100 notes.
 */
export class TutorCatalog {
  private readonly cache = new Map<string, CachedFile>();

  constructor(private readonly vault: string) {}

  load(): Catalog {
    const vault = this.vault;
    const exercises: Exercise[] = [];
    const notes = new Map<string, CatalogNote>();
    for (const path of walkNotes(vault)) {
      const { mtimeMs } = statSync(path);
      let cached = this.cache.get(path);
      if (!cached || cached.mtimeMs !== mtimeMs) {
        const markdown = readFileSync(path, 'utf8');
        const name = path.split(/[\\/]/).pop()!;
        const parsed = parseExercises(name, markdown);
        cached = {
          mtimeMs,
          exercises: parsed,
          note: parsed.length
            ? {
                noteCode: parsed[0].noteCode,
                path,
                relativePath: relative(vault, path).replace(/\\/g, '/'),
                title: (/^#\s+(.+)$/m.exec(markdown)?.[1] ?? name.replace(/\.md$/, '')).trim(),
                sections: noteSections(markdown),
              }
            : null,
        };
        this.cache.set(path, cached);
      }
      exercises.push(...cached.exercises);
      if (cached.note) notes.set(cached.note.noteCode, cached.note);
    }
    return { exercises, notes };
  }
}

function walkNotes(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    if (name.startsWith('.')) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walkNotes(path);
    return name.endsWith('.md') ? [path] : [];
  });
}
