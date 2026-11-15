// The hymn library, one design for the children and the teacher.
// Search first (title, notes and the words themselves), categories as quick chips instead of folders,
// favourites and recently opened hymns on this phone, and a calm reading screen (see openHymnViewer in common.js).
import { esc, openHymnViewer, hymnPrefs } from './common.js';

const HUES = [265, 200, 330, 25, 150, 45, 300, 175];
const hueOf = (s) => HUES[[...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];
const letter = (t) => { const l = String(t).trim()[0]?.toUpperCase() ?? '#'; return /[A-Z]/.test(l) ? l : '#'; };
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });

export function mountHymnBrowser(host, { categories, hymns, teacher = false, onEdit = null, empty = 'Hymns will appear here once your teacher adds them.' }) {
  let q = '', cat = hymnPrefs.lastCat();
  if (cat !== 'all' && cat !== 'fav' && !categories.some((c) => c.id === cat)) cat = 'all';
  const label = (h) => categories.find((c) => c.id === h.category)?.label || '';
  const hay = (h) => `${h.title} ${h.notes || ''} ${h.lyrics || ''}`.toLowerCase();

  host.innerHTML = `
    <div class="hl">
      <label class="hl-search"><span class="sr">Search hymns</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" placeholder="Search a hymn or a word in it…" autocomplete="off" aria-label="Search hymns"></label>
      <div class="hl-chips" role="tablist" aria-label="Hymn groups"></div>
      <div class="hl-recent"></div>
      <div class="hl-list" aria-live="polite"></div>
    </div>`;
  const input = host.querySelector('input'), chips = host.querySelector('.hl-chips'), recent = host.querySelector('.hl-recent'), list = host.querySelector('.hl-list');

  const visible = () => {
    const term = q.trim().toLowerCase();
    const favs = hymnPrefs.favs();
    return hymns.filter((h) => (cat === 'all' || (cat === 'fav' ? favs.has(h.id) : h.category === cat)) && (!term || hay(h).includes(term))).sort(byTitle);
  };

  function paintChips() {
    const favs = hymnPrefs.favs();
    const n = (id) => hymns.filter((h) => h.category === id).length;
    const all = [['all', 'All', hymns.length], ['fav', '❤ Favourites', hymns.filter((h) => favs.has(h.id)).length], ...categories.filter((c) => n(c.id)).map((c) => [c.id, c.label, n(c.id)])];
    chips.innerHTML = all.map(([id, text, count]) => `<button type="button" role="tab" class="hl-chip${cat === id ? ' on' : ''}" data-cat="${esc(id)}" aria-selected="${cat === id}">${esc(text)}<b>${count}</b></button>`).join('');
  }
  function row(h) {
    const fav = hymnPrefs.favs().has(h.id), hue = hueOf(h.category || h.title);
    return `<div class="hl-row" data-open="${esc(h.id)}" role="button" tabindex="0" aria-label="Open ${esc(h.title)}">
      <span class="hl-disc" style="--h:${hue}" aria-hidden="true">${esc(letter(h.title))}</span>
      <span class="hl-main"><b>${esc(h.title)}</b><small>${esc(label(h))}${h.notes ? ` · ${esc(h.notes)}` : ''}</small></span>
      <span class="hl-tags" aria-hidden="true">${h.audio ? '🎧' : ''}${h.link ? '🔗' : ''}</span>
      <button type="button" class="hl-heart${fav ? ' on' : ''}" data-fav="${esc(h.id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from favourites' : 'Add to favourites'}">${fav ? '♥' : '♡'}</button>
      ${teacher && onEdit ? `<button type="button" class="hl-edit" data-edit="${esc(h.id)}" aria-label="Edit ${esc(h.title)}">✎</button>` : ''}
    </div>`;
  }
  function paintList() {
    const items = visible();
    const showRecent = !q.trim() && cat === 'all';
    const rec = showRecent ? hymnPrefs.recent().map((id) => hymns.find((h) => h.id === id)).filter(Boolean).slice(0, 4) : [];
    recent.innerHTML = rec.length ? `<div class="hl-sec">Continue</div><div class="hl-rec">${rec.map((h) => `<button type="button" class="hl-card" data-open="${esc(h.id)}" style="--h:${hueOf(h.category || h.title)}"><span>${esc(letter(h.title))}</span><b>${esc(h.title)}</b></button>`).join('')}</div>` : '';
    if (!hymns.length) { list.innerHTML = `<div class="empty">${esc(empty)}</div>`; return; }
    if (!items.length) { list.innerHTML = `<div class="empty">${cat === 'fav' && !q.trim() ? 'Tap the ♡ on a hymn to keep it here.' : `No hymn matches${q.trim() ? ` “${esc(q.trim())}”` : ''}.`}</div>`; return; }
    let html = '', last = '';
    for (const h of items) {
      const L = letter(h.title);
      if (items.length > 10 && L !== last) { html += `<div class="hl-sec hl-letter">${esc(L)}</div>`; last = L; }
      html += row(h);
    }
    list.innerHTML = html;
  }
  const repaint = () => { paintChips(); paintList(); };
  function open(id) {
    const items = visible().length ? visible() : hymns;
    const h = hymns.find((x) => x.id === id); if (!h) return;
    const seq = items.some((x) => x.id === id) ? items : [h];
    hymnPrefs.seen(id);
    openHymnViewer(h, label(h), { list: seq, labelOf: label, onNav: (x) => hymnPrefs.seen(x.id), onClose: () => paintList() });
  }

  input.addEventListener('input', () => { q = input.value; paintList(); });
  chips.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; hymnPrefs.setLastCat(cat); repaint(); b.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' }); });
  host.addEventListener('click', (e) => {
    const f = e.target.closest('[data-fav]');
    if (f) { e.stopPropagation(); hymnPrefs.toggleFav(f.dataset.fav); repaint(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { e.stopPropagation(); onEdit(hymns.find((x) => x.id === ed.dataset.edit)); return; }
    const o = e.target.closest('[data-open]');
    if (o) open(o.dataset.open);
  });
  host.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.hl-row')) { e.preventDefault(); open(e.target.dataset.open); } });
  repaint();
  return { setQuery: (t) => { input.value = q = t; paintList(); }, repaint };
}
