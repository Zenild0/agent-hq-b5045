// Voice Care Corner: this week's tip about looking after a young voice, and the ones before it.
// A new tip appears every Friday at 6 pm. Open to every child. The last list is kept so it opens without a signal.
import { api, esc } from './common.js';

const SEEN = (code) => `choir-tips-seen:${code}`;
const CACHE = (code) => `choir-tips-cache:${code}`;
export const markTipsSeen = (code, id) => { try { localStorage.setItem(SEEN(code), id); } catch { /* private mode */ } };
export const tipsSeen = (code) => { try { return localStorage.getItem(SEEN(code)) || ''; } catch { return ''; } };

const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).replace(/^0/, '');

// What the hub needs to show a "NEW" dot: the newest tip and whether this child has seen it.
export async function newestTip(code) {
  try {
    const d = await api('me/voice-tips', { code });
    try { localStorage.setItem(CACHE(code), JSON.stringify(d)); } catch { /* storage full */ }
    const t = d.tips[0];
    return t ? { id: t.id, isNew: Boolean(t.isNew) && tipsSeen(code) !== t.id } : null;
  } catch { return null; }
}

export function mountVoiceTips(host, { code }) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const card = (t, big) => `
    <article class="card vt-card${big ? ' vt-big' : ''}">
      <div class="row between"><span class="badge info">${esc(t.tag)}</span><span class="muted vt-date">${t.custom ? '' : `${fmt(t.at)}`}${t.isNew ? ' · <b class="vt-new">NEW</b>' : ''}</span></div>
      <h3 class="vt-title"><span aria-hidden="true">${esc(t.emoji)}</span> ${esc(t.title)}</h3>
      <p class="vt-body">${esc(t.body)}</p>
      ${t.challenge ? `<div class="vt-try">✅ <b>Try it:</b> ${esc(t.challenge)}</div>` : ''}
      ${t.link ? `<a class="btn small" href="${esc(t.link)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(t.linkLabel || 'Read more')}</a>` : ''}
    </article>`;
  const draw = (d, offline) => {
    const [first, ...rest] = d.tips;
    if (first) markTipsSeen(code, first.id);
    root.innerHTML = `
      <div class="card vt-head"><h2 style="margin:0">💧 Voice Care Corner</h2>
        <div class="muted">Little tips to keep your voice happy and healthy. A new one arrives every Friday at 6 pm.</div>
        ${offline ? '<div class="alert warn" style="margin-top:8px">No signal. Showing the tips this phone saw last.</div>' : ''}
        ${d.next ? `<div class="vt-next">⏳ Next tip: <b>${fmt(d.next)}, ${fmtTime(d.next)}</b></div>` : '<div class="vt-next">You have read every tip so far. Your teacher may add more!</div>'}</div>
      ${first ? card(first, true) : '<div class="empty">The first tips arrive soon.</div>'}
      ${rest.length ? `<h3 style="margin:14px 0 6px">Earlier tips</h3>${rest.map((t) => card(t, false)).join('')}` : ''}
      <div class="muted vt-fine">These are general tips for healthy singing, not medical advice. If your throat hurts or your voice stays hoarse, tell a grown-up and see a doctor.</div>`;
  };
  (async () => {
    root.innerHTML = '<div class="empty">Loading…</div>';
    try {
      const d = await api('me/voice-tips', { code });
      try { localStorage.setItem(CACHE(code), JSON.stringify(d)); } catch { /* storage full */ }
      draw(d, false);
    } catch (e) {
      let d = null;
      if (!e.status) { try { d = JSON.parse(localStorage.getItem(CACHE(code)) || 'null'); } catch { d = null; } }
      if (d) draw(d, true); else root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div></div>`;
    }
  })();
  return { destroy() {}, back() { return false; } };
}
