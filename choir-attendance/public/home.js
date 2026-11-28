// The parent home screen: next practice, practice days (with the child's attendance), and the child's remarks.
import { icon } from './icons.js';
import { esc, fmtPts, fmtDate, avatarHtml, bobbleHtml, isGood, remarkLabel } from './common.js';

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
  `<nav class="hk-grid" style="--n:${items.length <= 5 ? Math.max(items.length, 1) : 4}" aria-label="Quick links">${items.map((i) => `<button type="button" class="hk-q" data-q="${esc(i.id)}"><span class="ic" style="--h:${snapHue(i.hue ?? 260)}" aria-hidden="true">${icon(i.icon)}${i.badge ? `<i>${esc(i.badge)}</i>` : ''}</span><b>${esc(i.label)}</b></button>`).join('')}</nav>`;

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
  const extraLabel = (h) => ({ saturday: '', sunday: 'Mass', practice: h.event || 'Special', feast: h.event || 'Special occasion' }[h.type] ?? '');
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
      <p class="muted" style="margin:6px 0 0">Welcome! You are part of ${me.events?.length === 1 ? esc(me.events[0].name) : 'our special events'}. Hymns are free to browse, and Music Lab is free to try for a few days.</p>
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

// Palette A (Midnight Violet): every tile and card uses one of five hues, so the app reads as one product.
const PALETTE_HUES = [252, 349, 42, 162, 207]; // violet, coral, gold, mint, sky
export const snapHue = (h) => { const n = ((Number(h) || 0) % 360 + 360) % 360; return PALETTE_HUES.reduce((best, p) => (Math.min(Math.abs(p - n), 360 - Math.abs(p - n)) < Math.min(Math.abs(best - n), 360 - Math.abs(best - n)) ? p : best)); };

