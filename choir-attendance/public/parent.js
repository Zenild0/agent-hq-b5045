import {
  $, api, esc, fmtPts, headerHtml, footerHtml, renderBoard, achieversHtml, avatarHtml,
  statsHtml, historyHtml, leaveAlertHtml, openHymnViewer,
} from './common.js';
import { nextCardHtml, daysFoldHtml, remarksFoldHtml } from './home.js';
import { pickPhotos } from './photo.js';
import { applyLook, lookCardHtml, wireLook } from './theme.js';
import { trioHtml } from './home.js';

const store = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } },
};

let overview;
let tab = 'home';
let range = 'month';
let code = store.get('choir-code');
let me = null;
let season = null;

// A parent link looks like /?c=ABCD-2345 — remember it, then tidy the address bar.
const fromLink = new URLSearchParams(location.search).get('c');
if (fromLink) {
  code = fromLink.toUpperCase().replace(/[^A-Z0-9]/g, '');
  store.set('choir-code', code);
  history.replaceState(null, '', location.pathname);
  tab = 'child';
}

// Offline: the last data this phone loaded is kept here and used only when the network fails.
// "Not your child? Switch" clears it. Nothing is shared with other devices.
const CACHE_PREFIX = 'choir-cache:';
let usedSaved = false;
function cachedApi(path, opts = {}) {
  const key = `${CACHE_PREFIX}${path}|${opts.code || ''}`;
  return api(path, opts).then((data) => {
    usedSaved = false;
    paintNet();
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage full or blocked */ }
    return data;
  }, (err) => {
    if (err.status) throw err; // the server answered (wrong code, error): never hide that
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* ignore */ }
    if (!saved) throw err;
    usedSaved = true;
    paintNet();
    return saved;
  });
}
function clearSaved() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}

const app = $('#app');

