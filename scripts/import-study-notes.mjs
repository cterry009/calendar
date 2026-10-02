#!/usr/bin/env node
// Imports the study plan from the Obsidian vault ("Notas de Fisica") as tasks: one task per study
// session (one ~90 min work block), so every task fits a block (docs/planning/normas-de-atencion.md,
// section 3). A pensum unit of "2 sesiones" becomes two tasks, "(1/2)" and "(2/2)".
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
// Re-running is safe: each session has a stable id -- `note:<pensum>#<note>#<n>` for a one-session
// unit, `note:<pensum>#<note>#<n>.<k>` for session k of a longer one -- and sessions that already
// exist as tasks are skipped, never overwritten: a task you completed or edited stays as you left it.
//
// The vault is the source of truth. An imported task that no longer matches it is replaced: a unit
// imported before the split (2026-10-02) as one multi-session task, or an id whose topic changed
// because the pensum was restructured (AN1 was, on 2026-10-02). Only while that task is still
// pending, unscheduled and not started; one already on the calendar or done is left alone. Which
// block each session goes in is the planner's job, and the server adds its attention rating.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parsePensum } from '../packages/shared/dist/index.js';

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

/** One task per session of the unit (sessionsMax of them; the ones past sessionsMin may not be needed). */
function toTasks(unit) {
  const count = Math.max(1, unit.sessionsMax);
  const title = `${unit.noteCode ?? unit.blockTitle} · ${unit.topic}`;
  return Array.from({ length: count }, (_, i) => {
    const k = i + 1;
    const parts = [
      `${unit.pensumTitle} — ${unit.blockTitle}`,
      unit.sections ? `Secciones: ${unit.sections.replace(/^secci[oó]n(es)?\s+/i, '')}.` : null,
      count > 1 ? `Sesión ${k} de ${count} (~90 min).` : 'Una sesión de ~90 min.',
      k > unit.sessionsMin ? 'Puede no hacer falta si las anteriores alcanzaron.' : null,
      unit.isOptional ? 'Opcional si vas rápido.' : null,
      `Origen: ${unit.pensum}`,
    ].filter(Boolean);
    return {
      clientId: count > 1 ? `note:${unit.key}.${k}` : `note:${unit.key}`,
      /** The id this unit had when it was one multi-session task (before 2026-10-02). */
      wholeUnitId: `note:${unit.key}`,
      updatedAt: new Date().toISOString(),
      title: count > 1 ? `${title} (${k}/${count})` : title,
      description: parts.join('\n'),
      estimatedPomodoros: pomodorosPerSession,
      estimatedMinutes: pomodorosPerSession * POMODORO_MINUTES,
      difficulty: unit.isHardClosing ? 'HARD' : 'MEDIUM',
      priority: unit.isOptional ? 'LOW' : 'MEDIUM',
      category: categoryFor(unit.pensumTitle),
      status: 'PENDING',
      // A re-created id reuses the server row, which still carries the old topic's attention
      // rating; clear it so the server rates the session again (reference label or Gemini).
      attentionReentry: null,
      attentionLoad: null,
      attentionProfile: null,
      attentionSource: null,
      attentionReason: null,
    };
  });
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
const tasks = units.flatMap(toTasks);

const { accessToken } = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password, deviceLabel: 'import-study-notes', devicePlatform: 'WEB' }),
});
const snapshot = await request('/sync/pull', {}, accessToken);
const live = snapshot.tasks.filter((t) => !t.deletedAt);
const byClientId = new Map(live.map((t) => [t.clientId, t]));

// What the vault says now, by id.
const wanted = new Map(tasks.map((t) => [t.clientId, t]));
const touchable = (t) => t.status === 'PENDING' && !t.scheduledAt;

// Imported tasks that no longer match the vault: a whole unit that's now split, an id whose topic
// changed, or a session the vault no longer has.
const stale = live.filter((t) => t.clientId?.startsWith('note:') && wanted.get(t.clientId)?.title !== t.title);
const toReplace = stale.filter(touchable);
// A stale task the user already scheduled or started stays, and its unit isn't re-added beside it.
const keepWhole = new Set(stale.filter((t) => !touchable(t)).map((t) => t.clientId.replace(/\.\d+$/, '')));
const replaced = new Set(toReplace.map((t) => t.clientId));

const missing = tasks
  .filter((t) => (!byClientId.has(t.clientId) || replaced.has(t.clientId)) && !keepWhole.has(t.wholeUnitId))
  .map(({ wholeUnitId, ...task }) => task);

const byCategory = new Map();
for (const t of tasks) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.estimatedPomodoros);
console.log(`Vault: ${vault}`);
console.log(`${units.length} unidades, ${tasks.length} sesiones en ${new Set(units.map((u) => u.pensum)).size} pensums; ${tasks.length - missing.length} ya importadas, ${missing.length} nuevas.`);
if (toReplace.length) {
  console.log(`${toReplace.length} tareas ya no coinciden con la bóveda y se reemplazan:`);
  for (const t of toReplace) console.log(`  - ${t.title}${wanted.get(t.clientId) ? `  ->  ${wanted.get(t.clientId).title}` : '  (dividida en sesiones o retirada)'}`);
}
if (keepWhole.size) console.log(`${keepWhole.size} no coinciden pero se dejan como están (ya en el calendario o empezadas).`);
for (const [category, pomodoros] of byCategory) console.log(`  ${category}: ${pomodoros} pomodoros`);
for (const t of missing.slice(0, 5)) console.log(`  + ${t.title} (${t.estimatedPomodoros} pomodoros, ${t.priority}, ${t.difficulty})`);
if (missing.length > 5) console.log(`  ... y ${missing.length - 5} más`);

// No process.exit(): on Windows it can abort with a libuv assertion while fetch keep-alive
// sockets are still closing. Falling off the end of the module exits cleanly.
if (!apply) {
  console.log('\nModo prueba: no se creó nada. Agrega --apply para crearlas.');
} else {
  if (toReplace.length) {
    const now = new Date().toISOString();
    const result = await request(
      '/sync/batch',
      { method: 'POST', body: JSON.stringify({ tasks: toReplace.map((t) => ({ id: t.id, updatedAt: now, deleted: true })) }) },
      accessToken,
    );
    console.log(`\nReemplazadas: ${(result.applied?.tasks ?? []).filter((r) => r.status === 'applied').length}.`);
  }
  // Batches of 50 so a single request never gets huge.
  let created = 0;
  for (let i = 0; i < missing.length; i += 50) {
    // Stamped now, after the deletes above: a re-created id must be newer than its own deletion,
    // or the server keeps the deleted row (updatedAt wins).
    const batch = missing.slice(i, i + 50).map((t) => ({ ...t, updatedAt: new Date().toISOString(), clientId: t.clientId ?? randomUUID() }));
    const result = await request('/sync/batch', { method: 'POST', body: JSON.stringify({ tasks: batch }) }, accessToken);
    created += (result.applied?.tasks ?? []).filter((r) => r.status === 'applied').length;
  }
  console.log(`\nCreadas: ${created}.`);
}