// ---------- highlight cards: a swipeable rail like the banners in a delivery app ----------
// cards: [{ id, emoji, kicker, title, sub, a, b, ring }]  (a, b = two hues; ring = 0..1 fills a little ring)
export const storiesHtml = (cards) => (cards.length ? `
  <section class="hk-stories" aria-label="Highlights">
    <div class="hk-rail">${cards.map((c) => `<button type="button" class="hk-story" data-story="${esc(c.id)}" style="--a:${snapHue(c.a ?? 265)};--b:${snapHue(c.a ?? 265) - 16}">
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

// ---------- the leaderboard on the children's home: a podium, where you stand, and how to climb ----------
// rows: the month or year board (already short names, sorted by rank). meId: this child, if signed in.
export function homeBoardHtml(o, meId, range = 'month') {
  const rows = (range === 'year' ? o.yearBoard : o.monthBoard) ?? [];
  const live = rows.filter((r) => r.points > 0);
  const seg = `<div class="hb-seg" role="group" aria-label="Leaderboard period">${[['month', o.monthLabel?.split(' ')[0] || 'This month'], ['year', 'This year']].map(([id, l]) => `<button type="button" data-hb="${id}" class="${range === id ? 'on' : ''}" aria-pressed="${range === id}">${esc(l)}</button>`).join('')}</div>`;
  const head = `<div class="hb-top"><div><small>CHOIR LEADERBOARD</small><h3>Who is on top? 🏆</h3></div>${seg}</div>`;
  if (!live.length) return `<section class="hb">${head}<div class="hb-empty">🎤 The race starts at the next practice. Be there and grab the first points!</div></section>`;
  const pod = (r, place) => r ? `
    <div class="hb-p p${place}${r.id === meId ? ' me' : ''}">
      ${place === 1 ? '<span class="hb-crown" aria-hidden="true">👑</span>' : ''}
      <div class="hb-face">${bobbleHtml(r, place === 1 ? 66 : 52)}</div>
      <b class="hb-n">${r.id === meId ? 'You' : esc(r.name)}</b>
      <span class="hb-pts">${fmtPts(r.points)} pts</span>
      <div class="hb-block"><span>${r.rank}</span></div>
    </div>` : '<div class="hb-p empty"></div>';
  const [a, b, c] = live;
  const mine = rows.find((r) => r.id === meId);
  let you = '';
  if (meId && mine) {
    const ahead = [...rows].reverse().find((r) => r.points > mine.points);
    const per = o.settings?.satPoints || 1;
    if (mine.rank === 1) you = `<div class="hb-you lead"><b>You are leading! 👑</b><span>Keep coming to practice to stay on top.</span></div>`;
    else if (ahead) {
      const gap = ahead.points - mine.points, n = Math.max(1, Math.ceil(gap / per));
      you = `<div class="hb-you"><div class="hb-rank">#${mine.rank}</div><div class="grow"><b>${gap <= per ? 'So close!' : 'You can catch up!'} ${fmtPts(gap)} pt${gap === 1 ? '' : 's'} behind ${esc(ahead.name)}</b><span>${n === 1 ? 'One more practice could catch them.' : `About ${n} practices to catch them.`}</span>
        <i class="hb-bar"><i style="width:${Math.max(8, Math.min(100, Math.round((100 * mine.points) / Math.max(1, ahead.points))))}%"></i></i></div></div>`;
    }
  } else if (meId) you = '<div class="hb-you"><b>Come to practice to join the board!</b><span>Every practice earns points.</span></div>';
  const rest = live.slice(3, 6);
  const meBelow = mine && mine.rank > 6 && mine.points > 0 ? mine : null;
  return `<section class="hb">
    ${head}
    <div class="hb-podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>
    ${you}
    ${rest.length || meBelow ? `<div class="hb-list">${[...rest, ...(meBelow ? [meBelow] : [])].map((r) => `<div class="hb-row${r.id === meId ? ' me' : ''}"><b>${r.rank}</b>${avatarHtml({ name: r.name, photo: r.head || r.photo }, 'sm')}<span class="grow">${r.id === meId ? 'You' : esc(r.name)}</span><em>${fmtPts(r.points)} pts</em></div>`).join('')}</div>` : ''}
    <button type="button" class="hb-all" data-q="board">See the full leaderboard ›</button>
  </section>`;
}

// The Music Lab leaderboard (this week's XP), with the same podium as the home board. d = the me/xp-board answer.
export function labBoardHtml(d) {
  const head = (extra = '') => `<div class="hb-top"><div><small>MUSIC LAB LEADERBOARD</small><h3>This week's stars ⚡</h3></div><span class="hb-chip">Resets Monday</span>${extra}</div>`;
  if (d.locked) return `<section class="hb lab">${head()}<div class="hb-empty">🔒 The weekly board is for children with the full Music Lab. Your own XP and streak still count below.</div></section>`;
  const rows = (d.week?.top ?? []).filter((r) => r.xp > 0), meId = d.meId;
  if (!rows.length) return `<section class="hb lab">${head()}<div class="hb-empty">⚡ Nobody has XP yet this week. Play one round and you are on top!</div></section>`;
  const pod = (r, place) => (r ? `<div class="hb-p p${place}${r.id === meId ? ' me' : ''}">${place === 1 ? '<span class="hb-crown" aria-hidden="true">👑</span>' : ''}<div class="hb-face">${bobbleHtml(r, place === 1 ? 62 : 48)}</div><b class="hb-n">${r.id === meId ? 'You' : esc(r.name)}</b><span class="hb-pts">${r.xp} XP</span><div class="hb-block"><span>${r.rank}</span></div></div>` : '<div class="hb-p empty"></div>');
  const [a, b, c] = rows, mine = rows.find((r) => r.id === meId);
  let you = '';
  if (mine) {
    const ahead = [...rows].reverse().find((r) => r.xp > mine.xp);
    you = mine.rank === 1 ? '<div class="hb-you lead"><b>You are the star of the week! 👑</b><span>Keep your streak going to stay on top.</span></div>'
      : ahead ? `<div class="hb-you"><div class="hb-rank">#${mine.rank}</div><div class="grow"><b>${ahead.xp - mine.xp} XP behind ${esc(ahead.name)}</b><span>${ahead.xp - mine.xp <= 30 ? 'One good round could do it!' : 'A few rounds this week and you are there.'}</span><i class="hb-bar"><i style="width:${Math.max(8, Math.round((100 * mine.xp) / Math.max(1, ahead.xp)))}%"></i></i></div></div>` : '';
  } else if (d.week?.me) you = `<div class="hb-you"><div class="hb-rank">#${d.week.me.rank}</div><div class="grow"><b>${d.week.me.xp} XP this week</b><span>Play a round to climb the board.</span></div></div>`;
  else you = '<div class="hb-you"><b>Not on the board yet this week</b><span>Play one round to join!</span></div>';
  return `<section class="hb lab">${head()}<div class="hb-podium">${pod(b, 2)}${pod(a, 1)}${pod(c, 3)}</div>${you}
    ${rows.length > 3 ? `<div class="hb-list">${rows.slice(3, 6).map((r) => `<div class="hb-row${r.id === meId ? ' me' : ''}"><b>${r.rank}</b>${avatarHtml({ name: r.name, photo: r.head || r.photo }, 'sm')}<span class="grow">${r.id === meId ? 'You' : esc(r.name)}</span><em>${r.xp} XP</em></div>`).join('')}</div>` : ''}
    <button type="button" class="hb-all" data-q="board">See the full Music Lab board ›</button></section>`;
}

// ---------- leaves on the children's home: always visible, gentle until it matters ----------
// Only missed Saturday practices count (and Sunday mass if the teacher switched that on). Medical leave and special
// occasions never count. At one below the limit: a warning. At the limit and above: you have gone over, a break may follow.
export function leaveMeterHtml(me) {
  const st = me?.stats, s = me?.settings;
  if (!st || !s || me.guest) return '';
  const max = s.maxLeaves ?? 5, n = st.leaves ?? 0, decision = st.decision?.status;
  const what = s.countSundayAbsences ? 'missed Saturday practices and Sunday masses' : 'missed Saturday practices';
  const dots = Array.from({ length: Math.max(max, n) }, (_, i) => `<i class="${i < n ? (i >= max ? 'over' : 'used') : ''}"></i>`).join('');
  const dates = (st.leaveDates ?? []).slice(-3).map((d) => esc(fmtDate(d).replace(/ \d{4}$/, '').replace(/^\w+,? /, ''))).join(' · ');
  let tone = 'ok', title, body;
  if (decision === 'out') { tone = 'bad'; title = 'Taking a break this year'; body = 'Your teacher has decided you will take a break until next year. You are welcome back next April.'; }
  else if (decision === 'keep' && n >= max) { tone = 'warn'; title = `${n} leaves this year · your teacher says you can continue`; body = 'Please try to come to every practice from now on.'; }
  else if (n >= max) { tone = 'bad'; title = `${n} leaves: over the limit for this year`; body = 'You have gone over the number of leaves allowed this year, and you may have to take a break until next year. Please talk to your choir teacher.'; }
  else if (n === max - 1) { tone = 'warn'; title = `${n} of ${max} leaves used`; body = 'Careful! One more leave and you may have to take a break until next year. Please try to come every Saturday.'; }
  else if (n > 0) { tone = 'mid'; title = `${n} of ${max} leaves used this year`; body = `Only ${what} count. Medical leave and special occasions do not.`; }
  else { title = 'No leaves this year 🌟'; body = 'Great going! Keep coming every Saturday.'; }
  return `<button type="button" class="lv lv-${tone}" data-q="child" aria-label="${esc(title)}. ${esc(body)}">
    <span class="lv-ic" aria-hidden="true">${tone === 'bad' ? '🚫' : tone === 'warn' ? '⚠️' : tone === 'mid' ? '🗓' : '✅'}</span>
    <span class="lv-main"><b>${esc(title)}</b><span>${esc(body)}</span>${n && dates ? `<small>Missed: ${dates}</small>` : ''}</span>
    <span class="lv-dots" aria-hidden="true">${dots}</span>
  </button>`;
}
