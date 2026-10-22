#!/usr/bin/env node
// One-off import of the exercises graded in a chat with Claude while the app's tutor wasn't ready
// (user-requested, 2026-10-22): "Notas de Fisica/progreso_chat_2026-10-21_22.json". Each attempt
// becomes an ExerciseAttempt of the user, graded by 'claude' at the time in the file, so the study
// game (replayed from the attempts, study-tutor-game D6) counts them like the tutor's own.
//
// - exerciseSource "nota": a catalog exercise. It's looked up by note, section and statement (the
//   chat's statement is plain text, the note's is LaTeX: both are reduced to words and compared). Only
//   a clear match takes the catalog id; otherwise it goes in as 'generado' and is reported.
// - Everything else: 'generado', with its statement and the file's b.
// - Ids are stable (a hash of occurredAt + statement), so running it twice doesn't duplicate anything:
//   attempts are idempotent creates on their id.
//
// The session data of the 22nd (motivation/concentration diagnoses on 0-100, the pomodoro's final
// rating, the long pause) are calibration data for dynamic-study-blocks: they go in as CHECK_IN focus
// events, where that change keeps its check-ins, with their own `scope` so they never mix with the
// app's 1-5 ratings.
//
// Usage (from the repo root, after `npm run build:shared`, with the API up):
//   node scripts/import-chat-attempts.mjs              # dry run: prints what it would create
//   node scripts/import-chat-attempts.mjs --apply      # creates them
//
// Options / env (same as import-study-notes.mjs):
//   --file <path>                         default: <vault>/progreso_chat_2026-10-21_22.json
//   --vault <path>    CALENDAR_VAULT      default: %USERPROFILE%/Documents/Notas de Fisica
//   --api <url>       CALENDAR_API_URL    default: http://localhost:3000
//   --email <email>   CALENDAR_EMAIL      default: dev@local.test
//   CALENDAR_PASSWORD (env only)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { parseExercises } from '../packages/shared/dist/index.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const apply = process.argv.includes('--apply');
const vault = arg('vault', process.env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica'));
const file = arg('file', join(vault, 'progreso_chat_2026-10-21_22.json'));
const api = arg('api', process.env.CALENDAR_API_URL ?? 'http://localhost:3000');
const email = arg('email', process.env.CALENDAR_EMAIL ?? 'dev@local.test');
const password = process.env.CALENDAR_PASSWORD ?? 'devpassword123';

/** A clear catalog match needs this much word overlap, and this much more than the runner-up. */
const MATCH_MIN = 0.4;
const MATCH_MARGIN = 0.15;

const hash = (text) => createHash('sha256').update(text).digest('hex');

// ─── Matching chat statements to the notes' exercises ─────────────────────

const LATEX = [
  [/\\mathbb\{R\}/g, 'ℝ'],
  [/\\mathbb\{N\}/g, 'ℕ'],
  [/\\mathbb\{Z\}/g, 'ℤ'],
  [/\\mathbb\{Q\}/g, 'ℚ'],
  [/\\to\b/g, '→'],
  [/\\cup\b/g, '∪'],
  [/\\cap\b/g, '∩'],
  [/\^\{-1\}/g, '⁻¹'],
  [/\^2/g, '²'],
  [/\\(big|Big|left|right)/g, ''],
  [/\\[a-zA-Z]+/g, ' '],
];

/** A statement as a set of lowercase words and math tokens, LaTeX or plain text alike. */
function words(text) {
  let t = text;
  for (const [re, to] of LATEX) t = t.replace(re, to);
  t = t.toLowerCase().replace(/[$*_{}\\]/g, ' ');
  return new Set(t.split(/[^\p{L}\p{N}ℝℕℤℚ→∪∩⁻¹²]+/u).filter((w) => w.length > 1 || /[\p{N}ℝℕℤℚ]/u.test(w)));
}

function overlap(a, b) {
  const inter = [...a].filter((w) => b.has(w)).length;
  // Shared words over the longer statement: a short note exercise sharing only "f(x)=x²" scores low.
  return inter / Math.max(a.size, b.size, 1);
}

function walkNotes(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name.startsWith('.') ? [] : walkNotes(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

const catalog = walkNotes(vault).flatMap((path) => parseExercises(basename(path), readFileSync(path, 'utf8')));

function catalogMatch(attempt) {
  const mine = words(attempt.statement);
  const candidates = catalog
    .filter((e) => e.noteCode === attempt.noteCode && e.section === attempt.section)
    .map((e) => ({ exercise: e, score: overlap(mine, words(e.statement ?? '')) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = candidates;
  if (!best || best.score < MATCH_MIN || (second && best.score - second.score < MATCH_MARGIN)) {
    return { exercise: null, best };
  }
  return { exercise: best.exercise, best };
}

// ─── Building the changes ────────────────────────────────────────────────

const data = JSON.parse(readFileSync(file, 'utf8'));
const attempts = [];
const report = { catalog: [], unmatched: [], generated: 0 };

for (const a of data.intentos) {
  const id = `chat-${hash(`${a.occurredAt}\n${a.statement}`).slice(0, 24)}`;
  const base = {
    id,
    noteCode: a.noteCode,
    section: String(a.section),
    r: a.r,
    hints: a.hints ?? 0,
    minutes: null,
    gradedBy: 'claude',
    supersedes: null,
    feedback: a.feedback || null,
    studyTaskId: null,
    pomodoroSessionId: null,
    occurredAt: new Date(a.occurredAt).toISOString(),
  };
  const generated = () => ({
    ...base,
    exerciseId: `${a.noteCode}#gen-${hash(a.statement).slice(0, 8)}`,
    exerciseSource: 'generado',
    b: a.b,
    generatedStatement: a.statement,
  });

  if (a.exerciseSource === 'nota') {
    const { exercise, best } = catalogMatch(a);
    if (exercise) {
      attempts.push({ ...base, exerciseId: exercise.id, exerciseSource: 'nota', b: exercise.b0, generatedStatement: null });
      report.catalog.push(`${exercise.id} (${best.score.toFixed(2)}) ← "${a.statement}"`);
      continue;
    }
    report.unmatched.push(
      `${a.noteCode} §${a.section}: "${a.statement}"${best ? ` (mejor: ${best.exercise.id}, ${best.score.toFixed(2)})` : ' (sin ejercicios en esa sección)'}`,
    );
  }
  attempts.push(generated());
  report.generated += 1;
}

// The session of the 22nd: calibration data for dynamic-study-blocks (scale 0-100, from the chat).
const focusEvents = [];
for (const s of data.sesiones ?? []) {
  s.pomodoros.forEach((p, i) => {
    const common = { source: 'chat', scale: '0-100', date: s.fecha, block: s.bloque, pomodoro: i + 1 };
    focusEvents.push({
      id: `chat-diag-${hash(`${p.inicio}#diag`).slice(0, 24)}`,
      kind: 'CHECK_IN',
      occurredAt: new Date(p.inicio).toISOString(),
      meta: {
        ...common,
        scope: 'chat-diagnosis',
        motivation: p.diagnostico.motivacion,
        concentration: p.diagnostico.concentracion,
        note: p.diagnostico.nota ?? undefined,
        focusMin: p.focoMin,
      },
    });
    focusEvents.push({
      id: `chat-rate-${hash(`${p.inicio}#rating`).slice(0, 24)}`,
      kind: 'CHECK_IN',
      occurredAt: new Date(p.fin).toISOString(),
      meta: {
        ...common,
        scope: 'chat-pomodoro-rating',
        rating: p.calificacionFinal,
        plannedFocusMin: p.focoMin,
        workedMin: Math.round((new Date(p.fin) - new Date(p.inicio)) / 60_000),
        comment: p.comentario || undefined,
      },
    });
  });
  for (const pause of s.pausas ?? []) {
    focusEvents.push({
      id: `chat-pause-${hash(`${pause.inicio}#pause`).slice(0, 24)}`,
      kind: 'CHECK_IN',
      occurredAt: new Date(pause.fin).toISOString(),
      meta: { source: 'chat', scope: 'chat-pause', date: s.fecha, block: s.bloque, plannedMin: pause.planeadaMin, realMin: pause.realMin },
    });
  }
  focusEvents.push({
    id: `chat-block-${hash(`${s.inicio}#block`).slice(0, 24)}`,
    kind: 'CHECK_IN',
    occurredAt: new Date(s.fin).toISOString(),
    meta: {
      source: 'chat',
      scope: 'chat-block',
      date: s.fecha,
      block: s.bloque,
      start: s.inicio,
      end: s.fin,
      focusMinutes: s.minutosFoco,
      fulfilled: s.cumplido,
    },
  });
}

// ─── Output ──────────────────────────────────────────────────────────────

console.log(`Archivo: ${file}`);
console.log(`Catálogo: ${catalog.length} ejercicios en el vault`);
console.log(`Intentos: ${attempts.length} (${report.catalog.length} del catálogo, ${report.generated} generados)`);
for (const line of report.catalog) console.log(`  catálogo  ${line}`);
if (report.unmatched.length) {
  console.log('Marcados "nota" que no encontré con seguridad (van como generados):');
  for (const line of report.unmatched) console.log(`  ⚠ ${line}`);
}
const byDay = {};
for (const a of attempts) byDay[a.occurredAt.slice(0, 10)] = (byDay[a.occurredAt.slice(0, 10)] ?? 0) + 1;
console.log(`Por día: ${Object.entries(byDay).map(([d, n]) => `${d}: ${n}`).join(', ')}`);
const byR = { 0: 0, 0.5: 0, 1: 0 };
for (const a of attempts) byR[a.r] += 1;
console.log(`Calificaciones: r=1 ${byR[1]}, r=½ ${byR[0.5]}, r=0 ${byR[0]}`);
console.log(`Datos de calibración (CHECK_IN, escala 0-100): ${focusEvents.length} eventos`);
for (const e of focusEvents) console.log(`  ${e.occurredAt} ${e.meta.scope} ${JSON.stringify(e.meta)}`);

if (!apply) {
  console.log('\nModo prueba: no se escribió nada. Con --apply se crean.');
} else {
  const login = await fetch(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, deviceLabel: 'import-chat-attempts', devicePlatform: 'WEB' }),
  });
  if (!login.ok) throw new Error(`login: ${login.status} ${await login.text()}`);
  const { accessToken } = await login.json();
  const res = await fetch(`${api}/sync/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ exerciseAttempts: attempts, focusEvents }),
  });
  if (!res.ok) throw new Error(`/sync/batch: ${res.status} ${await res.text()}`);
  const result = await res.json();
  const count = (k) => (result.applied?.[k] ?? []).length;
  console.log(`\nAplicado: ${count('exerciseAttempts')} intentos y ${count('focusEvents')} eventos (los que ya existían se saltan).`);
}
// No process.exit(): on Windows it can abort with a libuv assertion while fetch keep-alive
// sockets are closing (same as import-study-notes.mjs).
