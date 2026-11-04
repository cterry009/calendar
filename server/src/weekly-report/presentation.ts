// The Sunday report as a presentation (weekend-mode, user 2026-11-04: "haz el reporte de manera
// visual como una presentación de los datos más relevantes del csv y el json"). One self-contained
// HTML file: inline SVG charts, a few lines of script for the arrows, no external fonts or
// libraries, so it opens offline from the email attachment and inside the app (an iframe).
// Pure: built from the same WeekData as the CSV and the JSON.

import {
  changePercent,
  hhmm,
  hoursText,
  LOWER_IS_BETTER,
  WEEKDAY_SHORT,
  weekRangeText,
  type NamedMinutes,
  type WeekData,
  type WeekTotals,
} from './week';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const W = 640;

/** Vertical bars, one per day; `series` stack bottom to top. */
function barChart(
  labels: string[],
  series: Array<{ name: string; values: number[]; color: string }>,
  format: (v: number) => string,
  height = 240,
): string {
  const pad = { top: 24, right: 8, bottom: 28, left: 8 };
  const innerH = height - pad.top - pad.bottom;
  const totals = labels.map((_, i) => series.reduce((s, x) => s + (x.values[i] ?? 0), 0));
  if (totals.every((total) => total === 0)) return '<p class="empty">Sin datos esta semana.</p>';
  const max = Math.max(1, ...totals);
  const slot = (W - pad.left - pad.right) / labels.length;
  const barW = Math.min(56, slot * 0.62);
  const bars = labels
    .map((label, i) => {
      const x = pad.left + slot * i + (slot - barW) / 2;
      let y = pad.top + innerH;
      const rects = series
        .map((s) => {
          const h = ((s.values[i] ?? 0) / max) * innerH;
          y -= h;
          return h > 0
            ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${s.color}"><title>${esc(label)} · ${esc(s.name)}: ${esc(format(s.values[i] ?? 0))}</title></rect>`
            : '';
        })
        .join('');
      const value = totals[i] > 0 ? `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" class="v">${esc(format(totals[i]))}</text>` : '';
      return `${rects}${value}<text x="${(x + barW / 2).toFixed(1)}" y="${height - 8}" class="l">${esc(label)}</text>`;
    })
    .join('');
  const baseline = `<line x1="${pad.left}" x2="${W - pad.right}" y1="${pad.top + innerH}" y2="${pad.top + innerH}" class="axis"/>`;
  return `<svg viewBox="0 0 ${W} ${height}" role="img">${baseline}${bars}</svg>${legend(series)}`;
}

function legend(series: Array<{ name: string; color: string }>): string {
  if (series.length < 2) return '';
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}

/** Horizontal bars for a ranking. */
function rankChart(items: Array<{ label: string; value: number }>, format: (v: number) => string, color = 'var(--c1)'): string {
  if (!items.length) return '<p class="empty">Sin datos esta semana.</p>';
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="rank">${items
    .map(
      (i) =>
        `<div class="row"><span class="name" title="${esc(i.label)}">${esc(i.label)}</span><span class="track"><span class="fill" style="width:${((i.value / max) * 100).toFixed(1)}%;background:${color}"></span></span><span class="num">${esc(format(i.value))}</span></div>`,
    )
    .join('')}</div>`;
}

/** Times of day as dots on a vertical clock axis (earlier = higher). */
function timeChart(labels: string[], series: Array<{ name: string; values: Array<number | null>; color: string }>): string {
  const height = 240;
  const pad = { top: 18, right: 12, bottom: 28, left: 44 };
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (!all.length) return '<p class="empty">Sin datos esta semana.</p>';
  const lo = Math.floor(Math.min(...all) / 60) * 60;
  const hi = Math.max(lo + 60, Math.ceil(Math.max(...all) / 60) * 60);
  const innerH = height - pad.top - pad.bottom;
  const slot = (W - pad.left - pad.right) / labels.length;
  const y = (m: number) => pad.top + ((m - lo) / (hi - lo)) * innerH;
  const grid: string[] = [];
  for (let m = lo; m <= hi; m += 60) {
    grid.push(`<line x1="${pad.left}" x2="${W - pad.right}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}" class="grid"/><text x="${pad.left - 6}" y="${(y(m) + 4).toFixed(1)}" class="t">${hhmm(m)}</text>`);
  }
  const dots = series
    .map((s) => {
      const points = s.values
        .map((v, i) => (v === null ? null : { x: pad.left + slot * i + slot / 2, y: y(v), v, i }))
        .filter((p): p is { x: number; y: number; v: number; i: number } => p !== null);
      const path = points.length > 1 ? `<polyline points="${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" opacity=".5"/>` : '';
      return path + points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${s.color}"><title>${esc(labels[p.i])} · ${esc(s.name)}: ${hhmm(p.v)}</title></circle>`).join('');
    })
    .join('');
  const xs = labels.map((l, i) => `<text x="${(pad.left + slot * i + slot / 2).toFixed(1)}" y="${height - 8}" class="l">${esc(l)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${height}" role="img">${grid.join('')}${dots}${xs}</svg>${legend(series)}`;
}

