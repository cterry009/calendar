#!/usr/bin/env node
// Writes the study status into the Obsidian vault ("Notas de Fisica") so the user, Claude or any
// other AI can read how the study plan is going without opening the app (user-requested,
// 2026-10-21): progress per pensum, study time per week, how the pomodoros were rated, and the
// plan's week, phase and milestones, and the study game per note (θ, levels, XP, bosses, review
// queue; study-tutor-game D25, replayed from the attempts against the vault's exercises). Two files
// with the same data, built by packages/shared/src/study-status/ (the server writes them by itself
// too since 2026-10-22, dynamic-study-blocks D18):
//   Estado_estudio.md     -- for reading in Obsidian; its "Notas" section is written by hand
//   estado_estudio.json   -- for an AI to read without parsing tables
//
// The data comes from the app (GET /sync/pull and GET /sync/focus-events), so a session only counts
// as done once it's marked done in the app (the end-of-block card, "¿terminaste la sesión?").
// Everything is regenerated on every run except the text between the `notas` markers, which is
// kept as it is.
//
// Usage (from the repo root, after `npm run build:shared`, with the API up):
//   node scripts/export-study-status.mjs              # writes both files into the vault
//   node scripts/export-study-status.mjs --dry-run    # prints the markdown instead
//
// Options / env (same as import-study-notes.mjs):
//   --vault <path>    CALENDAR_VAULT     default: %USERPROFILE%/Documents/Notas de Fisica
//   --api <url>       CALENDAR_API_URL   default: http://localhost:3000
//   --email <email>   CALENDAR_EMAIL     default: dev@local.test
//   CALENDAR_PASSWORD (env only)

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import {
  buildStudyStatus,
  parseExercises,
  STUDY_STATUS_EVENTS_DAYS,
  STUDY_STATUS_JSON_FILE,
  STUDY_STATUS_MD_FILE,
} from '../packages/shared/dist/index.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const dryRun = process.argv.includes('--dry-run');
const vault = arg('vault', process.env.CALENDAR_VAULT ?? join(homedir(), 'Documents', 'Notas de Fisica'));
const api = arg('api', process.env.CALENDAR_API_URL ?? 'http://localhost:3000');
const email = arg('email', process.env.CALENDAR_EMAIL ?? 'dev@local.test');
const password = process.env.CALENDAR_PASSWORD ?? 'devpassword123';

const MD_FILE = join(vault, STUDY_STATUS_MD_FILE);
const JSON_FILE = join(vault, STUDY_STATUS_JSON_FILE);
const DAY_MS = 24 * 60 * 60 * 1000;

async function request(path, init = {}, token) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const { accessToken } = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password, deviceLabel: 'export-study-status', devicePlatform: 'WEB' }),
});
const snapshot = await request('/sync/pull', {}, accessToken);
const focusEvents = await request(
  `/sync/focus-events?since=${encodeURIComponent(new Date(Date.now() - STUDY_STATUS_EVENTS_DAYS * DAY_MS).toISOString())}`,
  {},
  accessToken,
);

// The study game is replayed against the catalog parsed from the vault's notes as they are now
// (study-tutor-game D25).
function walkNotes(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name.startsWith('.') ? [] : walkNotes(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

const noteFiles = new Map();
const catalog = [];
for (const path of walkNotes(vault)) {
  const name = basename(path);
  const exercises = parseExercises(name, readFileSync(path, 'utf8'));
  if (!exercises.length) continue;
  noteFiles.set(exercises[0].noteCode, name.replace(/\.md$/, ''));
  catalog.push(...exercises);
}

const { markdown, json, summary } = buildStudyStatus({
  snapshot,
  focusEvents,
  catalog,
  noteFiles,
  now: new Date(),
  previousMarkdown: existsSync(MD_FILE) ? readFileSync(MD_FILE, 'utf8') : null,
  source: 'script',
});

if (dryRun) {
  console.log(markdown);
} else {
  writeFileSync(MD_FILE, markdown, 'utf8');
  writeFileSync(JSON_FILE, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log(`Escrito ${MD_FILE}`);
  console.log(`Escrito ${JSON_FILE}`);
  console.log(
    `${summary.sessionsDone}/${summary.sessionsTotal} sesiones, ${summary.studyPomodorosThisWeek} pomodoros de estudio esta semana, ${summary.ratings} calificaciones.`,
  );
}
// No process.exit(): on Windows it can abort with a libuv assertion while fetch keep-alive
// sockets are closing (same as import-study-notes.mjs).
