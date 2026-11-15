// The parent home screen: next practice, practice days (with the child's attendance), and the child's remarks.
import { icon } from './icons.js';
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

// ---------- the home kit: compact, scannable pieces shared by the teacher's home and the children's home ----------

// The next practice, small: a date block, the time, how far away it is, and one line of note. `cta` is an optional button inside the card.
export function nextCardHtml(sc, cta = '') {
  const n = sc?.next;
  if (!n) return `<section class="hk-hero" aria-label="Next practice"><div class="hk-date off"><b>–</b></div><div class="hk-hero-main"><div class="hk-time">Next practice</div><div class="s">To be announced</div></div>${cta}</section>`;
  const away = daysFrom(sc.today, n.date);
  const [, m, d] = ymd(n.date);
  return `
    <section class="hk-hero${away <= 1 ? ' soon' : ''}" aria-label="Next practice">
      <div class="hk-date"><small>${WD[dow(n.date)].slice(0, 3)}</small><b>${d}</b><small>${MONTHS[m - 1].slice(0, 3)}</small></div>
      <div class="hk-hero-main"><div class="k">${away === 0 ? 'TODAY' : away === 1 ? 'TOMORROW' : 'NEXT PRACTICE'} · ${fmtTime(n.time)}</div>
        <div class="hk-time hk-clock" data-at="${esc(n.date)}T${esc(n.time)}:00+05:30" aria-live="off">…</div>
        <div class="s">${n.label ? esc(n.label) : 'See you there!'}${n.note ? ` · 📌 ${esc(n.note)}` : ''}</div></div>
      ${cta}
    </section>`;
}

// A slim greeting: avatar, who, one line under it, and chips or a button on the right.
export const greetBarHtml = ({ avatar, hello, name, sub = '', right = '' }) =>
  `<header class="hk-greet">${avatar}<div class="hk-who"><small>${hello}</small><b>${name}</b>${sub ? `<span>${sub}</span>` : ''}</div>${right}</header>`;

// The colourful quick-action grid (like the category grid in a delivery app). items: [{ id, icon, label, hue, badge }]
export const quickGridHtml = (items) =>
  `<nav class="hk-grid" style="--n:${items.length <= 5 ? Math.max(items.length, 1) : 4}" aria-label="Quick links">${items.map((i) => `<button type="button" class="hk-q" data-q="${esc(i.id)}"><span class="ic" style="--h:${i.hue ?? 260}" aria-hidden="true">${icon(i.icon)}${i.badge ? `<i>${esc(i.badge)}</i>` : ''}</span><b>${esc(i.label)}</b></button>`).join('')}</nav>`;

// A row of small number chips. items: [{ id, v, l, tone }]
export const statStripHtml = (items) =>
  `<section class="hk-stats" aria-label="At a glance">${items.map((s) => `<button type="button" class="hk-stat ${s.tone ?? ''}"${s.id ? ` data-stat="${esc(s.id)}"` : ' disabled'}><b>${s.v}</b><small>${esc(s.l)}</small></button>`).join('')}</section>`;

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
  return statStripHtml([
    { v: fmtPts(me.stats?.points ?? 0), l: `points · ${fmtPts(me.monthPoints ?? 0)} this month`, tone: 't1' },
    { v: me.yearRank ? `#${me.yearRank}` : '–', l: me.yearRank ? `of ${me.yearRanked} this year` : 'rank this year', tone: 't2' },
    { v: `${present}/${done.length}`, l: `present${last.length ? ' · ' + last.map(([, v]) => (v === 'present' ? '●' : '○')).join('') : ''}`, tone: 't3' },
  ]);
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

// Practices the teacher scheduled for the special occasions this child is in (separate from the regular practice).
export function occasionPracticesHtml(me) {
  const list = me?.occasionPractices || [];
  if (!list.length) return '';
  return `
    <section class="card" aria-label="Special practices">
      <div class="tag">Special practices</div>
      ${list.slice(0, 8).map((p) => `
        <div class="row between" style="padding:6px 0;border-top:1px solid var(--line)">
          <span><b>${WD[dow(p.date)]} ${ymd(p.date)[2]} ${MONTHS[ymd(p.date)[1] - 1].slice(0, 3)}</b> · ${fmtTime(p.time)}<div class="muted">${esc(p.event)}${p.note ? ` · ${esc(p.note)}` : ''}</div></span></div>`).join('')}
    </section>`;
}

