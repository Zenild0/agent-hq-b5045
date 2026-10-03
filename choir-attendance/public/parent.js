import {
  $, api, esc, fmtPts, headerHtml, footerHtml, renderBoard, achieversHtml, avatarHtml,
  statsHtml, historyHtml, leaveAlertHtml,
} from './common.js';

const store = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } },
};

let overview;
let tab = 'board';
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

const app = $('#app');

function shell() {
  app.innerHTML = `
    ${headerHtml("Children's Choir", `<span id="season"></span>`)}
    <main>
      <nav class="tabs" role="tablist">
        <button data-tab="board">🏆 Leaderboard</button>
        <button data-tab="ach">⭐ Achievers</button>
        <button data-tab="hymns">🎵 Hymns</button>
        <button data-tab="child">👧 My child</button>
      </nav>
      <section id="board"></section>
      <section id="ach" hidden></section>
      <section id="hymns" hidden></section>
      <section id="child" hidden></section>
    </main>
    ${footerHtml()}`;
  app.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
}

function show(t) {
  tab = t;
  app.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  ['board', 'ach', 'hymns', 'child'].forEach((id) => { $(`#${id}`).hidden = id !== t; });
}

// ---------- leaderboard ----------

function drawBoard() {
  const o = overview;
  const rows = range === 'month' ? o.monthBoard : o.yearBoard;
  renderBoard($('#lb'), rows, { meId: me?.id });
}

function boardTab() {
  const o = overview;
  $('#season').textContent = `Year ${o.seasonLabel}`;
  $('#board').innerHTML = `
    ${code ? '' : `<div class="card row between"><span><b>Parent?</b> See your child's attendance and contact details.</span><button class="btn primary small" id="goChild">Enter your child's code</button></div>`}
    <div class="stage">
      <h2>🎤 Leaderboard</h2>
      <div class="sub">Come to every practice, and on time, to climb!</div>
      <div class="toggle">
        <button class="pill ${range === 'month' ? 'on' : ''}" data-range="month">${esc(o.monthLabel)}</button>
        <button class="pill ${range === 'year' ? 'on' : ''}" data-range="year">This year</button>
      </div>
      <div id="lb"></div>
    </div>
    <div class="card">
      <h3>How to earn points</h3>
      <div class="muted">Saturday practice = <b>${fmtPts(o.settings.satPoints)}</b> point · Sunday mass = <b>${fmtPts(o.settings.sunPoints)}</b> points ·
      Feast practices = <b>${fmtPts(o.settings.practicePoints)}</b> point each · Feast mass = <b>${fmtPts(o.settings.feastPoints)}</b> points.
      Arriving late earns fewer points!</div>
    </div>`;
  drawBoard();
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
    overview = await api(`public?season=${season}`);
    achTab();
  });
}

// ---------- hymn library (open to everyone) ----------

let hymnData = null;
const openCats = new Set();

function drawHymns() {
  const term = ($('#hsearch')?.value || '').trim().toLowerCase();
  const { categories, hymns } = hymnData;
  const safeLink = (u) => /^https?:\/\//i.test(u) ? u : '';
  const html = categories.map((c) => {
    const items = hymns.filter((h) => h.category === c.id && (!term || h.title.toLowerCase().includes(term)));
    if (term && !items.length) return '';
    const open = term || openCats.has(c.id);
    return `
      <details class="hcat" data-cat="${esc(c.id)}"${open ? ' open' : ''}>
        <summary><span>${esc(c.label)}</span><span class="badge info">${items.length}</span></summary>
        ${items.length ? items.map((h) => `
          <div class="hymn">
            <div class="ht">${esc(h.title)}</div>
            ${h.notes ? `<div class="muted">${esc(h.notes)}</div>` : ''}
            ${h.audio ? `<audio controls preload="none" src="${esc(h.audio)}"></audio>` : ''}
            ${safeLink(h.link) ? `<div class="acts"><a class="btn small" href="${esc(safeLink(h.link))}" target="_blank" rel="noopener noreferrer">🔗 Open music link</a></div>` : ''}
          </div>`).join('') : '<div class="hymn muted">No hymns here yet.</div>'}
      </details>`;
  }).join('');
  $('#hlist').innerHTML = html || '<div class="empty">No hymns match your search.</div>';
  $('#hlist').querySelectorAll('details').forEach((d) => d.addEventListener('toggle', () => {
    if (term) return;
    if (d.open) openCats.add(d.dataset.cat); else openCats.delete(d.dataset.cat);
  }));
}

async function hymnsTab() {
  $('#hymns').innerHTML = `
    <h2>🎵 Hymn library</h2>
    <div class="muted">Hymns we have learned that are not in the book. Open a group to listen or find the music.</div>
    <label class="field"><span class="sr">Search hymns</span><input id="hsearch" type="search" placeholder="Search for a hymn…" autocomplete="off"></label>
    <div id="hlist"><div class="empty">Loading…</div></div>`;
  $('#hsearch').addEventListener('input', () => hymnData && drawHymns());
  try {
    hymnData = await api('hymns');
    if (!hymnData.hymns.length) $('#hlist').innerHTML = '<div class="empty">Hymns will appear here once your teacher adds them.</div>';
    else drawHymns();
  } catch (e) { $('#hlist').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
}

// ---------- my child (private, needs the code) ----------

function codeForm(error = '') {
  $('#child').innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">👋 Find your child</h2>
      <p class="muted">Type the short code your choir teacher gave you for your child (like a roll number, e.g. 1001). It opens only your own child's page, so everyone's details stay private.</p>
      ${error ? `<div class="alert bad">${esc(error)}</div>` : ''}
      <form id="codeForm" class="row">
        <input name="code" class="grow" placeholder="e.g. 1001 or CC01" autocomplete="off" autocapitalize="characters" required maxlength="20" aria-label="Child code">
        <button class="btn primary">Open</button>
      </form>
    </div>`;
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
    me = await api('me', { code });
    store.set('choir-code', code);
    $('#goChild')?.closest('.card')?.remove();
    childView();
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
          <button class="btn small" id="forget" style="margin-top:8px">Not your child? Switch</button>
        </div>
      </div>
    </div>
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
  $('#forget').addEventListener('click', () => { store.set('choir-code', ''); code = ''; me = null; codeForm(); drawBoard(); });
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

shell();
show(tab);
api('public')
  .then((o) => {
    overview = o;
    boardTab();
    achTab();
    hymnsTab();
    return loadMe();
  })
  .catch((e) => { $('#board').innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; });
if (!code) codeForm();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
