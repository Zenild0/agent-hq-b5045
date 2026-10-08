// The parent home screen: next practice, practice days (with the child's attendance), and the child's remarks.
import { esc, fmtPts, fmtDate, avatarHtml, isGood, remarkLabel } from './common.js';

export const fmtTime = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dow = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();
const ymd = (date) => date.split('-').map(Number);
const daysFrom = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function nextCardHtml(sc) {
  const n = sc?.next;
  if (!n) return `<section class="card next"><div class="tag">Next practice</div><div class="when">To be announced</div></section>`;
  const away = daysFrom(sc.today, n.date);
  const rel = away === 0 ? 'Today' : away === 1 ? 'Tomorrow' : `In ${away} days`;
  return `
    <section class="card next" aria-label="Next practice">
      <div class="tag">Next practice</div>
      <div class="when">${WD[dow(n.date)]} ${ymd(n.date)[2]} ${MONTHS[ymd(n.date)[1] - 1].slice(0, 3)} · ${fmtTime(n.time)}</div>
      ${n.label ? `<div>${esc(n.label)}</div>` : ''}
      <div><span class="pill-lite">${rel}</span></div>
      ${n.note ? `<div class="tnote">📌 ${esc(n.note)}</div>` : ''}
    </section>`;
}

// Attendance on one date for this child: 'present', 'absent' (absent or medical leave) or ''.
function statusByDate(history) {
  const m = new Map();
  for (const h of history || []) {
    const cur = m.get(h.date);
    if (h.status === 'present') m.set(h.date, 'present');
    else if ((h.status === 'absent' || h.status === 'excused') && cur !== 'present') m.set(h.date, 'absent');
  }
  return m;
}

export function daysFoldHtml(sc, history, open = false) {
  const status = statusByDate(history);
  const have = history !== null && history !== undefined;
  const byDate = new Map(sc.days.map((d) => [d.date, d]));
  // Past days with attendance that are not on the schedule (e.g. a Sunday mass) still count.
  const extraLabel = (h) => ({ saturday: '', sunday: 'Mass', practice: h.event || 'Special', feast: h.event ? `${h.event} mass` : 'Mass' }[h.type] ?? '');
  for (const h of history || []) if (h.date <= sc.today && !byDate.has(h.date)) byDate.set(h.date, { date: h.date, time: '', label: extraLabel(h), cancelled: false, extra: true });
  const all = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const past = all.filter((d) => d.date <= sc.today && !(d.date === sc.today && sc.next?.date === d.date));
  const marked = past.filter((d) => !d.cancelled && status.get(d.date));
  const attended = marked.filter((d) => status.get(d.date) === 'present').length;
  const cls = (d) => {
    if (d.cancelled) return 'off';
    if (sc.next?.date === d.date) return 'next-one';
    if (d.date <= sc.today && have) return status.get(d.date) === 'present' ? 'g' : status.get(d.date) === 'absent' ? 'r' : '';
    return d.special ? 'feast' : '';
  };
  const strip = have
    ? [...past.filter((d) => !d.cancelled).slice(-6).map((d) => `<i class="dot ${status.get(d.date) === 'present' ? 'g' : status.get(d.date) === 'absent' ? 'r' : ''}" title="${esc(fmtDate(d.date))}"></i>`),
      sc.next ? '<i class="dot next" title="Next practice"></i>' : ''].join('')
    : '';
  const shown = all.filter((d) => daysFrom(sc.today, d.date) <= 90 && (have ? daysFrom(d.date, sc.today) <= 62 : d.date >= sc.today));
  const months = [];
  for (const d of shown) {
    const key = d.date.slice(0, 7);
    let g = months.at(-1);
    if (!g || g.key !== key) { g = { key, label: `${MONTHS[ymd(d.date)[1] - 1]} ${ymd(d.date)[0]}`, days: [] }; months.push(g); }
    g.days.push(d);
  }
  const summary = !have ? 'Upcoming days · tap to open'
    : marked.length ? `${attended} of ${marked.length} attended · tap to see all days` : 'Tap to see all days';
  return `
    <details class="card fold" id="daysFold"${open ? ' open' : ''}>
      <summary>
        <div class="sumrow"><h2>Practice days</h2><span class="chev" aria-hidden="true">▾</span></div>
        ${strip ? `<div class="strip" aria-label="Recent practices">${strip}</div>` : ''}
        <div class="muted">${summary}</div>
      </summary>
      ${have ? '<div class="legend"><span><i class="dot g"></i>Present</span><span><i class="dot r"></i>Absent / medical</span><span><i class="dot next"></i>Next</span></div>' : ''}
      ${months.map((g) => `
        <div class="month"><h3>${esc(g.label)}</h3><div class="days">
          ${g.days.map((d) => `
            <div class="day ${cls(d)}"><span>${WD[dow(d.date)]}${d.label ? ` · ${esc(d.label)}` : ''}</span><b>${ymd(d.date)[2]}</b>
              <div class="t">${d.time ? fmtTime(d.time) : ''}</div>${d.cancelled ? '<em>No practice</em>' : ''}</div>`).join('')}
        </div></div>`).join('') || '<div class="muted" style="margin-top:12px">No practices scheduled yet.</div>'}
    </details>`;
}