// ---------- highlight cards: a swipeable rail like the banners in a delivery app ----------
// cards: [{ id, emoji, kicker, title, sub, a, b, ring }]  (a, b = two hues; ring = 0..1 fills a little ring)
export const storiesHtml = (cards) => (cards.length ? `
  <section class="hk-stories" aria-label="Highlights">
    <div class="hk-rail">${cards.map((c) => `<button type="button" class="hk-story" data-story="${esc(c.id)}" style="--a:${c.a ?? 265};--b:${c.b ?? 300}">
      <span class="e">${icon(c.icon)}</span>${c.ring != null ? `<i class="ring" style="--p:${Math.max(0, Math.min(1, c.ring))}"><b>${Math.round(c.ring * 100)}%</b></i>` : ''}
      <small>${esc(c.kicker)}</small><b>${esc(c.title)}</b><span class="s">${esc(c.sub)}</span></button>`).join('')}</div>
    <div class="hk-dots" aria-hidden="true">${cards.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>
  </section>` : '');

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
function tickCountdowns(root) {
  const now = Date.now();
  root.querySelectorAll('[data-at]').forEach((el) => {
    const ms = Date.parse(el.dataset.at) - now;
    let t;
    if (Number.isNaN(ms)) t = '';
    else if (ms <= -2 * 3600000) t = 'Practice is over';
    else if (ms <= 0) t = 'Happening now 🎶';
    else {
      const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
      t = d >= 1 ? `${d}d ${h}h ${pad(mm)}m` : h >= 1 ? `${h}h ${pad(mm)}m` : `${mm} min`;
      el.closest('.hk-hero')?.classList.toggle('now', ms < 3600000);
    }
    if (el.textContent !== t) el.textContent = t;
  });
}
// A number counts up from zero when the home appears.
function countUp(root) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    if (!Number.isFinite(to) || reduced() || to === 0) { el.textContent = el.dataset.count; return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; el.textContent = String(Math.round(to * e)); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
// Switches the home on: staggered entrance, live countdown, counting numbers, an auto-advancing rail, a tiny buzz on taps.
export function wireHome(root, { onStory = null, onQuick = null } = {}) {
  [...root.children].forEach((el, i) => { el.style.setProperty('--i', i); el.classList.add('hk-in'); });
  tickCountdowns(root); countUp(root);
  if (root._hkTimer) clearInterval(root._hkTimer);
  root._hkTimer = setInterval(() => { if (!root.isConnected) return clearInterval(root._hkTimer); tickCountdowns(root); }, 15000);
  const rail = root.querySelector('.hk-rail');
  if (rail) {
    const cards = [...rail.children], dots = [...root.querySelectorAll('.hk-dots i')];
    const near = () => { const x = rail.scrollLeft; let best = 0, bd = 1e9; cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - rail.offsetLeft - x); if (d < bd) { bd = d; best = i; } }); return best; };
    rail.addEventListener('scroll', () => { const k = near(); dots.forEach((d, i) => d.classList.toggle('on', i === k)); }, { passive: true });
    let touched = false;
    rail.addEventListener('pointerdown', () => { touched = true; }, { passive: true });
    if (cards.length > 1 && !reduced()) {
      if (rail._hkAuto) clearInterval(rail._hkAuto);
      rail._hkAuto = setInterval(() => {
        if (!rail.isConnected || touched) return clearInterval(rail._hkAuto);
        const k = (near() + 1) % cards.length;
        rail.scrollTo({ left: cards[k].offsetLeft - rail.offsetLeft, behavior: 'smooth' });
      }, 4500);
    }
  }
  if (root._hkClick) root.removeEventListener('click', root._hkClick); // the home is redrawn often: never stack listeners
  root._hkClick = (e) => {
    const s = e.target.closest('[data-story]'); if (s) { navigator.vibrate?.(8); onStory?.(s.dataset.story); return; }
    const q = e.target.closest('[data-q]'); if (q) { navigator.vibrate?.(8); onQuick?.(q.dataset.q); }
  };
  root.addEventListener('click', root._hkClick);
}
