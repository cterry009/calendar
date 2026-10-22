import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { noteCodeOf, noteSections, parseExercises } from './exercises.js';

// Trimmed straight from the user's vault (Fundamentos/Analisis/AN1_analisis_real.md).
const AN1 = `# AN1 — Análisis real

## Cómo usar los ejercicios de esta nota

**🟢 Sencillo.** Esto no es un ejercicio: está fuera de una sección numerada.

## 1. Los números reales

**🟢 Sencillo.** Calcula $\\sup A$ e $\\inf A$ para $A=\\{1-1/n: n\\in\\mathbb{N}\\}$. ¿Pertenecen a $A$?

*(tu respuesta aquí)*

> [!success]- Respuesta
> $\\inf A=0$ (se alcanza en $n=1$).
> Pero $1\\notin A$: el supremo no tiene por qué pertenecer al conjunto.

### 1.4 Consecuencias del axioma del supremo

**🟡 Medio.** Demuestra que entre dos reales $a<b$ hay un **irracional**.

*(tu respuesta aquí)*

> [!success]- Respuesta
> Por densidad de $\\mathbb{Q}$ hay infinitos racionales entre $a/\\sqrt2$ y $b/\\sqrt2$.

> [!question]- Verdadero o falso (respuestas dentro)
> 1. Si $c,d$ son irracionales, $c+d$ es irracional. — **Falso:** $\\sqrt2+(-\\sqrt2)=0$.
> 2. Si $a^3>0$, entonces $a>0$. — **Verdadero:** si $a\\le0$, $a^3=a\\cdot a^2\\le0$.

## 3. Sucesiones y series en $\\mathbb{R}$

**🟡 Medio.** Muestra que $x_1=1$, $x_{n+1}=\\sqrt{2+x_n}$ converge y calcula su límite.

*(tu respuesta aquí)*

> [!success]- Respuesta
> Es creciente y acotada por 2; el límite cumple $L=\\sqrt{2+L}$, así que $L=2$.

## Cierre — 🔴 Difícil

**D1 (Cauchy ⇒ converge en $\\mathbb{R}$).** Completa la prueba de que en $\\mathbb{R}$ toda sucesión de Cauchy converge.

*(tu intento aquí)*

> [!tip]- Pista
> Tres pasos: acotada, Bolzano-Weierstrass, desigualdad triangular.

> [!success]- Solución
> (1) Con $\\varepsilon=1$ la sucesión está acotada.
> (2) Por Bolzano-Weierstrass existe $x_{n_k}\\to x$.

**D2 (Picard-Lindelöf).** Sea $f:\\mathbb{R}\\to\\mathbb{R}$ Lipschitz con constante $L$.

*(tu intento aquí)*

> [!tip]- Pista
> Estima $|(Tx)(t)-(Ty)(t)|$ y usa Lipschitz.

> [!success]- Solución
> Por Banach hay un único punto fijo. $\\blacksquare$

## Cierre — ⚫ Muy difícil

**M1.** Prueba que $S^2$ no puede cubrirse con una sola carta.

*(tu intento aquí)*

> [!tip]- Pista
> Compacidad.

> [!success]- Solución
> $S^2$ es compacta y $\\mathbb{R}^2$ no. $\\blacksquare$

## Todo

**🟢 Sencillo.** Tampoco cuenta: "## Todo" corta el contexto.
`;

// Pillar notes keep their sections under "## Desarrollo" (Redes complejas/B1_fundamentos_network_science.md).
const B1 = `# B1 — Fundamentos de network science

## Temario

1. Grafos.

## Desarrollo

### 1. Grafos y matriz de adyacencia

**🟢 Sencillo.** Grafo con enlaces 1-2, 2-3, 3-1, 3-4. Escribe $A$ y $\\langle k\\rangle$.

*(tu respuesta aquí)*

> [!success]- Respuesta
> $\\langle k\\rangle=2$.

### 4. Clustering

**🟢 Sencillo.** En el grafo de la sección 1, calcula $C_3$.

> [!success]- Respuesta
> $C_3=1/3$.

## Cierre — 🔴 Difícil

**D1.** Deriva $S=1-e^{-\\langle k\\rangle S}$.

> [!tip]- Pista
> Usa $u$.

> [!success]- Solución
> $S=1-u$.
`;

describe('noteCodeOf', () => {
  it('takes the file name prefix before the first underscore', () => {
    expect(noteCodeOf('AN1_analisis_real.md')).toBe('AN1');
    expect(noteCodeOf('Fundamentos/Matematicas/00b_fundamentos_teoria_conjuntos.md')).toBe('00b');
  });
});

