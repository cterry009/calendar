import { describe, expect, it } from 'vitest';
import { attentionProfileFor as sharedProfileFor } from '../../packages/shared/src/attention/profiles';
import { anchorFor, attentionProfileFor, exampleAnchors, loadAttentionDocs, type Anchor } from '../src/planning/attention';
import { labelingRequest, parseRatings, rateWithModel } from '../src/planning/attention-labeler';
import { parseStructured, structureRequest, type StructureContext } from '../src/planning/task-structurer';

const anchor = (clave: string, R: number | null, C: number | null, tipo = 'teoria'): Anchor => ({
  clave, titulo: clave, tipo, R, C, perfil: R === null || C === null ? null : attentionProfileFor(R, C), porque: 'x',
});

describe('attention rating', () => {
  it('uses the same (R, C) -> profile table as packages/shared', () => {
    for (let r = 0; r <= 3; r++) for (let c = 0; c <= 3; c++) expect(attentionProfileFor(r, c)).toBe(sharedProfileFor(r, c));
  });

  it('agrees with every profile written in docs/planning/anclas.json', async () => {
    const { anclas, normas } = await loadAttentionDocs(`${__dirname}/../../docs/planning`);
    expect(normas).toContain('costo de reentrada');
    const rated = anclas.filter((a) => a.R !== null && a.C !== null);
    expect(rated.length).toBeGreaterThan(90);
    for (const a of rated) expect(a.perfil).toBe(attentionProfileFor(a.R!, a.C!));
  });

  it('finds the anchor for an imported session by clientId and for a loose task by title', () => {
    const anclas = [anchor('note:pensum_x.md#A1#1', 2, 2), anchor('titulo:Escribir reporte semanal', 1, 1)];
    expect(anchorFor(anclas, { clientId: 'note:pensum_x.md#A1#1', title: 'otro' })?.R).toBe(2);
    expect(anchorFor(anclas, { clientId: null, title: 'Escribir reporte semanal' })?.R).toBe(1);
    expect(anchorFor(anclas, { clientId: null, title: 'Nueva' })).toBeNull();
    // A session of a split unit takes the unit's label.
    expect(anchorFor(anclas, { clientId: 'note:pensum_x.md#A1#1.2', title: 'otro' })?.R).toBe(2);
  });

  it('picks examples covering every profile and type first', () => {
    const anclas = [anchor('a', 2, 2), anchor('b', 2, 2), anchor('c', 3, 3, 'cierre'), anchor('d', 0, 0, 'administrativo'), anchor('e', null, null, 'fisico')];
    expect(exampleAnchors(anclas, 3).map((a) => a.clave)).toEqual(['a', 'c', 'd']);
  });
});

describe('labeling with a model', () => {
  const tasks = [
    { id: 't0', title: 'Teorema de Darboux', category: 'Geometría', description: 'Pensum: geometría\nSecciones: 2.4' },
    { id: 't1', title: 'Enviar correos', category: null, description: null },
  ];

  it('sends the rubric, the examples and the tasks with short ids', () => {
    const { system, prompt } = labelingRequest({ normas: 'NORMAS', anclas: [anchor('a', 2, 2)] }, tasks);
    expect(system).toContain('NORMAS');
    expect(system).toContain('"a" → tipo teoria, R2, C2');
    expect(prompt).toContain('0. Teorema de Darboux (Geometría — Pensum: geometría)');
    expect(prompt).toContain('1. Enviar correos');
  });

  it('keeps only valid, in-range, non-duplicate answers', () => {
    const text = JSON.stringify({
      etiquetas: [
        { id: 0, tipo: 'teoria', R: 3, C: 3, porque: 'larga' },
        { id: 0, tipo: 'teoria', R: 1, C: 1, porque: 'duplicada' },
        { id: 1, tipo: 'administrativo', R: 4, C: 0, porque: 'fuera de rango' },
        { id: 7, tipo: 'x', R: 0, C: 0, porque: 'id inexistente' },
      ],
    });
    expect(parseRatings(text, tasks)).toEqual([{ taskId: 't0', tipo: 'teoria', reentry: 3, load: 3, reason: 'larga' }]);
  });

  it('falls through busy models and says which one answered', async () => {
    const notes: string[] = [];
    const ratings = await rateWithModel(
      { normas: '', anclas: [] },
      tasks,
      async ({ model }) => {
        if (model === 'busy') throw new Error('{"error":{"code":503,"message":"High demand. Later."}}');
        return JSON.stringify({ etiquetas: [{ id: 1, tipo: 'administrativo', R: 0, C: 0, porque: 'rutina' }] });
      },
      ['busy', 'ok'],
      notes,
    );
    expect(ratings.map((r) => r.taskId)).toEqual(['t1']);
    expect(notes).toEqual(['Etiquetas hechas con ok.', 'busy falló: 503 High demand']);
  });
});

describe('structuring a loose task', () => {
  const ctx: StructureContext = {
    rules: 'Estudio B1 = geometría',
    docs: { normas: 'NORMAS', anclas: [] },
    lines: [{ category: 'Geometría', pending: 12 }],
    blocks: [{ scheduleId: 'b1', label: 'Estudio B1', days: [1, 2], start: '09:00', end: '10:30' }],
  };
  const answer = {
    titulo: '02 · Darboux', descripcion: 'Rehacer la prueba.', categoria: 'Geometría', sesiones: 2, tipo: 'teoria',
    R: 3, C: 3, porque: 'Prueba larga.', scheduleId: 'b1', prioridad: 'HIGH', dificultad: 'HARD', pasos: ['Leer', 'Derivar'],
  };

  it('gives the model the rules, the rubric, the lines, the blocks and the text', () => {
    const { system, prompt } = structureRequest(ctx, 'repasar Darboux');
    expect(system).toContain('Estudio B1 = geometría');
    expect(system).toContain('NORMAS');
    expect(prompt).toContain('"category":"Geometría"');
    expect(prompt).toContain('"scheduleId":"b1"');
    expect(prompt).toContain('"repasar Darboux"');
  });

  it('takes the profile from the table and drops a block id that does not exist', () => {
    expect(parseStructured(JSON.stringify(answer), ctx)).toMatchObject({ profile: 'DEEP', sessions: 2, scheduleId: 'b1', priority: 'HIGH' });
    const invented = parseStructured(JSON.stringify({ ...answer, scheduleId: 'nope', R: 0, C: 0, sesiones: 40 }), ctx);
    expect(invented).toMatchObject({ profile: 'MECHANICAL', scheduleId: null, sessions: 6 });
    expect(() => parseStructured(JSON.stringify({ ...answer, R: 5 }), ctx)).toThrow(/R o C/);
  });
});
