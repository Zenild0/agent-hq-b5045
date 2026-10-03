// Helpers shared by the parent page and the teacher page.

export const $ = (sel, el = document) => el.querySelector(sel);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtPts = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const fmtDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const typeLabel = (type, event) => ({
  saturday: 'Saturday practice',
  sunday: 'Sunday mass',
  practice: `${event || 'Special'} practice`,
  feast: `${event || 'Special'} mass`,
}[type] || type);

export async function api(path, { method = 'GET', body, pin, code } = {}) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(pin ? { 'x-pin': pin } : {}),
      ...(code ? { 'x-code': code } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- page chrome ----------

export function headerHtml(title, subtitle = '') {
  return `
    <header class="top"><div class="top-inner">
      <img class="logo" src="/logo.png" alt="Choir logo" onerror="this.outerHTML='<div class=\\'logo-fallback\\' aria-hidden=\\'true\\'>🎵</div>'">
      <div class="grow"><h1>${esc(title)}</h1><small>${subtitle}</small></div>
    </div></header>`;
}

export const footerHtml = () =>
  `<footer class="site-foot">Created with ♪ by <b>Zenildo Dias</b></footer>`;

// ---------- faces ----------

const hash = (s) => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const hueOf = (name) => hash(name) % 360;
const initials = (name) => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export function avatarHtml(c, cls = '') {
  const inner = c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : esc(initials(c.name));
  return `<span class="avatar ${cls}" style="--hue:${hueOf(c.name)}">${inner}</span>`;
}

// A little bobble-head: the face wobbles on a spring above static shoulders.
export function bobbleHtml(c, size = 56) {
  const hue = hueOf(c.name);
  const delay = -((hash(c.name) % 20) / 10);
  const face = c.photo ? `<img src="${esc(c.photo)}" alt="${esc(c.name)}">` : esc(initials(c.name));
  return `
    <div class="bobble" style="--size:${size}px;--hue:${hue};--delay:${delay}s">
      <svg class="body" viewBox="0 0 60 24" aria-hidden="true"><path d="M2 24C2 12 14 5 30 5s28 7 28 19z" fill="hsl(${hue} 60% 42%)"/><path d="M22 6l8 9 8-9" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="head">${face}</div>
    </div>`;
}

// ---------- leaderboard ----------

export function boardHtml(rows, { meId = null, empty = 'No points yet — the first practice gets the race started! 🎵' } = {}) {
  const scored = rows.filter((r) => r.points > 0);
  if (!scored.length) {
    return `<div class="empty" style="color:#fff">${esc(empty)}</div>${rows.length ? restHtml(rows, 0, meId, 0) : ''}`;
  }
  const top = scored.slice(0, 3);
  const slotOrder = [1, 0, 2]; // 2nd, 1st, 3rd
  const slots = slotOrder.map((idx) => {
    const r = top[idx];
    if (!r) return '<div></div>';
    return `
      <div class="slot s${idx + 1} rise ${r.id === meId ? 'me-row' : ''}" data-flip="${esc(r.id)}" style="--i:${3 - idx}">
        ${r.rank === 1 ? '<span class="crown" aria-hidden="true">👑</span>' : ''}
        ${bobbleHtml(r, idx === 0 ? 96 : 78)}
        <div class="name">${esc(r.name)}</div>
        <div class="pts">${fmtPts(r.points)} pts</div>
        <div class="step r${idx + 1}" aria-label="Rank ${r.rank}">${r.rank}</div>
      </div>`;
  }).join('');
  const rest = rows.filter((r) => !top.includes(r));
  const max = scored[0].points;
  return `<div class="podium">${slots}</div>${restHtml(rest, max, meId, 3)}`;
}

function restHtml(rows, max, meId, offset) {
  if (!rows.length) return '';
  return `<div class="rest">${rows.map((r, i) => `
    <div class="lb-row rise ${r.id === meId ? 'me-row' : ''}" data-flip="${esc(r.id)}" style="--i:${i}">
      <div class="rank">${r.rank ?? '–'}</div>
      ${bobbleHtml(r, 46)}
      <div class="who"><div class="nm">${esc(r.name)}</div><div class="bar"><i style="width:${max ? Math.max(4, (r.points / max) * 100) : 0}%"></i></div></div>
      <div class="score">${fmtPts(r.points)}<small>pts</small></div>
    </div>`).join('')}</div>`;
}

// Renders a board and slides every face from its old spot to its new one (FLIP),
// so switching month/year makes the children visibly move up or down.
export function renderBoard(el, rows, opts) {
  const before = new Map();
  el.querySelectorAll('[data-flip]').forEach((n) => before.set(n.dataset.flip, n.getBoundingClientRect()));
  el.innerHTML = boardHtml(rows, opts);
  if (!before.size || reducedMotion()) return;
  el.querySelectorAll('.rise').forEach((n) => n.classList.remove('rise'));
  el.querySelectorAll('[data-flip]').forEach((n) => {
    const b = before.get(n.dataset.flip);
    if (!b) return;
    const r = n.getBoundingClientRect();
    const dx = b.left - r.left;
    const dy = b.top - r.top;
    if (dx || dy) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  });
}

// ---------- achievers ----------

function winnersHtml(winners) {
  if (!winners.length) return '<div class="muted">No points yet</div>';
  return `<div class="winners">${winners.map((w) => `
    <div class="w"><span class="crown" aria-hidden="true">👑</span>${bobbleHtml(w, 64)}${esc(w.name)}<small>${fmtPts(w.points)} pts</small></div>`).join('')}</div>`;
}

export function achieversHtml(list, { kind, empty }) {
  if (!list.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="ach-grid">${list.map((a) => `
    <div class="ach ${kind}">
      <div class="when">${kind === 'year' ? '🏆' : '⭐'} ${esc(a.label)}</div>
      ${a.inProgress ? '<span class="badge info">leading right now</span>' : ''}
      ${winnersHtml(a.winners)}
    </div>`).join('')}</div>`;
}

// ---------- child detail ----------

export function leaveBadge(leaves, max, exceeded) {
  const cls = exceeded ? 'bad' : leaves >= max - 1 ? 'warn' : 'ok';
  return `<span class="badge ${cls}">${leaves}/${max} leaves</span>`;
}

const STATUS_LABEL = { present: 'Present', absent: 'Absent', excused: 'Excused (sick)' };

export function historyHtml(history) {
  if (!history.length) return '<div class="empty">No attendance recorded yet.</div>';
  return `<table><tbody>${history.map((h) => `
    <tr>
      <td>${fmtDate(h.date)}<div class="muted">${esc(typeLabel(h.type, h.event))}</div></td>
      <td><span class="badge ${h.status === 'present' ? 'ok' : h.status === 'absent' ? 'bad' : 'info'}">${STATUS_LABEL[h.status]}</span>
        ${h.remarks.map((r) => `<span class="badge ${r === 'Well behaved' || r === 'Helped others' ? 'ok' : 'warn'}">${esc(r)}</span>`).join(' ')}
        ${h.note ? `<div class="muted">📝 ${esc(h.note)}</div>` : ''}</td>
      <td class="num">${h.points ? `+${fmtPts(h.points)}` : '0'}</td>
    </tr>`).join('')}</tbody></table>`;
}

export function statsHtml(d) {
  const { stats: st, settings: s } = d;
  return `
    <div class="stats">
      <div class="stat"><b>${fmtPts(st.points)}</b>points this year</div>
      <div class="stat"><b>${d.yearRank ?? '–'}${d.yearRank ? `<small class="muted"> / ${d.yearRanked}</small>` : ''}</b>year rank</div>
      <div class="stat"><b>${d.monthRank ?? '–'}</b>rank in ${esc(d.monthLabel)}</div>
      <div class="stat"><b>${st.leaves}/${s.maxLeaves}</b>leaves used</div>
      <div class="stat"><b>${st.present}</b>present (${st.late} late)</div>
    </div>`;
}

export function leaveAlertHtml(d) {
  const { stats: st, settings: s } = d;
  if (st.exceeded) {
    return `<div class="alert bad"><b>Not continuing this year.</b> ${esc(d.name)} went over ${s.maxLeaves} leaves (from ${fmtDate(st.leftOn)}). They are welcome to rejoin next April.</div>`;
  }
  if (st.leavesLeft <= 1) {
    const left = st.leavesLeft ? `only ${st.leavesLeft} leave left` : 'no leaves left';
    return `<div class="alert warn"><b>Careful:</b> ${left} this year — one more unexcused absence and ${esc(d.name)} can't continue.</div>`;
  }
  return '';
}