/** Weekday x hour grid of blocked open attempts. */
function heatmap(cells: number[][]): string {
  const max = Math.max(0, ...cells.flat());
  if (max === 0) return '<p class="empty">Ningún intento de abrir algo bloqueado. 👏</p>';
  const cw = 22;
  const ch = 22;
  const left = 36;
  const top = 18;
  const rects = cells
    .map((row, d) =>
      row
        .map((n, hour) => {
          const alpha = n === 0 ? 0.06 : 0.2 + 0.8 * (n / max);
          return `<rect x="${left + hour * cw}" y="${top + d * ch}" width="${cw - 2}" height="${ch - 2}" rx="3" fill="var(--c3)" fill-opacity="${alpha.toFixed(2)}"><title>${WEEKDAY_SHORT[d]} ${String(hour).padStart(2, '0')}:00 · ${n}</title></rect>`;
        })
        .join(''),
    )
    .join('');
  const days = WEEKDAY_SHORT.map((d, i) => `<text x="${left - 6}" y="${top + i * ch + 15}" class="t">${d}</text>`).join('');
  const hours = [0, 6, 12, 18, 23].map((h) => `<text x="${left + h * cw + cw / 2}" y="${top - 5}" class="l">${h}h</text>`).join('');
  return `<svg viewBox="0 0 ${left + 24 * cw + 4} ${top + 7 * ch + 4}" role="img">${days}${hours}${rects}</svg>`;
}

/** Small line per metric over the last weeks. */
function trendChart(points: Array<{ label: string; value: number }>, color: string, format: (v: number) => string): string {
  const width = 300;
  const height = 120;
  const pad = { top: 22, right: 16, bottom: 22, left: 16 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? (width - pad.left - pad.right) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    x: pad.left + step * i,
    y: pad.top + (1 - p.value / max) * (height - pad.top - pad.bottom),
    ...p,
  }));
  const line = xy.length > 1 ? `<polyline points="${xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5"/>` : '';
  const dots = xy
    .map(
      (p, i) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === xy.length - 1 ? 5 : 3.5}" fill="${color}"/>` +
        (i === xy.length - 1 || i === 0 ? `<text x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" class="v">${esc(format(p.value))}</text>` : '') +
        `<text x="${p.x.toFixed(1)}" y="${height - 6}" class="l">${esc(p.label)}</text>`,
    )
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img">${line}${dots}</svg>`;
}

function delta(key: keyof WeekTotals, now: number | null, previous: WeekTotals | null): string {
  if (now === null || !previous) return '';
  const before = previous[key] as number | null;
  const pct = changePercent(now, before);
  if (pct === null || pct === 0) return '<span class="delta same">= semana pasada</span>';
  const good = LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;
  return `<span class="delta ${good ? 'good' : 'bad'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)} %</span>`;
}

function kpi(label: string, value: string, deltaHtml: string): string {
  return `<div class="kpi"><div class="kl">${esc(label)}</div><div class="kv">${esc(value)}</div>${deltaHtml}</div>`;
}

function topN(items: NamedMinutes[], n = 6): Array<{ label: string; value: number }> {
  return items.slice(0, n).map((i) => ({ label: i.label, value: i.minutes }));
}

function slide(title: string, body: string, kicker?: string): string {
  return `<section class="slide">${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}<h2>${esc(title)}</h2>${body}</section>`;
}

