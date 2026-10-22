import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadGatewayException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { noteSections } from '@calendar/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { TutorCatalog } from '../src/tutor/catalog';
import type { TutorTurnDto } from '../src/tutor/dto/tutor-turn.dto';
import { TutorGameService } from '../src/tutor/tutor-game.service';
import {
  ClaudeCliTutor,
  type TutorModel,
  type TutorModelRequest,
  type TutorModelResponse,
} from '../src/tutor/tutor-model';
import { TutorService } from '../src/tutor/tutor.service';
import { useSyncHarness } from './harness';

// The tutor (study-tutor-game phase 3) with a fake Claude, on the real test database and a small
// vault written to a temp folder in the notes' real format.
const NOTE = `# AN1 — Análisis real

## 1. Los números reales

**🟢 Sencillo.** Calcula $\\sup A$ para $A=\\{1-1/n\\}$.

*(tu respuesta aquí)*

> [!success]- Respuesta
> $\\sup A=1$.

**🟡 Medio.** Demuestra que $\\sup(A+B)=\\sup A+\\sup B$.

> [!success]- Respuesta
> Cota y mínima con $\\varepsilon/2$.

> [!question]- Verdadero o falso (respuestas dentro)
> 1. Si $c,d$ son irracionales, $c+d$ es irracional. — **Falso:** $\\sqrt2-\\sqrt2=0$.

## 3. Sucesiones

**🟡 Medio.** Muestra que $x_{n+1}=\\sqrt{2+x_n}$ converge.

> [!success]- Respuesta
> Creciente y acotada; $L=2$.

## Cierre — 🔴 Difícil

**D1 (Cauchy).** Prueba que toda sucesión de Cauchy converge.

> [!tip]- Pista
> Bolzano-Weierstrass.

> [!success]- Solución
> Acotada, subsucesión, triangular.
`;

const vault = mkdtempSync(join(tmpdir(), 'tutor-vault-'));
mkdirSync(join(vault, 'Fundamentos', 'Analisis'), { recursive: true });
const notePath = join(vault, 'Fundamentos', 'Analisis', 'AN1_analisis_real.md');
writeFileSync(notePath, NOTE, 'utf8');

class FakeClaude implements TutorModel {
  replies: unknown[] = [];
  requests: TutorModelRequest[] = [];
  gate: Promise<void> | null = null;

  async run(request: TutorModelRequest): Promise<TutorModelResponse> {
    this.requests.push(request);
    if (this.gate) await this.gate;
    const output = this.replies.shift();
    if (output instanceof Error) throw output;
    return { output, durationMs: 5, costUsd: null };
  }
}

