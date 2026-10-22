import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The study tutor (openspec study-tutor-game, phase 3, 2026-10-21) runs the logged-in Claude Code
// CLI, so there is no API key; without `claude` installed the tutor answers 503 and nothing else
// changes.
export interface TutorConfig {
  /** `claude` on PATH, or a full path to the binary. */
  claudeBin: string;
  /** The user picked Opus (2026-10-21): ~20 s a turn. `sonnet` is ~10 s and a third of the quota. */
  model: string;
  timeoutMs: number;
  /** The Obsidian vault with the notes; Claude may read inside it and nowhere else. */
  vault: string;
  /** Appended to Claude Code's system prompt. The server runs from server/, like planning's docs. */
  promptPath: string;
  /**
   * Claude's working directory: an empty folder of the tutor's own, so the repo's CLAUDE.md and
   * settings aren't loaded into the tutor.
   */
  workDir: string;
}

export function tutorConfig(env: NodeJS.ProcessEnv = process.env): TutorConfig {
  return {
    claudeBin: env.TUTOR_CLAUDE_BIN || 'claude',
    model: env.TUTOR_MODEL || 'opus',
    timeoutMs: Number(env.TUTOR_TIMEOUT_MS) || 180_000,
    vault: env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica'),
    promptPath: env.TUTOR_PROMPT_PATH ?? resolve(process.cwd(), 'src', 'tutor', 'profesor.md'),
    workDir: env.TUTOR_WORK_DIR ?? join(tmpdir(), 'calendar-tutor'),
  };
}
