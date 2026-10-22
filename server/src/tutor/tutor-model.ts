import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import { tutorConfig, type TutorConfig } from './tutor.config';
import { TUTOR_REPLY_SCHEMA } from './tutor-reply';

export const TUTOR_MODEL = Symbol('TUTOR_MODEL');

export interface TutorModelRequest {
  prompt: string;
  sessionId: string;
  /** False on a conversation's first turn (`--session-id`), true after (`--resume`). */
  resume: boolean;
}

export interface TutorModelResponse {
  /** Claude's structured output, still unvalidated. */
  output: unknown;
  durationMs: number;
  costUsd: number | null;
}

/** Behind an interface (like the planner's) so tests can run the tutor without Claude. */
export interface TutorModel {
  run(request: TutorModelRequest): Promise<TutorModelResponse>;
}

/** Claude isn't there or failed: the turn answers 503 and nothing is recorded (D33). */
export class TutorUnavailableError extends Error {}

/** Claude answered, but not with something the tutor can use (D31). */
export class TutorInvalidReplyError extends Error {}

/**
 * The logged-in Claude Code CLI (study-tutor-game D28). No shell: the student's message goes in on
 * stdin and every argument is passed as-is. Only Read is allowed, in dontAsk mode, inside the vault.
 */
@Injectable()
export class ClaudeCliTutor implements TutorModel {
  constructor(private readonly config: TutorConfig = tutorConfig()) {}

  run({ prompt, sessionId, resume }: TutorModelRequest): Promise<TutorModelResponse> {
    const { claudeBin, model, timeoutMs, vault, promptPath, workDir } = this.config;
    mkdirSync(workDir, { recursive: true });
    const args = [
      '-p',
      '--model',
      model,
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(TUTOR_REPLY_SCHEMA),
      '--append-system-prompt-file',
      promptPath,
      '--add-dir',
      vault,
      '--tools',
      'Read',
      '--allowedTools',
      'Read',
      '--permission-mode',
      'dontAsk',
      ...(resume ? ['--resume', sessionId] : ['--session-id', sessionId]),
    ];
    const started = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(claudeBin, args, { cwd: workDir, windowsHide: true, shell: false });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(
          new TutorUnavailableError(`Claude no respondió en ${Math.round(timeoutMs / 1000)} s`),
        );
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
      child.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(
          new TutorUnavailableError(
            error.code === 'ENOENT'
              ? `No se encontró el CLI de Claude (${claudeBin}). Instálalo e inicia sesión en este equipo.`
              : `No se pudo lanzar Claude: ${error.message}`,
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        let parsed: {
          is_error?: boolean;
          result?: string;
          structured_output?: unknown;
          total_cost_usd?: number;
        };
        try {
          parsed = JSON.parse(stdout);
        } catch {
          const detail = (stderr || stdout).trim().slice(-400);
          reject(
            new TutorUnavailableError(
              `Claude terminó con código ${code}: ${detail || 'sin salida'}`,
            ),
          );
          return;
        }
        if (parsed.is_error || code !== 0) {
          reject(
            new TutorUnavailableError(`Claude falló: ${(parsed.result ?? stderr).slice(0, 400)}`),
          );
          return;
        }
        if (parsed.structured_output === undefined) {
          reject(new TutorInvalidReplyError('Claude no devolvió la respuesta estructurada'));
          return;
        }
        resolve({
          output: parsed.structured_output,
          durationMs: Date.now() - started,
          costUsd: parsed.total_cost_usd ?? null,
        });
      });

      child.stdin.on('error', () => undefined);
      child.stdin.end(prompt, 'utf8');
    });
  }
}
