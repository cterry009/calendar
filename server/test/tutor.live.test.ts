import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import { TutorCatalog } from '../src/tutor/catalog';
import type { TutorTurnDto } from '../src/tutor/dto/tutor-turn.dto';
import { TutorGameService } from '../src/tutor/tutor-game.service';
import { ClaudeCliTutor } from '../src/tutor/tutor-model';
import { tutorConfig } from '../src/tutor/tutor.config';
import { TutorService } from '../src/tutor/tutor.service';
import { useSyncHarness } from './harness';

// The real Claude Code CLI, logged in on this machine: one Opus turn (~20 s, counts against the
// user's quota), so it only runs with TUTOR_LIVE=1. Checks the whole pipe: arguments, JSON schema,
// structured output, validation and the recorded attempt.
const NOTE = `# AN1 — Análisis real

## 1. Los números reales

**🟢 Sencillo.** Calcula $\\sup A$ e $\\inf A$ para $A=\\{1-1/n: n\\in\\mathbb{N}\\}$. ¿Pertenecen a $A$?

*(tu respuesta aquí)*

> [!success]- Respuesta
> $\\inf A=0$ (se alcanza en $n=1$, así que $0\\in A$). $\\sup A=1$: es cota superior porque $1-1/n<1$, y para $\\varepsilon>0$ existe $n>1/\\varepsilon$ con $1-1/n>1-\\varepsilon$. Pero $1\\notin A$.
`;

describe.skipIf(!process.env.TUTOR_LIVE)('tutor with the real Claude CLI', () => {
  const h = useSyncHarness();

  it('grades a complete answer and records it', { timeout: 240_000 }, async () => {
    const vault = mkdtempSync(join(tmpdir(), 'tutor-live-'));
    mkdirSync(join(vault, 'Fundamentos'), { recursive: true });
    writeFileSync(join(vault, 'Fundamentos', 'AN1_analisis_real.md'), NOTE, 'utf8');
    const prisma = h.prisma as unknown as PrismaService;
    const tutor = new TutorService(
      new ClaudeCliTutor({ ...tutorConfig(), vault }),
      new TutorGameService(prisma, new TutorCatalog(vault)),
      h.service,
      prisma,
    );

    const started = Date.now();
    const result = await tutor.turn(h.userId, 'pc', {
      noteCode: 'AN1',
      section: '1',
      current: { exerciseId: 'AN1#1#1', source: 'nota' },
      message:
        'inf A = 0 y se alcanza en n = 1, así que 0 ∈ A. sup A = 1: 1 − 1/n < 1 para todo n, y dado ε > 0 ' +
        'la propiedad arquimediana da n > 1/ε, con 1 − 1/n > 1 − ε. Pero 1 ∉ A porque 1/n > 0.',
    } as TutorTurnDto);
    console.log(`live tutor turn: ${Date.now() - started} ms`, JSON.stringify(result.attempt));

    expect(result.accion).toBe('calificar');
    expect(result.attempt).toMatchObject({ exerciseId: 'AN1#1#1', r: 1, gradedBy: 'claude' });
    expect(await h.prisma.exerciseAttempt.count({ where: { userId: h.userId } })).toBe(1);
  });
});