const STYLE = `
:root{--bg:#f6f5f2;--panel:#ffffff;--ink:#1d2129;--muted:#6b7280;--line:#e5e2dc;--c1:#3b6fd8;--c2:#20a387;--c3:#e0623a;--c4:#9a6bd6;--good:#1f9d63;--bad:#d64545}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#12151b;--panel:#1b2029;--ink:#e8eaee;--muted:#9aa3b2;--line:#2b3240;--c1:#6d9bff;--c2:#3cc9a5;--c3:#ff8a5c;--c4:#b993ff;--good:#45c98a;--bad:#ff6b6b}}
:root[data-theme=dark]{--bg:#12151b;--panel:#1b2029;--ink:#e8eaee;--muted:#9aa3b2;--line:#2b3240;--c1:#6d9bff;--c2:#3cc9a5;--c3:#ff8a5c;--c4:#b993ff;--good:#45c98a;--bad:#ff6b6b}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.deck{max-width:960px;margin:0 auto;padding:16px}
.slide{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:28px 28px 24px;margin:0 0 18px;min-height:520px}
.js .slide{display:none;margin:0}.js .slide.on{display:block}
.kicker{color:var(--muted);font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
h1{font-size:34px;margin:4px 0 18px;line-height:1.15}h2{font-size:24px;margin:0 0 16px}h3{font-size:15px;margin:18px 0 8px;color:var(--muted);font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:8px 0 20px}
.kpi{border:1px solid var(--line);border-radius:14px;padding:14px 16px}.kl{color:var(--muted);font-size:13px}.kv{font-size:28px;font-weight:700;margin:2px 0}
.delta{font-size:13px;font-weight:600}.good{color:var(--good)}.bad{color:var(--bad)}.same{color:var(--muted)}
ul.hl{margin:0;padding-left:20px}ul.hl li{margin:6px 0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media (max-width:720px){.cols{grid-template-columns:1fr}.slide{padding:20px 16px;min-height:0}h1{font-size:26px}}
svg{width:100%;height:auto;display:block}svg text{fill:var(--muted);font-size:12px;text-anchor:middle}svg text.v{fill:var(--ink);font-weight:600}svg text.t{text-anchor:end}
.axis{stroke:var(--line)}.grid{stroke:var(--line);stroke-dasharray:3 4}
.legend{display:flex;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin-top:6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}
.rank .row{display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:10px;align-items:center;margin:7px 0;font-size:14px}
.rank .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank .track{height:10px;background:var(--line);border-radius:6px;overflow:hidden}.rank .fill{display:block;height:100%;border-radius:6px}.rank .num{color:var(--muted);font-variant-numeric:tabular-nums}
.empty{color:var(--muted)}.note{color:var(--muted);font-size:13px;margin-top:10px}
.checks{list-style:none;padding:0;margin:0}.checks li{padding:6px 0;border-bottom:1px solid var(--line)}
.trends{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.trends h3{margin-top:4px}
.nav{position:sticky;bottom:0;display:none;justify-content:center;align-items:center;gap:14px;padding:12px;color:var(--muted)}
.js .nav{display:flex}.nav button{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:10px;padding:8px 16px;cursor:pointer}
@media print{.js .slide{display:block!important;break-after:page}.nav{display:none!important}}
`;

const SCRIPT = `
document.documentElement.classList.add('js');
var s=[].slice.call(document.querySelectorAll('.slide')),i=0,c=document.getElementById('count');
function go(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(x,k){x.classList.toggle('on',k===i)});c.textContent=(i+1)+' / '+s.length;}
document.getElementById('prev').onclick=function(){go(i-1)};document.getElementById('next').onclick=function(){go(i+1)};
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();go(i+1)}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(i-1)}});
var x0=null;document.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
document.addEventListener('touchend',function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50)go(i+(dx<0?1:-1));x0=null});
go(0);
`;