const TABS = [
  ['home', 'Home', 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  ['board', 'Rank', 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3'],
  ['game', 'Vocals', 'M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4'],
  ['hymns', 'Hymns', 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z'],
  ['child', 'Me', 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
];

function shell() {
  app.innerHTML = `
    ${headerHtml("Children's Choir ZD", "Our Lady of Lourdes, Kalyan West")}
    <main>
      <div class="net" id="net" role="status"></div>
      <section id="home"><div id="homeCards"><div class="empty">Loading…</div></div><div id="homeCode"></div></section>
      <section id="board" hidden></section>
      <section id="ach" hidden></section>
      <section id="hymns" hidden></section>
      <section id="game" hidden></section>
      <section id="child" hidden></section>
    </main>
    ${footerHtml()}
    <nav class="tabbar" aria-label="Main">${TABS.map(([id, label, d]) => `<button data-tab="${id}"${id === 'game' ? ' id="gameTab" hidden' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${label}</button>`).join('')}</nav>`;
  app.querySelectorAll('nav.tabbar button').forEach((b) => b.addEventListener('click', () => { show(b.dataset.tab); scrollTo(0, 0); }));
}

function paintNet() {
  const on = navigator.onLine && !usedSaved;
  const el = $('#net');
  if (el) { el.textContent = on ? '● Online' : '● Offline'; el.classList.toggle('off', !on); }
}
window.addEventListener('online', () => {
  usedSaved = false;
  paintNet();
  // Back online: quietly fetch fresh data and redraw the home and leaderboard.
  cachedApi('public').then((o) => { overview = o; drawHome(); drawBoard(); }).catch(() => {});
  if (code) cachedApi('me', { code }).then((d) => { me = d; drawHome(); }).catch(() => {});
});
window.addEventListener('offline', paintNet);

// Home: next practice, practice days, the child's remarks. Keeps folds open/closed across redraws.
function drawHome() {
  const box = $('#homeCards');
  if (!box || !overview?.schedule) return;
  const open = (id) => box.querySelector(`#${id}`)?.open || false;
  const days = open('daysFold');
  const rem = open('remarksFold');
  box.innerHTML = nextCardHtml(overview.schedule)
    + (me ? trioHtml(me, overview.schedule) : '')
    + daysFoldHtml(overview.schedule, me ? me.history || [] : null, days)
    + (me ? remarksFoldHtml(me, rem) : '');
}

let gameCtl = null;
function openGame() {
  const box = $('#game');
  gameCtl?.destroy?.(); gameCtl = null;
  if (!code) { box.innerHTML = '<div class="card"><h2 style="margin-top:0">🎤 Vocals</h2><p class="muted">Enter your child\'s code in <b>My child</b> first. Scores belong to your child.</p><button class="btn primary" id="gameToChild">Go to My child</button></div>'; $('#gameToChild').addEventListener('click', () => show('child')); return; }
  box.innerHTML = '<div class="empty">Loading…</div>';
  // loaded only now, so a problem in the game can never stop the rest of the app
  import('./game.js').then((m) => { gameCtl = m.mountGame(box, { code }); }).catch(() => { box.innerHTML = '<div class="alert bad">The game could not load. Please try again.</div>'; });
}

function show(t) {
  if (tab === 'game' && t !== 'game') { gameCtl?.destroy?.(); gameCtl = null; $('#game').innerHTML = ''; }
  tab = t;
  app.querySelectorAll('nav.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  const showing = t === 'board' ? ['board', 'ach'] : [t];
  ['home', 'board', 'ach', 'hymns', 'game', 'child'].forEach((id) => { $(`#${id}`).hidden = !showing.includes(id); });
  if (t === 'game') openGame();
}

// ---------- leaderboard ----------

function drawBoard() {
  const o = overview;
  const rows = range === 'month' ? o.monthBoard : o.yearBoard;
  renderBoard($('#lb'), rows, { meId: me?.id });
  const note = $('#lbNote');
  if (note) note.textContent = range === 'month' ? `Points scored in ${o.monthLabel} only` : 'Points for the whole choir year';
}

function boardTab() {
  const o = overview;
  $('#board').innerHTML = `
    <div class="stage">
      <h2>🎤 Leaderboard</h2>
      <div class="sub">Choir year ${esc(o.seasonLabel)}<br>Come to every practice, and on time, to climb!</div>
      <div class="toggle">
        <button class="pill ${range === 'month' ? 'on' : ''}" data-range="month">${esc(o.monthLabel)}</button>
        <button class="pill ${range === 'year' ? 'on' : ''}" data-range="year">This year</button>
      </div>
      <div class="muted" id="lbNote" style="text-align:center;color:#fff;opacity:.85"></div>
      <div id="lb"></div>
    </div>
    <div class="card">
      <h3>How to earn points</h3>
      <div class="muted">Saturday practice = <b>${fmtPts(o.settings.satPoints)}</b> point · Sunday mass = <b>${fmtPts(o.settings.sunPoints)}</b> points ·
      Feast practices = <b>${fmtPts(o.settings.practicePoints)}</b> point each · Feast mass = <b>${fmtPts(o.settings.feastPoints)}</b> points.
      A day with any remark to improve (late, not paying attention, incomplete book, talking) takes off <b>${fmtPts(o.settings.remarkPenalty ?? 0.5)}</b> in total, however many. Each good remark (well behaved, helped others) adds <b>${fmtPts(o.settings.remarkBonus ?? 0.25)}</b>.</div>
    </div>`;
  drawHome();
  drawBoard();
  $('#homeCode').innerHTML = code ? '' : `<div class="card row between"><span><b>Parent?</b> See your child's attendance and contact details.</span><button class="btn primary small" id="goChild">Enter your child's code</button></div>`;
  $('#goChild')?.addEventListener('click', () => show('child'));
  $('#board').querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    range = b.dataset.range;
    $('#board').querySelectorAll('[data-range]').forEach((x) => x.classList.toggle('on', x === b));
    drawBoard();
  }));
}

// ---------- achievers ----------

function achTab() {
  const o = overview;
  const picker = o.seasons.length > 1
    ? `<label class="field">Choir year
        <select id="seasonPick">${o.seasons.map((s) => `<option value="${s}"${s === o.season ? ' selected' : ''}>April ${s} – March ${s + 1}</option>`).join('')}</select></label>`
    : '';
  $('#ach').innerHTML = `
    <h2>⭐ Monthly achievers</h2>
    <div class="muted">The child (or children) with the highest score each month.</div>
    ${picker}
    ${achieversHtml(o.monthly, { kind: 'month', empty: 'Monthly achievers will appear here after the first practices.' })}
    <h2>🏆 Yearly achievers</h2>
    <div class="muted">Highest score over the whole choir year (April to March).</div>
    ${achieversHtml(o.yearly, { kind: 'year', empty: 'Yearly achievers will appear here once the year gets going.' })}`;
  $('#seasonPick')?.addEventListener('change', async (e) => {
    season = Number(e.target.value);
    overview = await cachedApi(`public?season=${season}`);
    achTab();
  });
}

// ---------- hymn library (open to everyone) ----------

let hymnData = null;
const openCats = new Set();
const hymnSort = () => { try { return localStorage.getItem('choir-hymn-sort') === 'az' ? 'az' : 'cat'; } catch { return 'cat'; } };

function drawHymns() {
  const term = ($('#hsearch')?.value || '').trim().toLowerCase();
  const { categories, hymns } = hymnData;
  const safeLink = (u) => /^https?:\/\//i.test(u) ? u : '';
  const az = hymnSort() === 'az';
  const catLabel = (h) => categories.find((c) => c.id === h.category)?.label || '';
  const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
  const groups = az ? [{ id: '_az', label: 'All hymns (A–Z)' }] : categories;
  const html = groups.map((c) => {
    const items = hymns.filter((h) => (az || h.category === c.id) && (!term || h.title.toLowerCase().includes(term))).sort(byTitle);
    if (term && !items.length) return '';
    const open = az || term || openCats.has(c.id);
    return `
      <details class="hcat" data-cat="${esc(c.id)}"${open ? ' open' : ''}>
        <summary><span>${esc(c.label)}</span><span class="badge info">${items.length}</span></summary>
        ${items.length ? items.map((h) => `
          <div class="hymn">
            <button class="link ht" data-hv="${esc(h.id)}">${esc(h.title)}</button>${az ? ` <span class="badge info">${esc(catLabel(h))}</span>` : ''}
            ${h.notes ? `<div class="muted">${esc(h.notes)}</div>` : ''}
            ${h.audio ? `<audio controls preload="none" src="${esc(h.audio)}"></audio>` : ''}
            <div class="acts"><button class="btn small primary" data-hv="${esc(h.id)}">⛶ Open${h.lyrics ? ' lyrics' : ''} full screen</button>
              ${safeLink(h.link) ? `<a class="btn small" href="${esc(safeLink(h.link))}" target="_blank" rel="noopener noreferrer">🔗 Music link</a>` : ''}</div>
          </div>`).join('') : '<div class="hymn muted">No hymns here yet.</div>'}
      </details>`;
  }).join('');
  $('#hlist').innerHTML = html || '<div class="empty">No hymns match your search.</div>';
  $('#hlist').querySelectorAll('[data-hv]').forEach((b) => b.addEventListener('click', () => {
    const h = hymnData.hymns.find((x) => x.id === b.dataset.hv);
    openHymnViewer(h, hymnData.categories.find((c) => c.id === h.category)?.label);
  }));
  $('#hlist').querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => {
    if (term) return;
    if (d.open) openCats.add(d.dataset.cat); else openCats.delete(d.dataset.cat);
  }));
}

async function hymnsTab() {
  $('#hymns').innerHTML = `
    <h2>🎵 Hymn library</h2>
    <div class="muted">Hymns we have learned that are not in the book. Open a group to listen or find the music.</div>
    <div class="row" role="group" aria-label="Order of hymns"><button class="btn small" data-sort="cat">By category</button><button class="btn small" data-sort="az">A–Z</button></div>
    <label class="field"><span class="sr">Search hymns</span><input id="hsearch" type="search" placeholder="Search for a hymn…" autocomplete="off"></label>
    <div id="hlist"><div class="empty">Loading…</div></div>`;
  $('#hsearch').addEventListener('input', () => hymnData && drawHymns());
  const paintSort = () => $('#hymns').querySelectorAll('[data-sort]').forEach((b) => b.classList.toggle('primary', b.dataset.sort === hymnSort()));
  paintSort();
  $('#hymns').querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    try { localStorage.setItem('choir-hymn-sort', b.dataset.sort); } catch { /* ignore */ }
    paintSort();
    if (hymnData) drawHymns();
  }));
  try {
    hymnData = await cachedApi('hymns');
    if (!hymnData.hymns.length) $('#hlist').innerHTML = '<div class="empty">Hymns will appear here once your teacher adds them.</div>';
    else drawHymns();
  } catch (e) { $('#hlist').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
}