export function remarksFoldHtml(me, open = false) {
  const rows = (me.history || []).filter((h) => h.remarks?.length);
  const net = (h) => (h.bonus || 0) - (h.deduction || 0);
  return `
    <details class="card fold" id="remarksFold"${open ? ' open' : ''}>
      <summary>
        <div class="who">${avatarHtml(me, 'sm')}
          <div class="grow"><h2>${esc(me.name)}</h2>
            <div class="muted">${me.yearRank ? `Year rank ${me.yearRank} of ${me.yearRanked} · ` : ''}tap for remarks</div></div>
          <div class="score"><b>${fmtPts(me.stats?.points ?? 0)}</b><span class="muted">points this year</span><span class="muted">${fmtPts(me.monthPoints ?? 0)} this month</span></div>
          <span class="chev" aria-hidden="true">▾</span></div>
      </summary>
      ${rows.map((h) => `
        <div class="remark"><div class="rd">${esc(fmtDate(h.date))}${net(h) ? ` <span class="muted">· ${net(h) > 0 ? '+' : '−'}${fmtPts(Math.abs(net(h)))}</span>` : ''}</div>
          <div>${h.remarks.map((r) => `<span class="badge ${isGood(r) ? 'ok' : 'warn'}">${esc(remarkLabel(r))}</span>`).join(' ')}</div></div>`).join('')
        || '<div class="muted" style="margin-top:12px">No remarks yet. They appear here after practices.</div>'}
      <div class="muted" style="margin-top:12px">Only you can see these.</div>
    </details>`;
}

// Home: points, rank and attendance at a glance (shown once the child's code is entered).
export function trioHtml(me, sc) {
  const status = new Map();
  for (const x of me.history || []) {
    const cur = status.get(x.date);
    if (x.status === 'present') status.set(x.date, 'present');
    else if ((x.status === 'absent' || x.status === 'excused') && cur !== 'present') status.set(x.date, 'absent');
  }
  const done = [...status.entries()].filter(([d]) => d <= sc.today).sort((a, b) => a[0].localeCompare(b[0]));
  const present = done.filter(([, v]) => v === 'present').length;
  const last = done.slice(-5);
  return `
    <section class="trio" aria-label="${esc(me.name)} at a glance">
      <div class="tile t1"><small>Points</small><b>${fmtPts(me.stats?.points ?? 0)}</b><small>${fmtPts(me.monthPoints ?? 0)} this month</small></div>
      <div class="tile t2"><small>Rank</small><b>${me.yearRank ? `#${me.yearRank}` : '–'}</b><small>${me.yearRank ? `of ${me.yearRanked} this year` : 'this year'}</small></div>
      <div class="tile t3"><small>Present</small><b>${present}/${done.length}</b><div class="dots">${last.map(([, v]) => `<i class="${v === 'present' ? 'g' : 'r'}"></i>`).join('')}</div></div>
    </section>`;
}

// ---------- guests: their own event ----------

const ST = { present: ['g', 'Present'], absent: ['r', 'Absent'], excused: ['m', 'Medical leave'] };

// One event's leaderboard (only that event) with the guest's own row marked.
export function eventBoardHtml(ev, meId) {
  return `
    <div class="card ev-card">
      <div class="row between"><h2 style="margin:0">${esc(ev.name)}</h2>${ev.me ? `<span class="badge info">Rank ${ev.me.rank} of ${ev.total}</span>` : ''}</div>
      <div class="muted">${ev.sessions ? `${ev.sessions} practice${ev.sessions === 1 ? '' : 's'} so far` : 'No practices recorded yet'}. Only this event counts here.</div>
      ${ev.board.length && ev.sessions ? `<div class="ev-board">${ev.board.map((r) => `
        <div class="ev-row${r.id === meId ? ' me' : ''}"><span class="ev-rank">${r.rank}</span>${avatarHtml(r, 'sm')}<span class="grow">${esc(r.name)}${r.id === meId ? ' (you)' : ''}</span><b>${fmtPts(r.points)}</b></div>`).join('')}</div>` : ''}
      <h3 style="margin:12px 0 6px">Your attendance</h3>
      ${ev.attendance.length ? `<div class="chips">${ev.attendance.map((a) => `<span class="chip ${ST[a.status]?.[0] ?? ''}">${esc(fmtDate(a.date).replace(/ \d{4}$/, ''))} · ${ST[a.status]?.[1] ?? esc(a.status)}</span>`).join('')}</div>` : '<div class="muted">Nothing marked yet.</div>'}
    </div>`;
}

// A guest's Home: welcome, their event(s), and the switch that shows the main choir's practice times.
export function guestHomeHtml(me) {
  return `
    <section class="card welcome">
      <div class="row"><div class="grow"><div class="muted">Guest</div><h2 style="margin:0">Hello, ${esc(me.name.split(' ')[0])}</h2></div></div>
      <p class="muted" style="margin:6px 0 0">Welcome! You are part of ${me.events?.length === 1 ? esc(me.events[0].name) : 'our special events'}. Hymns are free to browse, and the training games are free to try for a few days.</p>
    </section>
    ${(me.events || []).map((ev) => eventBoardHtml(ev, me.id)).join('') || '<div class="card muted">Your event will appear here once your teacher adds you.</div>'}
    <label class="card row between sched-opt"><span class="grow"><b>Main choir practice times</b><div class="muted">Show the regular practice days here</div></span>
      <input type="checkbox" id="schedOpt" class="switch"${me.showSchedule ? ' checked' : ''} aria-label="Show the main choir practice times"></label>`;
}