export function buildPresentation(data: WeekData): string {
  const t = data.totals;
  const p = data.previous;
  const labels = data.days.map((d) => d.weekday);
  const range = weekRangeText(data.weekStart, data.weekEnd);
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);
  const count = (v: number) => String(Math.round(v));
  const steps = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

  const slides: string[] = [];

  slides.push(
    `<section class="slide"><div class="kicker">Reporte semanal</div><h1>Tu semana<br>${esc(range)}</h1>
<div class="kpis">
${kpi('Foco', hoursText(t.focusMinutes), delta('focusMinutes', t.focusMinutes, p))}
${kpi('Bloques cumplidos', pct(t.scheduleRate), p && t.scheduleRate !== null && p.scheduleRate !== null ? delta('scheduleRate', t.scheduleRate, p) : '')}
${kpi('Juegos', hoursText(t.gameMinutes), delta('gameMinutes', t.gameMinutes, p))}
${kpi('Pasos', t.steps.toLocaleString('es-CO'), delta('steps', t.steps, p))}
</div>
<ul class="hl">${data.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></section>`,
  );

  slides.push(
    slide(
      `${hoursText(t.focusMinutes)} de foco · ${t.pomodoros} pomodoros`,
      `${barChart(labels, [{ name: 'Foco', values: data.days.map((d) => d.focusMinutes), color: 'var(--c1)' }], hoursText)}
<h3>Por categoría</h3>${rankChart(topN(data.focusByCategory), hoursText)}`,
      'Enfoque',
    ),
  );

  slides.push(
    slide(
      `${pct(t.scheduleRate)} de los bloques · ${t.blocksSkipped} "no puedo"`,
      `${barChart(
        labels,
        [
          { name: 'Hechos', values: data.days.map((d) => d.blocksDone), color: 'var(--c2)' },
          { name: 'Empezados sin terminar', values: data.days.map((d) => Math.max(0, d.blocksStarted - d.blocksDone)), color: 'var(--c4)' },
          { name: 'Sin empezar', values: data.days.map((d) => Math.max(0, d.blocksPlanned - d.blocksStarted - d.blocksSkipped)), color: 'var(--line)' },
          { name: '"No puedo"', values: data.days.map((d) => d.blocksSkipped), color: 'var(--c3)' },
        ],
        count,
      )}
<div class="cols"><div><h3>Bloques que más se cayeron</h3>${rankChart(data.missedBlocks.slice(0, 5).map((m) => ({ label: m.label, value: m.count })), count, 'var(--c3)')}</div>
<div><h3>Tareas</h3><p>Terminadas: <b>${t.tasksCompleted}</b> · pendientes en su día: <b>${t.tasksLeftover}</b></p></div></div>`,
      'Horario',
    ),
  );

  const weak = [...data.study.sections].filter((s) => s.attempts >= 2).sort((a, b) => a.meanGrade - b.meanGrade).slice(0, 5);
  const most = [...data.study.sections].sort((a, b) => b.attempts - a.attempts).slice(0, 5);
  slides.push(
    slide(
      `${t.exerciseAttempts} ejercicios · ${t.exerciseAttempts ? Math.round((t.exerciseCorrect / t.exerciseAttempts) * 100) : 0} % bien`,
      `${barChart(
        labels,
        [
          { name: 'Bien', values: data.days.map((d) => d.exerciseCorrect), color: 'var(--c2)' },
          { name: 'A medias o mal', values: data.days.map((d) => d.exerciseAttempts - d.exerciseCorrect), color: 'var(--c4)' },
        ],
        count,
        200,
      )}
<div class="cols"><div><h3>Secciones más practicadas</h3>${rankChart(most.map((s) => ({ label: s.key, value: s.attempts })), count)}</div>
<div><h3>Para repasar el sábado (nota media más baja)</h3>${rankChart(weak.map((s) => ({ label: s.key, value: Math.round(s.meanGrade * 100) })), (v) => `${v} %`, 'var(--c3)')}</div></div>`,
      'Estudio',
    ),
  );

  slides.push(
    slide(
      `Pantalla: ${hoursText(t.phoneMinutes)} en el teléfono · ${hoursText(t.pcMinutes)} en el PC`,
      `${barChart(
        labels,
        [
          { name: 'Teléfono (redes)', values: data.days.map((d) => d.phoneSocialMinutes ?? 0), color: 'var(--c3)' },
          { name: 'Teléfono (resto)', values: data.days.map((d) => Math.max(0, (d.phoneMinutes ?? 0) - (d.phoneSocialMinutes ?? 0))), color: 'var(--c4)' },
          { name: 'PC', values: data.days.map((d) => d.pcMinutes ?? 0), color: 'var(--c1)' },
        ],
        hoursText,
      )}
<div class="cols"><div><h3>Teléfono</h3>${rankChart(topN(data.topPhoneApps), hoursText, 'var(--c4)')}</div><div><h3>PC</h3>${rankChart(topN(data.topPcApps), hoursText)}</div></div>`,
      'Pantalla',
    ),
  );

  slides.push(
    slide(
      `Juegos: ${hoursText(t.gameMinutes)} · League of Legends ${hoursText(t.lolMinutes)}`,
      `${barChart(
        labels,
        [
          { name: 'League of Legends', values: data.days.map((d) => d.lolMinutes ?? 0), color: 'var(--c3)' },
          { name: 'Otros juegos', values: data.days.map((d) => Math.max(0, (d.gameMinutes ?? 0) - (d.lolMinutes ?? 0))), color: 'var(--c4)' },
        ],
        hoursText,
      )}
<h3>Por juego</h3>${rankChart(topN(data.topGames), hoursText, 'var(--c3)')}
<p class="note">LoL se bloquea desde las 20:00 entre semana y las 22:00 viernes y sábado; el resto de juegos a las 22:00, y a las 00:00 viernes y sábado.</p>`,
      'Juegos',
    ),
  );

  slides.push(
    slide(
      `${t.blockAttempts} intentos de abrir algo bloqueado · ${t.nightBlockAttempts} de noche`,
      `${heatmap(data.blockHeatmap)}<h3>Qué intentaste abrir</h3>${rankChart(data.blockedTargets.slice(0, 6).map((b) => ({ label: b.label, value: b.count })), count, 'var(--c3)')}`,
      'Bloqueos',
    ),
  );

  slides.push(
    slide(
      t.avgFirstUseMinute !== null ? `Primer uso del teléfono a las ${hhmm(t.avgFirstUseMinute)} en promedio` : 'Mañanas',
      `${timeChart(labels, [
        { name: 'Primer uso', values: data.days.map((d) => d.firstUseMinute), color: 'var(--c1)' },
        { name: 'Desbloqueo (trote o pasos)', values: data.days.map((d) => d.unlockMinute), color: 'var(--c2)' },
      ])}
<h3>Pasos por día · ${t.steps.toLocaleString('es-CO')} en la semana · ${hoursText(t.workoutMinutes)} de ejercicio</h3>
${barChart(labels, [{ name: 'Pasos', values: data.days.map((d) => d.steps ?? 0), color: 'var(--c2)' }], steps, 180)}`,
      'Mañanas y cuerpo',
    ),
  );

  slides.push(
    slide(
      `Hábitos ${t.habitsDone} de ${t.habitsPlanned} · fin de semana ${t.weekendActivitiesDone} de ${t.weekendActivitiesPlanned}`,
      `<div class="cols"><div><h3>Hábitos</h3>${rankChart(
        data.habits.map((h) => ({ label: `${h.title} (${h.done}/${h.planned})`, value: h.planned ? Math.round((h.done / h.planned) * 100) : 0 })),
        (v) => `${v} %`,
        'var(--c2)',
      )}</div>
<div><h3>Actividades del fin de semana</h3>${
        data.weekendActivities.length
          ? `<ul class="checks">${data.weekendActivities.map((a) => `<li>${a.done ? '✅' : '⬜'} ${esc(a.day)}${a.time ? ` ${esc(a.time)}` : ''} · ${esc(a.title)}</li>`).join('')}</ul>`
          : '<p class="empty">No había actividades este fin de semana.</p>'
      }</div></div>`,
      'Hábitos',
    ),
  );

  const weeks = [...data.history, { weekStart: data.weekStart, totals: t }];
  const wl = (w: string) => {
    const [, m, d] = w.split('-').map(Number);
    return `${d}/${m}`;
  };
  slides.push(
    slide(
      weeks.length > 1 ? `Las últimas ${weeks.length} semanas` : 'Tendencia',
      weeks.length > 1
        ? `<div class="trends">
<div><h3>Foco</h3>${trendChart(weeks.map((w) => ({ label: wl(w.weekStart), value: w.totals.focusMinutes })), 'var(--c1)', hoursText)}</div>
<div><h3>Bloques cumplidos</h3>${trendChart(weeks.map((w) => ({ label: wl(w.weekStart), value: Math.round((w.totals.scheduleRate ?? 0) * 100) })), 'var(--c2)', (v) => `${v} %`)}</div>
<div><h3>Juegos</h3>${trendChart(weeks.map((w) => ({ label: wl(w.weekStart), value: w.totals.gameMinutes })), 'var(--c3)', hoursText)}</div>
<div><h3>Pasos</h3>${trendChart(weeks.map((w) => ({ label: wl(w.weekStart), value: w.totals.steps })), 'var(--c2)', steps)}</div>
<div><h3>Redes en el teléfono</h3>${trendChart(weeks.map((w) => ({ label: wl(w.weekStart), value: w.totals.phoneSocialMinutes })), 'var(--c4)', hoursText)}</div>
<div><h3>Intentos bloqueados</h3>${trendChart(weeks.map((w) => ({ label: wl(w.weekStart), value: w.totals.blockAttempts })), 'var(--c3)', count)}</div>
</div>`
        : '<p class="empty">Es la primera semana con reporte: desde el próximo domingo aparece la tendencia.</p>',
      'Tendencia',
    ),
  );

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Semana ${esc(range)}</title><style>${STYLE}</style></head>
<body><main class="deck">${slides.join('\n')}
<div class="nav"><button id="prev" aria-label="Anterior">←</button><span id="count"></span><button id="next" aria-label="Siguiente">→</button></div>
</main><script>${SCRIPT}</script></body></html>`;
}
