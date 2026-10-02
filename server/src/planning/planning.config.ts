import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Planning's outside services (task 8.13). Both are optional: without GEMINI_API_KEY the heuristic
// planner proposes, and without LAYA_URL each task keeps the complexity stored on it.
export interface PlanningConfig {
  geminiApiKey: string;
  /** Tried in order: the free tier's Flash models are often busy (503) at the same time, so the list
   * ends with the Flash-Lite ones, which have answered when every Flash was saturated (2026-10-02). */
  geminiModels: string[];
  /** Laya's HTTP server (`laya-serve`, see services/laya), e.g. http://127.0.0.1:8100. */
  layaUrl: string;
  /** The user's planning rules (weekly template, phases, adjustment rules), handed to the LLM. */
  rulesPath: string;
  /** docs/planning: the attention rubric and its reference labels. */
  attentionDocsPath: string;
}

export function planningConfig(env: NodeJS.ProcessEnv = process.env): PlanningConfig {
  const vault = env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica');
  return {
    geminiApiKey: env.GEMINI_API_KEY ?? '',
    geminiModels: (env.GEMINI_MODEL ?? 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    layaUrl: (env.LAYA_URL ?? '').replace(/\/+$/, ''),
    rulesPath: env.PLANNING_RULES_PATH ?? join(vault, 'Prompt_app_calendario.md'),
    // The server runs from server/, next to the repo's docs/.
    attentionDocsPath: env.ATTENTION_DOCS_PATH ?? resolve(process.cwd(), '..', 'docs', 'planning'),
  };
}
