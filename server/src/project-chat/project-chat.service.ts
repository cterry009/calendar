import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 2026-11-10: the AI chat inside a project's page. It runs the logged-in Claude Code CLI (like the
// tutor) with the calendar's own MCP bridge (services/claude-mcp), so what is decided here lands in
// the app -- log entries, objectives, tasks -- and every other Claude chat reads it from there.

export interface ProjectChatReply {
  reply: string;
  sessionId: string;
  durationMs: number;
}

function config(env: NodeJS.ProcessEnv = process.env) {
  return {
    claudeBin: env.TUTOR_CLAUDE_BIN || 'claude',
    model: env.PROJECT_CHAT_MODEL || 'sonnet',
    timeoutMs: Number(env.PROJECT_CHAT_TIMEOUT_MS) || 240_000,
    bridge: env.CALENDAR_MCP_ENTRY ?? resolve(process.cwd(), '..', 'services', 'claude-mcp', 'dist', 'index.js'),
    workDir: env.PROJECT_CHAT_WORK_DIR ?? join(tmpdir(), 'calendar-project-chat'),
  };
}

@Injectable()
export class ProjectChatService {
  private readonly busy = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async turn(userId: string, projectId: string, message: string, sessionId?: string): Promise<ProjectChatReply> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId, deletedAt: null } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (this.busy.has(userId)) {
      throw new HttpException({ error: 'chat_busy', message: 'El chat todavía está respondiendo el mensaje anterior.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    this.busy.add(userId);
    try {
      return await this.run(project, message, sessionId);
    } finally {
      this.busy.delete(userId);
    }
  }

  private run(
    project: { id: string; title: string; localPath: string | null },
    message: string,
    sessionId?: string,
  ): Promise<ProjectChatReply> {
    const c = config();
    if (!existsSync(c.bridge)) {
      throw new ServiceUnavailableException(`Falta compilar el puente MCP (${c.bridge}): npm run build --prefix services/claude-mcp`);
    }
    mkdirSync(c.workDir, { recursive: true });
    const mcpConfig = join(c.workDir, 'mcp.json');
    writeFileSync(mcpConfig, JSON.stringify({ mcpServers: { calendario: { command: process.execPath, args: [c.bridge] } } }));
    const folder = project.localPath && existsSync(project.localPath) ? project.localPath : null;
    const system = [
      `Eres el asistente del proyecto "${project.title}" (id ${project.id}) dentro de la app de calendario de Cristo. Responde en español, claro y conciso.`,
      'Al empezar una conversación lee el proyecto con la herramienta `proyecto` del servidor calendario (objetivos, bitácora, tareas) y responde con ese contexto.',
      'Cuando Cristo decida algo, termine un avance o pida un cambio: regístralo con las herramientas del calendario (registrar_avance, actualizar_proyecto, crear_tarea, completar_tarea), un registro por cambio, y dile qué guardaste. No cambies nada que no te pida o que no se desprenda claramente de la conversación.',
      'Lo que guardas en el calendario lo ven todos sus chats de Claude y sus dispositivos: es la memoria compartida del proyecto.',
      folder ? `Puedes leer (no modificar) los archivos de la carpeta del proyecto: ${folder}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const id = sessionId ?? randomUUID();
    const args = [
      '-p',
      '--model',
      c.model,
      '--output-format',
      'json',
      '--append-system-prompt',
      system,
      '--mcp-config',
      mcpConfig,
      '--strict-mcp-config',
      '--allowedTools',
      'mcp__calendario',
      'WebSearch',
      'WebFetch',
      'Read',
      'Glob',
      'Grep',
      '--permission-mode',
      'dontAsk',
      ...(folder ? ['--add-dir', folder] : []),
      ...(sessionId ? ['--resume', id] : ['--session-id', id]),
    ];
    const started = Date.now();
    return new Promise((resolvePromise, reject) => {
      const child = spawn(c.claudeBin, args, { cwd: c.workDir, windowsHide: true, shell: false });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new ServiceUnavailableException(`Claude no respondió en ${Math.round(c.timeoutMs / 1000)} s`));
      }, c.timeoutMs);
      child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
      child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));
      child.on('error', (e: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        reject(
          new ServiceUnavailableException(
            e.code === 'ENOENT' ? `No se encontró el CLI de Claude (${c.claudeBin}).` : `No se pudo lanzar Claude: ${e.message}`,
          ),
        );
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        let parsed: { is_error?: boolean; result?: string; session_id?: string };
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(new ServiceUnavailableException(`Claude terminó con código ${code}: ${(stderr || stdout).trim().slice(-400) || 'sin salida'}`));
          return;
        }
        if (parsed.is_error || code !== 0) {
          reject(new ServiceUnavailableException(`Claude falló: ${(parsed.result ?? stderr).slice(0, 400)}`));
          return;
        }
        resolvePromise({ reply: parsed.result ?? '', sessionId: parsed.session_id ?? id, durationMs: Date.now() - started });
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(message, 'utf8');
    });
  }
}