// ---------- my child (private, needs the code) ----------

function codeForm(error = '') {
  $('#child').innerHTML = `
    ${lookCardHtml()}
    <div class="card">
      <h2 style="margin-top:0">👋 Find your child</h2>
      <p class="muted">Type the short code your choir teacher gave you for your child (like a roll number, e.g. 1001). It opens only your own child's page, so everyone's details stay private.</p>
      ${error ? `<div class="alert bad">${esc(error)}</div>` : ''}
      <form id="codeForm" class="row">
        <input name="code" class="grow" placeholder="e.g. 1001 or CC01" autocomplete="off" autocapitalize="characters" required maxlength="20" aria-label="Child code">
        <button class="btn primary">Open</button>
      </form>
    </div>`;
  wireLook($('#child'));
  $('#codeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    code = new FormData(e.target).get('code').toUpperCase().replace(/[^A-Z0-9]/g, '');
    store.set('choir-code', '');
    loadMe();
  });
}

async function loadMe() {
  if (!code) return codeForm();
  try {
    me = await cachedApi('me', { code });
    store.set('choir-code', code);
    $('#homeCode').innerHTML = '';
    childView();
    drawHome();
    drawBoard();
  } catch (e) {
    me = null;
    if (e.status === 401) store.set('choir-code', '');
    code = '';
    codeForm(e.message);
  }
}