describe('parseExercises', () => {
  const exercises = parseExercises('AN1_analisis_real.md', AN1);
  const byId = (id: string) => exercises.find((e) => e.id === id)!;

  it('reads every exercise inside sections and closings, in order, with stable ids', () => {
    expect(exercises.map((e) => e.id)).toEqual([
      'AN1#1#1',
      'AN1#1#2',
      'AN1#1#3',
      'AN1#3#1',
      'AN1#cierre-rojo#D1',
      'AN1#cierre-rojo#D2',
      'AN1#cierre-negro#M1',
    ]);
    expect(exercises.map((e) => e.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('gives each kind its starting difficulty', () => {
    expect(exercises.map((e) => [e.kind, e.b0])).toEqual([
      ['sencillo', -1],
      ['medio', 0],
      ['vf', -1.5],
      ['medio', 0],
      ['dificil', 1],
      ['dificil', 1],
      ['muy_dificil', 2],
    ]);
  });

  it('keeps a ### subsection inside its numbered section', () => {
    expect(byId('AN1#1#2').section).toBe('1');
  });

  it('separates the statement from the answer, without the placeholder, with LaTeX intact', () => {
    const first = byId('AN1#1#1');
    expect(first.statement).toBe(
      'Calcula $\\sup A$ e $\\inf A$ para $A=\\{1-1/n: n\\in\\mathbb{N}\\}$. ¿Pertenecen a $A$?',
    );
    expect(first.answer).toBe(
      '$\\inf A=0$ (se alcanza en $n=1$).\nPero $1\\notin A$: el supremo no tiene por qué pertenecer al conjunto.',
    );
    expect(first.hint).toBeNull();
    expect(first.title).toBeNull();
  });

  it('turns a true/false callout into one exercise whose statement hides the verdicts', () => {
    const vf = byId('AN1#1#3');
    expect(vf.statement).toBe(
      '1. Si $c,d$ son irracionales, $c+d$ es irracional.\n2. Si $a^3>0$, entonces $a>0$.',
    );
    expect(vf.answer).toContain('**Falso:** $\\sqrt2+(-\\sqrt2)=0$.');
    expect(vf.answer).toContain('**Verdadero:**');
  });

  it('reads closing items with title, hint and solution apart', () => {
    const d1 = byId('AN1#cierre-rojo#D1');
    expect(d1.title).toBe('Cauchy ⇒ converge en $\\mathbb{R}$');
    expect(d1.statement).toBe(
      'Completa la prueba de que en $\\mathbb{R}$ toda sucesión de Cauchy converge.',
    );
    expect(d1.hint).toBe('Tres pasos: acotada, Bolzano-Weierstrass, desigualdad triangular.');
    expect(d1.answer).toBe(
      '(1) Con $\\varepsilon=1$ la sucesión está acotada.\n(2) Por Bolzano-Weierstrass existe $x_{n_k}\\to x$.',
    );
    expect(byId('AN1#cierre-rojo#D2').title).toBe('Picard-Lindelöf');
    expect(byId('AN1#cierre-negro#M1')).toMatchObject({
      section: 'cierre-negro',
      title: null,
      statement: 'Prueba que $S^2$ no puede cubrirse con una sola carta.',
      hint: 'Compacidad.',
    });
  });

  it('reads pillar notes whose sections are ### N. under ## Desarrollo', () => {
    const pillar = parseExercises('B1_fundamentos_network_science.md', B1);
    expect(pillar.map((e) => e.id)).toEqual(['B1#1#1', 'B1#4#1', 'B1#cierre-rojo#D1']);
    expect(pillar[1].answer).toBe('$C_3=1/3$.');
  });

  it('gives the same result when parsed twice', () => {
    expect(parseExercises('AN1_analisis_real.md', AN1)).toEqual(exercises);
  });

  it('reads CRLF files the same way', () => {
    expect(parseExercises('AN1_analisis_real.md', AN1.replace(/\n/g, '\r\n'))).toEqual(exercises);
  });
});

// The real notes, when the vault is on this machine (CALENDAR_VAULT, as in the import scripts).
const vault = process.env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica');

function findNote(dir: string, prefix: string): string | null {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const found = findNote(path, prefix);
      if (found) return found;
    } else if (name.startsWith(prefix) && name.endsWith('.md')) {
      return path;
    }
  }
  return null;
}

const an1Path = existsSync(vault) ? findNote(vault, 'AN1_') : null;
(an1Path ? describe : describe.skip)('parseExercises on the real vault', () => {
  it('finds 20 🟢 and 32 🟡 in AN1, every one with an answer', () => {
    const exercises = parseExercises('AN1_analisis_real.md', readFileSync(an1Path!, 'utf8'));
    expect(exercises.filter((e) => e.kind === 'sencillo')).toHaveLength(20);
    expect(exercises.filter((e) => e.kind === 'medio')).toHaveLength(32);
    expect(exercises.filter((e) => e.answer === null)).toEqual([]);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(exercises.length);
  });
});

describe('noteSections', () => {
  it('gives each section the line range that holds its exercises', () => {
    const lines = AN1.split('\n');
    const sections = noteSections(AN1);
    expect(sections.map((s) => s.section)).toEqual(['1', '3', 'cierre-rojo', 'cierre-negro']);
    for (const exercise of parseExercises('AN1_analisis_real.md', AN1)) {
      const range = sections.find((s) => s.section === exercise.section)!;
      const firstLine = exercise.statement.split('\n')[0];
      const at = lines.findIndex((l) => l.includes(firstLine)) + 1;
      expect(at).toBeGreaterThanOrEqual(range.startLine);
      expect(at).toBeLessThanOrEqual(range.endLine);
    }
  });

  it('starts at the heading and ends before the blank lines and the next level-2 heading', () => {
    const lines = AN1.split('\n');
    const first = noteSections(AN1)[0];
    expect(first.title).toBe('1. Los números reales');
    expect(lines[first.startLine - 1]).toBe('## 1. Los números reales');
    expect(lines[first.endLine - 1]).toMatch(/^> 2\. Si \$a\^3>0\$/);
    expect(lines[first.endLine]).toBe('');
  });

  it('reads pillar sections under ## Desarrollo', () => {
    expect(noteSections(B1).map((s) => [s.section, s.title])).toEqual([
      ['1', '1. Grafos y matriz de adyacencia'],
      ['4', '4. Clustering'],
      ['cierre-rojo', 'Cierre — 🔴 Difícil'],
    ]);
  });
});