describe('tutor', () => {
  const h = useSyncHarness();
  let claude: FakeClaude;
  let tutor: TutorService;
  const turn = (dto: Partial<TutorTurnDto>) =>
    tutor.turn(h.userId, 'pc', {
      noteCode: 'AN1',
      section: '1',
      message: 'Hola',
      ...dto,
    } as TutorTurnDto);

  beforeEach(() => {
    claude = new FakeClaude();
    const prisma = h.prisma as unknown as PrismaService;
    tutor = new TutorService(
      claude,
      new TutorGameService(prisma, new TutorCatalog(vault)),
      h.service,
      prisma,
    );
  });

  it('starts a conversation on the exercise the engine picks, with the section range in the prompt', async () => {
    claude.replies.push({ mensaje: 'Empecemos con este.', accion: 'proponer_ejercicio' });
    const result = await turn({});

    // θ = 0 aims at b ≈ −1.39: the true/false (−1.5) is nearest.
    expect(result.current).toMatchObject({ exerciseId: 'AN1#1#3', source: 'nota', b: -1.5 });
    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(claude.requests[0]).toMatchObject({ sessionId: result.sessionId, resume: false });
    const section = noteSections(NOTE).find((s) => s.section === '1')!;
    expect(claude.requests[0].prompt).toContain(`líneas ${section.startLine}-${section.endLine}`);
    expect(claude.requests[0].prompt).toContain(notePath);
    expect(claude.requests[0].prompt).toContain('[Mensaje del estudiante]\nHola');
    expect(result.attempt).toBeNull();
    expect(result.game).toMatchObject({ theta: 0, xp: 0, attempts: 0 });
  });

  it('records a grade for the exercise on the table and moves on to the next one', async () => {
    claude.replies.push({
      mensaje: 'Bien, con una pista.',
      accion: 'calificar',
      calificacion: {
        exerciseId: 'AN1#1#1',
        r: 0.5,
        pistas: 1,
        justificacion: 'Faltó justificar.',
      },
    });
    const result = await turn({
      message: 'sup A = 1',
      current: { exerciseId: 'AN1#1#1', source: 'nota' },
      pomodoroSessionId: 'block-b1-2026-10-21',
    });

    const rows = await h.prisma.exerciseAttempt.findMany({ where: { userId: h.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      exerciseId: 'AN1#1#1',
      exerciseSource: 'nota',
      b: -1,
      r: 0.5,
      hints: 1,
      gradedBy: 'claude',
      feedback: 'Faltó justificar.',
      pomodoroSessionId: 'block-b1-2026-10-21',
    });
    expect(result.attempt).toMatchObject({ id: rows[0].id, r: 0.5, thetaBefore: 0 });
    expect(result.attempt!.xpGained).toBeGreaterThan(0);
    expect(result.game.xp).toBe(result.attempt!.xpGained);
    expect(result.current?.exerciseId).not.toBe('AN1#1#1');
    expect(h.notifications.some((n) => n.entities.includes('exerciseAttempts'))).toBe(true);
  });

  it('refuses a grade for an exercise that is not on the table', async () => {
    claude.replies.push({
      mensaje: 'Calificado.',
      accion: 'calificar',
      calificacion: { exerciseId: 'AN1#1#2', r: 1, pistas: 0, justificacion: 'Bien.' },
    });
    await expect(
      turn({ current: { exerciseId: 'AN1#1#1', source: 'nota' } }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(await h.prisma.exerciseAttempt.count({ where: { userId: h.userId } })).toBe(0);
  });

  it('refuses a reply that is not usable', async () => {
    claude.replies.push({
      mensaje: 'x',
      accion: 'calificar',
      calificacion: { exerciseId: 'AN1#1#1', r: 0.7, pistas: 0, justificacion: '' },
    });
    await expect(
      turn({ current: { exerciseId: 'AN1#1#1', source: 'nota' } }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('gives a generated exercise the engine’s b, not Claude’s, and a gen id', async () => {
    // Section 3 has one 🟡 (b 0), more than the margin away from b* ≈ −1.39: the engine asks Claude.
    claude.replies.push({
      mensaje: 'Aquí va uno nuevo.',
      accion: 'proponer_ejercicio',
      ejercicioGenerado: { enunciado: 'Muestra que $1/n\\to0$.', respuesta: 'Arquimediana.', b: 2 },
    });
    const result = await turn({ section: '3' });
    expect(claude.requests[0].prompt).toContain('escribe uno nuevo');
    expect(result.current).toMatchObject({
      source: 'generado',
      statement: 'Muestra que $1/n\\to0$.',
    });
    expect(result.current!.exerciseId).toMatch(/^AN1#gen-[0-9a-f]{8}$/);
    expect(result.current!.b).toBeCloseTo(-Math.log(0.8 / 0.2), 10);
    expect(result.generateAt).toBeNull();

    // Grading it next turn records the generated statement with the attempt.
    claude.replies.push({
      mensaje: 'Correcto.',
      accion: 'calificar',
      calificacion: {
        exerciseId: result.current!.exerciseId,
        r: 1,
        pistas: 0,
        justificacion: 'Bien.',
      },
    });
    const graded = await turn({
      section: '3',
      sessionId: result.sessionId,
      current: {
        exerciseId: result.current!.exerciseId,
        source: 'generado',
        b: result.current!.b,
        statement: result.current!.statement,
        answer: result.current!.answer ?? undefined,
      },
    });
    expect(graded.attempt).toMatchObject({ exerciseSource: 'generado', r: 1 });
    const row = await h.prisma.exerciseAttempt.findFirstOrThrow({ where: { userId: h.userId } });
    expect(row.generatedStatement).toBe('Muestra que $1/n\\to0$.');
  });

  it('ignores a generated exercise the engine did not ask for', async () => {
    claude.replies.push({
      mensaje: 'Otro.',
      accion: 'proponer_ejercicio',
      ejercicioGenerado: { enunciado: 'Algo.', respuesta: 'x', b: 0 },
    });
    const result = await turn({ current: { exerciseId: 'AN1#1#1', source: 'nota' } });
    expect(result.current?.exerciseId).toBe('AN1#1#1');
    expect(result.warnings.join(' ')).toContain('se ignoró');
  });

  it('resumes its own conversation and starts a new one for an unknown id', async () => {
    claude.replies.push(
      { mensaje: 'a', accion: 'explicar' },
      { mensaje: 'b', accion: 'explicar' },
      { mensaje: 'c', accion: 'explicar' },
    );
    const first = await turn({});
    const second = await turn({ sessionId: first.sessionId });
    expect(claude.requests[1]).toMatchObject({ sessionId: first.sessionId, resume: true });
    expect(second.warnings).toEqual([]);

    const foreign = await turn({ sessionId: '00000000-0000-4000-8000-000000000000' });
    expect(claude.requests[2].resume).toBe(false);
    expect(foreign.sessionId).not.toBe('00000000-0000-4000-8000-000000000000');
    expect(foreign.warnings.join(' ')).toContain('conversación');
  });

  it('answers 429 while a turn of the same user is running', async () => {
    let open!: () => void;
    claude.gate = new Promise((resolve) => (open = resolve));
    claude.replies.push({ mensaje: 'a', accion: 'explicar' });
    const running = turn({});
    await expect(turn({})).rejects.toMatchObject({ status: 429 });
    open();
    await expect(running).resolves.toMatchObject({ mensaje: 'a' });
  });

  it('answers 503 and records nothing when the Claude CLI is missing', async () => {
    const prisma = h.prisma as unknown as PrismaService;
    const missing = new TutorService(
      new ClaudeCliTutor({
        claudeBin: join(vault, 'no-such-claude.exe'),
        model: 'opus',
        timeoutMs: 10_000,
        vault,
        promptPath: join(vault, 'profesor.md'),
        workDir: join(vault, 'work'),
      }),
      new TutorGameService(prisma, new TutorCatalog(vault)),
      h.service,
      prisma,
    );
    const error = await missing
      .turn(h.userId, 'pc', { noteCode: 'AN1', section: '1', message: 'Hola' } as TutorTurnDto)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as HttpException).getResponse())).toContain('tutor_unavailable');
    expect(await h.prisma.exerciseAttempt.count({ where: { userId: h.userId } })).toBe(0);
  });

  it('rejects a section the note does not have', async () => {
    await expect(turn({ section: '9' })).rejects.toMatchObject({ status: 400 });
  });

  it('shows the section state and the next exercise without Claude', async () => {
    const state = await tutor.state(h.userId, { noteCode: 'AN1', section: '1' });
    expect(state).toMatchObject({ theta: 0, xp: 0, attempts: 0, level: 3, review: [] });
    expect(state.next).toMatchObject({ type: 'catalog', exercise: { id: 'AN1#1#3' } });
    expect(state.bosses.map((b) => [b.exerciseId, b.unlocked])).toEqual([
      ['AN1#cierre-rojo#D1', false],
    ]);
    expect(claude.requests).toHaveLength(0);
  });
});