function childView(msg = '') {
  const d = me;
  $('#child').innerHTML = `
    <div class="card">
      <div class="profile-head">
        ${avatarHtml(d, 'xl')}
        <div class="grow">
          <h2 style="margin:0">${esc(d.name)}</h2>
          <div class="muted">${d.standard ? `Standard ${esc(d.standard)}` : ''}${d.standard && d.joinedYear ? ' · ' : ''}${d.joinedYear ? `Joined ${d.joinedYear}` : ''}</div>
          <div class="row" style="margin-top:8px;gap:6px">
            <label class="btn small" for="cam">📷 Take photo</label><label class="btn small" for="gal">🖼 Choose photo</label>
            <input id="cam" type="file" accept="image/*" capture="user" hidden><input id="gal" type="file" accept="image/*" hidden>
          </div>
          <div class="muted" id="picMsg" aria-live="polite">A clear photo, please. You choose the profile picture, then the face for the leaderboard.</div>
          <button class="btn small" id="forget" style="margin-top:8px">Not your child? Switch</button>
        </div>
      </div>
    </div>
    ${lookCardHtml()}
    ${leaveAlertHtml(d)}
    ${statsHtml(d)}
    <form class="card" id="editForm">
      <h3>Contact details</h3>
      <p class="muted" style="margin-top:0">Please keep these up to date. Only you and the choir teacher can see them.</p>
      <label class="field">Contact number<input name="contact" type="tel" inputmode="tel" maxlength="20" value="${esc(d.contact)}"></label>
      <label class="field">Address<textarea name="address" rows="3" maxlength="300">${esc(d.address)}</textarea></label>
      <h3 style="margin-top:16px">Parent to call if there's a problem</h3>
      <label class="field">Parent name<input name="emergencyName" maxlength="80" value="${esc(d.emergencyName)}"></label>
      <label class="field">Parent number<input name="emergencyPhone" type="tel" inputmode="tel" maxlength="20" value="${esc(d.emergencyPhone)}"></label>
      <div class="row"><button class="btn primary">Save changes</button><span id="saved" class="muted" aria-live="polite">${esc(msg)}</span></div>
    </form>
    <h2>Attendance</h2>
    <div class="card">${historyHtml(d.history)}</div>`;
  wireLook($('#child'));
  const setPhoto = async (file) => {
    if (!file) return;
    $('#picMsg').textContent = '';
    try {
      const picked = await pickPhotos(file); // square profile photo, then the face for the leaderboard
      if (!picked) return;
      $('#picMsg').textContent = 'Saving…';
      const r = await api('me/photo', { method: 'POST', code, body: picked });
      me.photo = r.photo; me.head = r.head;
      document.querySelector('#child .profile-head').firstElementChild.outerHTML = avatarHtml(me, 'xl');
      $('#picMsg').textContent = '✅ Photos saved.';
      overview = await api('public'); drawBoard(); drawHome();
    } catch (err) { $('#picMsg').textContent = `⚠️ ${err.message}`; }
  };
  $('#cam').addEventListener('change', (e) => { setPhoto(e.target.files[0]); e.target.value = ''; });
  $('#gal').addEventListener('change', (e) => { setPhoto(e.target.files[0]); e.target.value = ''; });
  $('#forget').addEventListener('click', () => { store.set('choir-code', ''); clearSaved(); code = ''; me = null; codeForm(); drawHome(); drawBoard(); });
  $('#editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      await api('me', { method: 'PUT', code, body: f });
      Object.assign(me, f);
      $('#saved').textContent = '✅ Saved!';
    } catch (err) {
      $('#saved').textContent = `⚠️ ${err.message}`;
    }
  });
}

// ---------- start ----------

applyLook();
shell();
paintNet();
show(tab);
cachedApi('public')
  .then((o) => {
    overview = o;
    $('#gameTab').hidden = !o.settings?.gameEnabled;
    boardTab();
    achTab();
    hymnsTab();
    return loadMe();
  })
  .catch((e) => { $('#board').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; });
if (!code) codeForm();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
