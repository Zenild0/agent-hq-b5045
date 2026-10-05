// Helpers shared by the parent page and the teacher page.

export const $ = (sel, el = document) => el.querySelector(sel);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtPts = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

export const ptsText = (n) => `${fmtPts(n)} ${n === 1 ? 'pt' : 'pts'}`;

export const fmtDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const typeLabel = (type, event) => ({
  saturday: 'Saturday practice',
  sunday: 'Sunday mass',
  practice: `${event || 'Special'} practice`,
  feast: `${event || 'Special'} mass`,
}[type] || type);

export async function api(path, { method = 'GET', body, pin, code } = {}) {
  let res;
  try {
    res = await fetch(`/api/${path}`, {
    signal: AbortSignal.timeout?.(20000), // a server that never answers must not leave a blank screen for ever
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(pin ? { 'x-pin': pin } : {}),
      ...(code ? { 'x-code': code } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw Object.assign(new Error(e?.name === 'TimeoutError' ? 'The server is taking too long to answer. Please try again.' : 'Could not reach the server. Please check your internet connection.'), { network: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { status: res.status });
  return data;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------- page chrome ----------

export function headerHtml(title, subtitle = '') {
  return `
    <header class="top"><div class="top-inner">
      <img class="logo" src="/logo.png" width="60" height="60" alt="Children's Choir ZD logo" onerror="this.outerHTML='<div class=\\'logo-fallback\\' aria-hidden=\\'true\\'>🎵</div>'">
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
  const pic = c.head || c.photo; // the bobble-head shows the tight face crop; older photos fall back to the profile photo
  const face = pic ? `<img src="${esc(pic)}" alt="${esc(c.name)}">` : esc(initials(c.name));
  return `
    <div class="bobble${pic ? ' photo' : ''}" style="--size:${size}px;--hue:${hue};--delay:${delay}s">
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
  // Podium slots by rank (silver, gold, bronze). Everyone sharing a rank stands on the same step.
  const groups = [2, 1, 3].map((rk) => scored.filter((r) => r.rank === rk));
  const short = (n) => { const w = n.trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : w[0]; };
  const slots = groups.map((g, i) => {
    const rk = [2, 1, 3][i];
    if (!g.length) return '<div></div>';
    const many = g.length > 1;
    const size = g.length === 1 ? (rk === 1 ? 96 : 78) : g.length === 2 ? 64 : g.length === 3 ? 54 : 46;
    return `
      <div class="slot s${rk} rise" style="--i:${4 - rk}">
        <div class="grp${rk === 1 && g.length > 2 ? ' tall' : ''}">${g.map((r) => `
          <div class="pp ${r.id === meId ? 'me-row' : ''}" data-flip="${esc(r.id)}" style="--size:${size}px">
            ${rk === 1 ? '<span class="crown" aria-hidden="true">👑</span>' : ''}
            ${bobbleHtml(r, size)}
            <div class="name${many ? ' sm' : ''}" title="${esc(r.name)}">${esc(many ? short(r.name) : r.name)}</div>
          </div>`).join('')}</div>
        <div class="pts">${ptsText(g[0].points)}</div>
        <div class="step r${rk}" aria-label="Rank ${rk}">${rk}</div>
      </div>`;
  }).join('');
  const weights = groups.map((g, i) => Math.max(1, g.length) * (i === 1 ? 1.15 : 1));
  const rest = scored.filter((r) => r.rank > 3).concat(rows.filter((r) => r.points <= 0));
  const max = scored[0].points;
  return `<div class="podium" style="grid-template-columns:${weights.map((w) => `${w}fr`).join(' ')}">${slots}</div>${restHtml(rest, max, meId, 3)}`;
}

function restHtml(rows, max, meId, offset) {
  if (!rows.length) return '';
  return `<div class="rest">${rows.map((r, i) => `
    <div class="lb-row rise ${r.id === meId ? 'me-row' : ''}" data-flip="${esc(r.id)}" style="--i:${i}">
      <div class="rank">${r.rank ?? '–'}</div>
      ${bobbleHtml(r, 46)}
      <div class="who"><div class="nm">${esc(r.name)}</div><div class="bar"><i style="width:${max ? Math.max(4, (r.points / max) * 100) : 0}%"></i></div></div>
      <div class="score">${fmtPts(r.points)}<small>${r.points === 1 ? 'pt' : 'pts'}</small></div>
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
    <div class="w"><span class="crown" aria-hidden="true">👑</span>${bobbleHtml(w, 64)}${esc(w.name)}<small>${ptsText(w.points)}</small></div>`).join('')}</div>`;
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

export const isGood = (r) => r === 'Well behaved' || r === 'Helped others';

const statusLabel = (h) => (h.status === 'excused' ? `Excused – ${h.reason ? h.reason.toLowerCase() : 'medical'}` : h.status === 'present' ? 'Present' : 'Absent');

export function historyHtml(history) {
  if (!history.length) return '<div class="empty">No attendance recorded yet.</div>';
  return `<table><tbody>${history.map((h) => `
    <tr>
      <td>${fmtDate(h.date)}<div class="muted">${esc(typeLabel(h.type, h.event))}</div></td>
      <td><span class="badge ${h.status === 'present' ? 'ok' : h.status === 'absent' ? 'bad' : 'info'}">${esc(statusLabel(h))}</span>
        ${h.remarks.map((r) => `<span class="badge ${isGood(r) ? 'ok' : 'warn'}">${esc(r)}</span>`).join(' ')}
        ${h.note ? `<div class="muted">📝 ${esc(h.note)}</div>` : ''}</td>
      <td class="num">${h.points ? `+${fmtPts(h.points)}` : '0'}${h.bonus ? `<div class="muted">+${fmtPts(h.bonus)} good remarks</div>` : ''}${h.deduction ? `<div class="muted">−${fmtPts(h.deduction)} for remarks</div>` : ''}</td>
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

export function leaveAlertHtml(d, { teacher = false } = {}) {
  const { stats: st, settings: s } = d;
  const decision = st.decision?.status;
  if (decision === 'out') {
    return `<div class="alert bad"><b>Not continuing this year.</b> ${esc(d.name)} went over ${s.maxLeaves} leaves. They are welcome to rejoin next April.</div>`;
  }
  if (st.exceeded) {
    if (teacher || decision === 'keep') return ''; // teacher sees the decision panel instead
    return `<div class="alert warn"><b>Leave limit passed.</b> ${esc(d.name)} has used more than ${s.maxLeaves} leaves this year. Your choir teacher will be in touch.</div>`;
  }
  if (st.leavesLeft <= 1) {
    const left = st.leavesLeft ? `only ${st.leavesLeft} leave left` : 'no leaves left';
    return `<div class="alert warn"><b>Careful:</b> ${left} this year. Please try to attend every practice.</div>`;
  }
  return '';
}

// Teacher's student view: every remark and note, with the date it was given.
export function remarksLogHtml(log) {
  if (!log?.length) return '<div class="empty">No remarks or notes yet.</div>';
  const all = log.flatMap((x) => x.remarks);
  const good = all.filter(isGood).length;
  const bad = all.length - good;
  const lost = log.reduce((n, x) => n + (x.deduction || 0), 0);
  const gained = log.reduce((n, x) => n + (x.bonus || 0), 0);
  return `
    <div class="muted" style="margin-bottom:6px">👍 ${good} good · ⚠️ ${bad} to improve${gained ? ` · +${fmtPts(gained)} gained` : ''}${lost ? ` · −${fmtPts(lost)} lost` : ''}</div>
    ${log.map((x) => `
      <div class="rlog">
        <div class="row between"><b>${fmtDate(x.date)}</b><span class="muted">${esc(typeLabel(x.type, x.event))}${x.status === 'absent' ? ' · absent' : x.status === 'excused' ? ' · medical' : ''}</span></div>
        <div>${x.remarks.map((r) => `<span class="badge ${isGood(r) ? 'ok' : 'warn'}">${esc(r)}</span>`).join(' ')}${x.bonus ? ` <span class="badge ok">+${fmtPts(x.bonus)}</span>` : ''}${x.deduction ? ` <span class="badge bad">−${fmtPts(x.deduction)}</span>` : ''}</div>
        ${x.note ? `<div class="muted">📝 ${esc(x.note)}</div>` : ''}
      </div>`).join('')}`;
}

// ---------- hymn viewer: large, readable, with a full-screen button ----------

let viewer;
const readSize = () => { try { return Number(localStorage.getItem('choir-hv-size')) || 1.4; } catch { return 1.4; } };

export function openHymnViewer(h, categoryLabel = '') {
  if (!viewer) {
    viewer = document.createElement('dialog');
    viewer.className = 'hv';
    document.body.appendChild(viewer);
    viewer.addEventListener('close', () => {
      viewer.querySelector('audio')?.pause();
      if (document.fullscreenElement) document.exitFullscreen?.();
    });
    document.addEventListener('fullscreenchange', () => {
      const b = viewer.querySelector('[data-hv=full]');
      if (b) b.textContent = document.fullscreenElement ? '⤢' : '⛶';
    });
  }
  const link = /^https?:\/\//i.test(h.link || '') ? h.link : '';
  viewer.innerHTML = `
    <div class="hv-bar">
      <button class="ibtn" data-hv="close" title="Close" aria-label="Close">✕</button>
      <span class="grow"></span>
      <button class="ibtn" data-hv="smaller" aria-label="Smaller text">A−</button>
      <button class="ibtn" data-hv="bigger" aria-label="Bigger text">A+</button>
      ${document.fullscreenEnabled ? '<button class="ibtn" data-hv="full" title="Full screen" aria-label="Full screen">⛶</button>' : ''}
    </div>
    <div class="hv-body" style="--hv-size:${readSize()}rem">
      ${categoryLabel ? `<div class="muted">${esc(categoryLabel)}</div>` : ''}
      <h2 class="hv-title">${esc(h.title)}${h.notes ? ` <span class="muted hnote">(${esc(h.notes)})</span>` : ''}</h2>
      ${h.audio ? `<audio controls preload="none" src="${esc(h.audio)}"></audio>` : ''}
      ${link ? `<p><a class="ibtn" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="Open music link" aria-label="Open music link">🔗</a></p>` : ''}
      ${h.lyrics ? `<div class="hv-lyrics">${esc(h.lyrics)}</div>` : '<div class="muted" style="margin-top:14px">No lyrics have been added for this hymn yet.</div>'}
    </div>`;
  const body = viewer.querySelector('.hv-body');
  const resize = (delta) => {
    const next = Math.min(3.4, Math.max(0.9, readSize() + delta));
    try { localStorage.setItem('choir-hv-size', String(next)); } catch { /* private mode */ }
    body.style.setProperty('--hv-size', `${next}rem`);
  };
  viewer.querySelector('[data-hv=close]').addEventListener('click', () => viewer.close());
  viewer.querySelector('[data-hv=smaller]').addEventListener('click', () => resize(-0.2));
  viewer.querySelector('[data-hv=bigger]').addEventListener('click', () => resize(0.2));
  viewer.querySelector('[data-hv=full]')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else viewer.requestFullscreen?.().catch(() => {});
  });
  if (!viewer.open) viewer.showModal();
  viewer.scrollTo?.(0, 0);
}

// WhatsApp link that opens the chat with this number directly (message pre-filled).
// No country code given: 10-digit numbers are treated as Indian (+91). No number saved: falls back to the contact picker.
export function waLink(phone, text) {
  let d = String(phone ?? '').trim();
  const plus = d.startsWith('+');
  d = d.replace(/\D/g, '');
  if (!plus) {
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('0')) d = `91${d.slice(1)}`;
    else if (d.length === 10) d = `91${d}`;
  }
  return `https://wa.me/${d.length >= 8 ? d : ''}?text=${encodeURIComponent(text)}`;
}
