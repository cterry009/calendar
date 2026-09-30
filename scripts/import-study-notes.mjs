#!/usr/bin/env node
// Imports the study plan from the Obsidian vault ("Notas de Fisica") as tasks: one task per pensum
// session, sized in pomodoros, so the notes show up in the app as blocks of work.
//
// Usage (from the repo root, after `npm run build` in packages/shared):
//   node scripts/import-study-notes.mjs                 # dry run: prints what it would create
//   node scripts/import-study-notes.mjs --apply         # creates the missing tasks
//
// Options / env:
//   --vault <path>    CALENDAR_VAULT     default: %USERPROFILE%/Documents/Notas de Fisica
//   --api <url>       CALENDAR_API_URL   default: http://localhost:3000
//   --email <email>   CALENDAR_EMAIL     default: dev@local.test
//   CALENDAR_PASSWORD (env only, so it never lands in shell history as an argument)
//   --pomodoros-per-session <n>          default: 2 (one ~90 min session = one work block = 2 x 40)
//
// Re-running is safe: each session has a stable id (`note:<pensum>#<note>#<n>`), and sessions that
// already exist as tasks are skipped, never overwritten -- a task you completed or edited in the
// app stays as you left it. Deciding which sessions go into which block and in what priority is
// deliberately not done here (see tasks.md: the AI planning step).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parsePensum, unitPomodoros } from '../packages/shared/dist/index.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const apply = process.argv.includes('--apply');
const vault = arg('vault', process.env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica'));
const api = arg('api', process.env.CALENDAR_API_URL ?? 'http://localhost:3000');
const email = arg('email', process.env.CALENDAR_EMAIL ?? 'dev@local.test');
const password = process.env.CALENDAR_PASSWORD ?? 'devpassword123';
const pomodorosPerSession = Number(arg('pomodoros-per-session', '2'));
const POMODORO_MINUTES = 40;

function findPensums(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...findPensums(path));
    else if (/^pensum_.*\.md$/i.test(name)) out.push(path);
  }
  return out;
}

// "Pensum — Pilar A: entropía de Tsallis y q-estadística" -> "Pilar A"
// "Pensum: análisis real, funcional, armónico y complejo" -> "Análisis real, funcional, ..."
function categoryFor(pensumTitle) {
  const rest = pensumTitle.replace(/^Pensum\s*[—:-]\s*/i, '');
  const pillar = /^(Pilar [A-Z])/.exec(rest);
  if (pillar) return pillar[1];
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function toTask(unit) {
  const pomodoros = unitPomodoros(unit, pomodorosPerSession);
  const sessions = unit.sessionsMin === unit.sessionsMax ? `${unit.sessionsMax}` : `${unit.sessionsMin}-${unit.sessionsMax}`;
  const parts = [
    `${unit.pensumTitle} — ${unit.blockTitle}`,
    unit.sections ? `Secciones: ${unit.sections.replace(/^secci[oó]n(es)?\s+/i, '')}.` : null,
    `${sessions} sesión(es) de ~90 min.`,
    unit.isOptional ? 'Opcional si vas rápido.' : null,
    `Origen: ${unit.pensum}`,
  ].filter(Boolean);
  return {
    clientId: `note:${unit.key}`,
    updatedAt: new Date().toISOString(),
    title: `${unit.noteCode ?? unit.blockTitle} · ${unit.topic}`,
    description: parts.join('\n'),
    estimatedPomodoros: pomodoros,
    estimatedMinutes: pomodoros * POMODORO_MINUTES,
    difficulty: unit.isHardClosing ? 'HARD' : 'MEDIUM',
    priority: unit.isOptional ? 'LOW' : 'MEDIUM',
    category: categoryFor(unit.pensumTitle),
    status: 'PENDING',
  };
}

async function request(path, init = {}, token) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const units = findPensums(vault).flatMap((file) =>
  parsePensum(file.split(/[\\/]/).pop(), readFileSync(file, 'utf8')),
);
const tasks = units.map(toTask);

const { accessToken } = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password, deviceLabel: 'import-study-notes', devicePlatform: 'WEB' }),
});
const snapshot = await request('/sync/pull', {}, accessToken);
const existing = new Set(snapshot.tasks.map((t) => t.clientId).filter(Boolean));
const missing = tasks.filter((t) => !existing.has(t.clientId));

const byCategory = new Map();
for (const t of tasks) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.estimatedPomodoros);
console.log(`Vault: ${vault}`);
console.log(`${units.length} sesiones en ${new Set(units.map((u) => u.pensum)).size} pensums; ${existing.size ? tasks.length - missing.length : 0} ya importadas, ${missing.length} nuevas.`);
for (const [category, pomodoros] of byCategory) console.log(`  ${category}: ${pomodoros} pomodoros`);
for (const t of missing.slice(0, 5)) console.log(`  + ${t.title} (${t.estimatedPomodoros} pomodoros, ${t.priority}, ${t.difficulty})`);
if (missing.length > 5) console.log(`  ... y ${missing.length - 5} más`);

// No process.exit(): on Windows it can abort with a libuv assertion while fetch keep-alive
// sockets are still closing. Falling off the end of the module exits cleanly.
if (!apply) {
  console.log('\nModo prueba: no se creó nada. Agrega --apply para crearlas.');
} else {
  // Batches of 50 so a single request never gets huge.
  let created = 0;
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50).map((t) => ({ ...t, clientId: t.clientId ?? randomUUID() }));
    const result = await request('/sync/batch', { method: 'POST', body: JSON.stringify({ tasks: batch }) }, accessToken);
    created += (result.applied?.tasks ?? []).filter((r) => r.status === 'applied').length;
  }
  console.log(`\nCreadas: ${created}.`);
}
