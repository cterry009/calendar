import { parsePensum, unitPomodoros } from './pensum.js';

// Trimmed straight from the user's vault (Fundamentos/pensum_analisis.md).
const SAMPLE = `# Pensum: análisis real, funcional, armónico y complejo

Cubre [[AN1_analisis_real|AN1]] → [[AN2_analisis_funcional|AN2]]. Total estimado: 25-31 sesiones de ~90 min.

## Bloque 1 — Análisis real (AN1)
**7-9 sesiones**
1. Supremo, propiedad arquimediana, sucesiones de Cauchy y series (secciones 1-2) — 2 sesiones.
2. Espacios métricos, completitud y punto fijo de Banach (sección 3) — 1 sesión.
3. Compacidad y convergencia de funciones: puntual, uniforme, en media (secciones 4-5) — 1-2 sesiones.
6. Cierre difícil/muy difícil (Picard-Lindelöf, $C[0,1]$ no completo en $L^1$, derivar $\\ln Z$) — 1 sesión.

## Bloque 4 — Análisis complejo (AN4)
**5-6 sesiones**
5. Cierre difícil/muy difícil — incluido en las sesiones anteriores o 1 sesión extra.

## Cómo encaja con el resto

- Si el tiempo aprieta, la ruta mínima es AN1 §3 — unas 14-16 sesiones.
`;

describe('parsePensum', () => {
  const units = parsePensum('pensum_analisis.md', SAMPLE);

  it('reads every numbered session item under a block, and nothing after the blocks', () => {
    expect(units.map((u) => u.key)).toEqual([
      'pensum_analisis.md#AN1#1',
      'pensum_analisis.md#AN1#2',
      'pensum_analisis.md#AN1#3',
      'pensum_analisis.md#AN1#6',
      'pensum_analisis.md#AN4#5',
    ]);
  });

  it('keeps the pensum and block titles and the note code', () => {
    expect(units[0]).toMatchObject({
      pensumTitle: 'Pensum: análisis real, funcional, armónico y complejo',
      blockNumber: 1,
      blockTitle: 'Análisis real',
      noteCode: 'AN1',
    });
  });

  it('splits the topic from its sections and reads single and ranged session counts', () => {
    expect(units[0]).toMatchObject({
      topic: 'Supremo, propiedad arquimediana, sucesiones de Cauchy y series',
      sections: 'secciones 1-2',
      sessionsMin: 2,
      sessionsMax: 2,
    });
    expect(units[1]).toMatchObject({ sections: 'sección 3', sessionsMin: 1, sessionsMax: 1 });
    expect(units[2]).toMatchObject({ sessionsMin: 1, sessionsMax: 2 });
  });

  it('flags the hard closing sessions and reads counts buried in prose', () => {
    expect(units[3].isHardClosing).toBe(true);
    expect(units[3].sections).toBeNull();
    expect(units[4]).toMatchObject({ isHardClosing: true, sessionsMax: 1 });
  });

  it('turns sessions into pomodoros per work block', () => {
    expect(unitPomodoros(units[2], 2)).toBe(4);
  });
});

// From Tsallis y q-estadistica/pensum_pilar_A.md: code-first headings, closing mid-topic, optional.
const PILLAR = `# Pensum — Pilar A: entropía de Tsallis y q-estadística

## A1 — La entropía $S_q$
**2-3 sesiones**
1. Motivación y definición: BG y su aditividad — 1 sesión.
3. Aditividad vs extensividad; criterio $q=1-1/\\rho$; cierre 🔴/⚫ — 1 sesión (opcional si vas rápido).

## A2 — Funciones y álgebra $q$
**1-2 sesiones**
1. $\ln_q$ y $e_q$: definiciones — 1 sesión.

## Punto de control al terminar
1. Algo que no es una sesión — 1 sesión.
`;

describe('parsePensum (pillar format)', () => {
  const units = parsePensum('pensum_pilar_A.md', PILLAR);

  it('reads code-first headings and numbers the blocks in order', () => {
    expect(units.map((u) => [u.noteCode, u.blockNumber, u.blockTitle])).toEqual([
      ['A1', 1, 'La entropía $S_q$'],
      ['A1', 1, 'La entropía $S_q$'],
      ['A2', 2, 'Funciones y álgebra $q$'],
    ]);
  });

  it('spots a closing mentioned mid-topic and an optional session', () => {
    expect(units[1]).toMatchObject({ isHardClosing: true, isOptional: true, sessionsMax: 1 });
    expect(units[0]).toMatchObject({ isHardClosing: false, isOptional: false });
  });
});
