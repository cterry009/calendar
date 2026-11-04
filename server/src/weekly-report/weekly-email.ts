// The Sunday email's body (weekend-mode). Gmail runs no scripts and drops SVG, so the body is a short
// summary with table-cell bars; the full presentation, the CSV and the JSON go as attachments.

import { changePercent, hoursText, LOWER_IS_BETTER, weekRangeText, type WeekData, type WeekTotals } from './week';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Row {
  key: keyof WeekTotals;
  label: string;
  format: (t: WeekTotals) => string;
}

const ROWS: Row[] = [
  { key: 'focusMinutes', label: 'Foco', format: (t) => hoursText(t.focusMinutes) },
  {
    key: 'scheduleRate',
    label: 'Bloques cumplidos',
    format: (t) => (t.scheduleRate === null ? '—' : `${Math.round(t.scheduleRate * 100)} % (${t.blocksDone}/${t.blocksPlanned})`),
  },
  { key: 'tasksCompleted', label: 'Tareas terminadas', format: (t) => String(t.tasksCompleted) },
  { key: 'exerciseAttempts', label: 'Ejercicios', format: (t) => `${t.exerciseAttempts} (${t.exerciseCorrect} bien)` },
  { key: 'phoneSocialMinutes', label: 'Redes en el teléfono', format: (t) => hoursText(t.phoneSocialMinutes) },
  { key: 'gameMinutes', label: 'Juegos', format: (t) => hoursText(t.gameMinutes) },
  { key: 'lolMinutes', label: 'League of Legends', format: (t) => hoursText(t.lolMinutes) },
  { key: 'blockAttempts', label: 'Intentos bloqueados', format: (t) => String(t.blockAttempts) },
  { key: 'steps', label: 'Pasos', format: (t) => t.steps.toLocaleString('es-CO') },
  { key: 'habitsDone', label: 'Hábitos', format: (t) => `${t.habitsDone} de ${t.habitsPlanned}` },
];

function arrow(key: keyof WeekTotals, totals: WeekTotals, previous: WeekTotals | null): { text: string; color: string } {
  if (!previous) return { text: '', color: '#6b7280' };
  const now = totals[key] as number | null;
  const before = previous[key] as number | null;
  if (now === null) return { text: '', color: '#6b7280' };
  const pct = changePercent(now, before);
  if (pct === null || pct === 0) return { text: '=', color: '#6b7280' };
  const good = LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;
  return { text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)} %`, color: good ? '#1f9d63' : '#d64545' };
}

export function buildWeeklyEmail(data: WeekData): { subject: string; text: string; html: string } {
  const t = data.totals;
  const range = weekRangeText(data.weekStart, data.weekEnd);
  const rate = t.scheduleRate === null ? '' : ` · ${Math.round(t.scheduleRate * 100)} % de bloques`;
  const subject = `Tu semana ${range}: ${hoursText(t.focusMinutes)} de foco${rate}`;

  const text = [
    `Tu semana, ${range}`,
    '',
    ...data.highlights.map((h) => `- ${h}`),
    '',
    ...ROWS.map((r) => {
      const a = arrow(r.key, t, data.previous);
      return `${r.label}: ${r.format(t)}${a.text ? ` (${a.text} vs. la semana pasada)` : ''}`;
    }),
    '',
    'Foco por día:',
    ...data.days.map((d) => `  ${d.weekday} ${hoursText(d.focusMinutes)}`),
    '',
    'Adjuntos: la presentación (ábrela en el navegador), el CSV con una fila por día y el mismo dato en JSON.',
  ].join('\n');

  const maxFocus = Math.max(1, ...data.days.map((d) => d.focusMinutes));
  const bars = data.days
    .map((d) => {
      const width = Math.round((d.focusMinutes / maxFocus) * 100);
      return `<tr><td style="padding:3px 8px 3px 0;color:#6b7280;width:36px">${esc(d.weekday)}</td><td style="padding:3px 0;width:100%"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="background:#3b6fd8;height:12px;width:${width}%;border-radius:4px"></td><td></td></tr></table></td><td style="padding:3px 0 3px 8px;white-space:nowrap;color:#1d2129">${esc(hoursText(d.focusMinutes))}</td></tr>`;
    })
    .join('');
  const rows = ROWS.map((r) => {
    const a = arrow(r.key, t, data.previous);
    return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(r.label)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600">${esc(r.format(t))}</td><td style="padding:6px 0 6px 10px;border-bottom:1px solid #eee;text-align:right;color:${a.color};white-space:nowrap">${esc(a.text)}</td></tr>`;
  }).join('');

  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1d2129">
<div style="max-width:560px;margin:0 auto;padding:20px 16px">
<div style="background:#fff;border-radius:14px;padding:22px 20px">
<div style="color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:.06em">Reporte semanal</div>
<h1 style="font-size:24px;margin:4px 0 14px">Tu semana, ${esc(range)}</h1>
<ul style="padding-left:18px;margin:0 0 18px">${data.highlights.map((h) => `<li style="margin:5px 0">${esc(h)}</li>`).join('')}</ul>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:15px">${rows}</table>
<h2 style="font-size:15px;color:#6b7280;margin:22px 0 8px">Foco por día</h2>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px">${bars}</table>
<p style="color:#6b7280;font-size:13px;margin:20px 0 0">Adjuntos: <b>la presentación</b> (ábrela en el navegador y pasa con las flechas), el <b>CSV</b> con una fila por día y el mismo dato en <b>JSON</b>. También está en la app, en Reportes → Semana.</p>
</div></div></body></html>`;

  return { subject, text, html };
}
