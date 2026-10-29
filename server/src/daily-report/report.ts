// The daily email's content (daily-email-report, 2026-10-29): what the day was and what the next one
// holds. Pure -- the service gathers the rows, this only words them -- so it's tested without a
// database or a mail server.

export interface ReportBlock {
  label: string;
  /** "09:12" -- when it started (a flexible block) or its window (a fixed one). */
  start: string;
  focusMinutes: number;
  pomodoros: number;
  /** A flexible block with 45+ minutes of focus, or a fixed one that ran. */
  done: boolean;
}

export interface ReportTask {
  title: string;
  /** "10:30", or null for "that day, whenever". */
  time: string | null;
}

export interface ReportSuggestedBlock {
  label: string;
  start: string;
  end: string;
  tasks: Array<{ title: string; reason: string }>;
}

export interface DayReportData {
  /** The day covered, YYYY-MM-DD, and the next one. */
  date: string;
  nextDate: string;
  blocks: ReportBlock[];
  /** Blocks marked "no puedo" that day. */
  skipped: string[];
  completedTasks: string[];
  /** Tasks that were on that day and weren't finished. */
  leftover: string[];
  steps: number | null;
  screenMinutes: number | null;
  gameMinutes: number | null;
  habits: { done: number; total: number };
  next: {
    /** The next day's WORK blocks, in order. */
    blocks: Array<{ label: string; start: string; end: string }>;
    tasks: ReportTask[];
    /** A plan proposed because nothing was planned; null when there was a plan or no proposal. */
    suggestion: { blocks: ReportSuggestedBlock[]; warnings: string[] } | null;
    /** Why there's no suggestion although nothing is planned (no pending tasks, no blocks, ...). */
    suggestionNote: string | null;
  };
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "jueves 29 de octubre". */
export function dayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} de ${MONTHS[m - 1]}`;
}

export function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Section {
  title: string;
  lines: string[];
}

function sections(data: DayReportData): { today: Section[]; next: Section[] } {
  const focus = data.blocks.reduce((sum, b) => sum + b.focusMinutes, 0);
  const doneBlocks = data.blocks.filter((b) => b.done).length;
  const today: Section[] = [
    {
      title: `Bloques: ${doneBlocks} hechos de ${data.blocks.length} empezados · ${minutesText(focus)} de foco`,
      lines: [
        ...data.blocks.map(
          (b) =>
            `${b.done ? '✔' : '·'} ${b.start} ${b.label}: ${minutesText(b.focusMinutes)} de foco, ${b.pomodoros} ${b.pomodoros === 1 ? 'pomodoro' : 'pomodoros'}`,
        ),
        ...data.skipped.map((label) => `✗ ${label}: marcado "no puedo"`),
      ],
    },
    {
      title: `Tareas terminadas: ${data.completedTasks.length}`,
      lines: data.completedTasks.map((t) => `✔ ${t}`),
    },
  ];
  if (data.leftover.length) {
    today.push({ title: `Quedaron sin terminar: ${data.leftover.length}`, lines: data.leftover.map((t) => `· ${t}`) });
  }
  const body: string[] = [];
  if (data.habits.total) body.push(`Hábitos: ${data.habits.done} de ${data.habits.total}`);
  if (data.steps !== null) body.push(`Pasos: ${data.steps.toLocaleString('es-CO')}`);
  if (data.screenMinutes !== null) body.push(`Pantalla del teléfono: ${minutesText(data.screenMinutes)}`);
  if (data.gameMinutes !== null) body.push(`Juegos: ${minutesText(data.gameMinutes)}`);
  if (body.length) today.push({ title: 'Lo demás', lines: body });

  const next: Section[] = [];
  const n = data.next;
  next.push({
    title: n.blocks.length ? 'Bloques de trabajo' : 'Sin bloques de trabajo',
    lines: n.blocks.map((b) => `${b.start}-${b.end} ${b.label}`),
  });
  if (n.tasks.length) {
    next.push({ title: 'Ya planeado', lines: n.tasks.map((t) => `${t.time ?? 'en el día'} · ${t.title}`) });
  } else if (n.suggestion) {
    next.push({
      title: 'Nada planeado todavía. Plan sugerido (apruébalo en la app: "Plan sugerido")',
      lines: n.suggestion.blocks.flatMap((b) => [
        `${b.start}-${b.end} ${b.label}`,
        ...b.tasks.map((t) => `   · ${t.title}${t.reason ? ` (${t.reason})` : ''}`),
      ]),
    });
    // Which model failed and fell back is the server log's business, not the email's.
    const notes = n.suggestion.warnings.filter((w) => !/falló|no respondió|Ningún modelo/i.test(w));
    if (notes.length) next.push({ title: 'Notas del planificador', lines: notes });
  } else {
    next.push({ title: 'Nada planeado todavía', lines: n.suggestionNote ? [n.suggestionNote] : [] });
  }
  return { today, next };
}

export function buildReportEmail(data: DayReportData): { subject: string; text: string; html: string } {
  const { today, next } = sections(data);
  const focus = data.blocks.reduce((sum, b) => sum + b.focusMinutes, 0);
  const pending = !data.next.tasks.length && data.next.suggestion ? ' · plan por aprobar' : '';
  const subject = `Tu día: ${dayName(data.date)} · ${minutesText(focus)} de foco${pending}`;
  const todayTitle = `Hoy, ${dayName(data.date)}`;
  const nextTitle = `Mañana, ${dayName(data.nextDate)}`;

  const textPart = (title: string, list: Section[]) =>
    [title.toUpperCase(), ...list.flatMap((s) => ['', s.title, ...s.lines.map((l) => `  ${l}`)])].join('\n');
  const text = `${textPart(todayTitle, today)}\n\n${textPart(nextTitle, next)}\n`;

  const htmlPart = (title: string, list: Section[]) =>
    `<h2 style="font-size:18px;margin:24px 0 8px;color:#1d3b2f">${escapeHtml(title)}</h2>` +
    list
      .map(
        (s) =>
          `<p style="margin:12px 0 4px;font-weight:600">${escapeHtml(s.title)}</p>` +
          (s.lines.length
            ? `<ul style="margin:0;padding-left:20px">${s.lines
                .map((l) => `<li style="margin:2px 0;${l.startsWith('   ') ? 'list-style:circle;margin-left:16px;color:#555' : ''}">${escapeHtml(l.trim())}</li>`)
                .join('')}</ul>`
            : ''),
      )
      .join('');
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:560px">` +
    htmlPart(todayTitle, today) +
    htmlPart(nextTitle, next) +
    `<p style="margin-top:24px;color:#777;font-size:12px">Calendar Productivity · reporte diario</p></div>`;
  return { subject, text, html };
}
