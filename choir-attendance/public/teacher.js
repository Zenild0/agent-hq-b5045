import { pickPhotos, pickProfilePhoto } from './photo.js';
import { nextCardHtml } from './home.js';
import { initBack, noteVisit } from './nav.js';
import { applyLook, lookCardHtml, wireLook, configure } from './theme.js';

configure({ key: 'choir-theme-teacher', lens: false }); // the teacher area keeps its own colour choice
applyLook();
import { waLink,
  $, api, esc, fmtPts, fmtDate, typeLabel, headerHtml, footerHtml, avatarHtml, leaveBadge,
  renderBoard, statsHtml, historyHtml, leaveAlertHtml, remarksLogHtml, openHymnViewer,
} from './common.js';

let pin = '';
try { pin = localStorage.getItem('choir-pin') || ''; } catch { /* private mode */ }
const call = (path, opts = {}) => api(path, { ...opts, pin });

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const todayStr = () => iso(new Date());
function lastWeekday(dow) { // most recent Saturday (6) / Sunday (0), today included
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - dow + 7) % 7));
  return iso(d);
}

const app = $('#app');
app.innerHTML = `
  ${headerHtml("Children's Choir ZD", 'Teacher area · <a href="/">Parent view</a>')}
  <main>
    <div id="backbar" hidden><button class="btn small" id="backMore">‹ More</button></div>
    <div id="msg" aria-live="polite"></div>
    <section id="home"></section>
    <section id="more" hidden></section>
    <section id="attendance" hidden></section>
    <section id="schedule" hidden></section>
    <section id="occasions" hidden></section>
    <section id="children" hidden></section>
    <section id="hymns" hidden></section>
    <section id="vocals" hidden></section>
    <section id="staffgame" hidden></section>
    <section id="board" hidden></section>
    <section id="settings" hidden></section>
  </main>
  ${footerHtml()}
  <nav class="tabbar" aria-label="Main">${[
    ['home', 'Home', 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
    ['attendance', 'Attendance', 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9'],
    ['children', 'Children', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'],
    ['hymns', 'Hymns', 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z'],
    ['more', 'More', 'M5 12h.01M12 12h.01M19 12h.01'],
  ].map(([id, label, d]) => `<button data-tab="${id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${label}</button>`).join('')}</nav>`;

const flash = (text, kind = 'bad') => {
  $('#msg').innerHTML = text ? `<div class="alert ${kind}">${esc(text)}</div>` : '';
};
async function run(fn) {
  try { flash(''); return await fn(); } catch (e) {
    if (e.status === 401) return askPin(pin ? 'That PIN was not right.' : '');
    if (e.status === 403) return lockOut(e.message);
    flash(e.message);
  }
}
function askPin(message = '') {
  const p = prompt(`${message ? `${message}\n` : ''}Teacher PIN`);
  if (p === null) return flash('PIN required to use the teacher page from this device.');
  pin = p;
  try { localStorage.setItem('choir-pin', p); } catch { /* private mode */ }
  location.reload();
}

function lockOut(message) {
  $('#msg').innerHTML = '';
  app.querySelector('main').innerHTML = `<div class="card"><h2 style="margin-top:0">🔒 Teacher area</h2><p>${esc(message)}</p><p class="muted">Open <b>http://localhost:3000/teacher</b> on the computer running the app. Parents use the main link and their child's code.</p><a class="btn" href="/">Go to the parent page</a></div>`;
}

const tabs = ['home', 'more', 'staffgame', 'attendance', 'schedule', 'occasions', 'children', 'hymns', 'vocals', 'board', 'settings'];
const loaders = { staffgame: loadStaffGame, home: loadHome, more: loadMore, attendance: loadAttendance, schedule: loadSchedule, occasions: loadOccasions, children: loadChildren, hymns: loadHymns, vocals: loadVocals, board: loadBoard, settings: loadSettings };
// The teacher's own copy of Vocals: every level and the paid features are open, and progress stays on this device.
let vocals = null;
function subsPanelHtml(subs) {
  const when = (r) => (r.state === 'none' ? 'Not subscribed' : r.state === 'expired' ? `Expired ${esc(fmtDate(r.until))}` : `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} left · until ${esc(fmtDate(r.until))}`);
  const badge = (r) => (r.state === 'none' ? '' : `<span class="badge ${r.state === 'expired' ? 'bad' : r.state === 'soon' ? 'warn' : 'ok'}">${r.state === 'expired' ? 'Expired' : r.state === 'soon' ? 'Renew soon' : 'Active'}</span>`);
  const row = (r) => `<button class="attn" data-open="${esc(r.id)}"><i class="dot ${r.state === 'expired' ? 'r' : r.state === 'soon' ? 'y' : r.state === 'active' ? 'g' : 'n'}"></i><span class="grow"><b>${esc(r.name)}</b><span class="muted">${when(r)}</span></span>${badge(r)}</button>`;
  const act = subs.rows.filter((r) => r.state === 'active' || r.state === 'soon');
  const rest = subs.rows.filter((r) => r.state === 'expired' || r.state === 'none');
  return `
    <div class="card" id="subsPanel">
      <h3 style="margin:0">Subscriptions</h3>
      <div class="muted" style="margin-bottom:8px">${subs.active} active · ${subs.soon} renew within 30 days · ${subs.expired} expired · ${subs.none} not subscribed. Tap a child to renew or unlock.</div>
      ${act.length ? `<div class="muted subs-h">Active, fewest days left first</div><div class="attn-list">${act.map(row).join('')}</div>` : '<div class="muted">Nobody has an active subscription yet.</div>'}
      ${rest.length ? `<div class="muted subs-h">Not subscribed</div><div class="attn-list">${rest.map(row).join('')}</div>` : ''}
    </div>`;
}

let staffTest = null;
function loadStaffGame() {
  staffTest?.destroy?.(); staffTest = null;
  const box = $('#staffgame');
  box.innerHTML = '<div class="empty">Loading…</div>';
  return import('./staffgame.js').then((m) => { staffTest = m.mountStaffGame(box); }).catch(() => { box.innerHTML = '<div class="alert bad">The game could not load. Please try again.</div>'; });
}

function loadVocals() {
  vocals?.destroy?.(); vocals = null;
  const box = $('#vocals');
  box.innerHTML = '<div id="subsBox"></div><div id="vocalsGame"><div class="empty">Loading…</div></div>';
  call('teacher/vocals-subs').then((s) => { $('#subsBox').innerHTML = subsPanelHtml(s); }).catch(() => {});
  const game = $('#vocalsGame');
  return import('./game.js').then((m) => { vocals = m.mountGame(game, { preview: true, teacher: true }); }).catch(() => { game.innerHTML = '<div class="alert bad">Vocals could not load. Please try again.</div>'; });
}

let currentTab = 'home';
function showTab(name, fromBack = false) {
  if (!fromBack) noteVisit(name);
  currentTab = name;
  if (name !== 'staffgame' && staffTest) { staffTest.destroy?.(); staffTest = null; $('#staffgame').innerHTML = ''; }
  if (name !== 'vocals' && vocals) { vocals.destroy?.(); vocals = null; $('#vocals').innerHTML = ''; } // stops the microphone
  tabs.forEach((t) => { $(`#${t}`).hidden = t !== name; });
  const underMore = MORE_PAGES.some((p) => p.id === name);
  app.querySelectorAll('nav.tabbar button').forEach((x) => x.classList.toggle('on', x.dataset.tab === (underMore ? 'more' : name)));
  $('#backbar').hidden = !underMore;
  scrollTo(0, 0);
  return run(loaders[name]);
}
app.querySelectorAll('nav.tabbar button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#backMore').addEventListener('click', () => showTab('more'));


// ======================= Home and More =======================

const MORE_PAGES = [
  { id: 'schedule', icon: '📅', label: 'Schedule', sub: 'Practice days' },
  { id: 'occasions', icon: '🎄', label: 'Occasions', sub: 'Feasts and events' },
  { id: 'vocals', icon: '🎤', label: 'Vocals', sub: 'Test and unlocks' },
  { id: 'staffgame', icon: '🎼', label: 'Staff game', sub: 'Try it yourself' },
  { id: 'board', icon: '🏆', label: 'Leaderboard', sub: 'Month and year' },
  { id: 'settings', icon: '⚙️', label: 'Settings', sub: 'Points, payment, look' },
];

function loadMore() {
  $('#more').innerHTML = `
    <h2>More</h2>
    <div class="more-grid">
      ${MORE_PAGES.map((p) => `<button class="more-tile" data-go="${p.id}"><span class="mi">${p.icon}</span><b>${p.label}</b><span class="muted">${p.sub}</span></button>`).join('')}
      <button class="more-tile" data-go="settings" data-backup="1"><span class="mi">💾</span><b>Backup</b><span class="muted">Download or restore</span></button>
    </div>
    <div class="muted">Everything else lives here, one tap away. The main tabs stay in the bar.</div>`;
  $('#more').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', async () => {
    await showTab(b.dataset.go);
    if (b.dataset.backup) $('#backupBox')?.scrollIntoView({ block: 'start' });
  }));
}

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

async function loadHome() {
  const d = await call('teacher/home');
  const sc = d.next ? { today: d.today, next: d.next } : { today: d.today, next: null };
  const p = d.profile;
  const att = [];
  if (d.lastSession?.unmarked.length) {
    const u = d.lastSession.unmarked;
    att.push(`<button class="attn" id="unmarkedRow"><i class="dot r"></i><span class="grow"><b>${u.length} ${u.length === 1 ? 'child' : 'children'} not marked on ${esc(fmtDate(d.lastSession.date))}</b><span class="muted">${esc(u.slice(0, 3).join(', '))}${u.length > 3 ? '…' : ''} · tap to finish the register</span></span><span class="muted">›</span></button>`);
  }
  for (const a of d.attention) {
    att.push(`<button class="attn" data-open="${esc(a.id)}"><i class="dot ${a.kind === 'over' ? 'r' : 'y'}"></i><span class="grow"><b>${esc(a.name)} ${a.kind === 'over' ? `is over the leave limit (${a.leaves} of ${a.max})` : `is on ${a.leaves} of ${a.max} leaves`}</b><span class="muted">${a.kind === 'over' ? 'Your decision is needed' : 'One more and you decide'}</span></span><span class="muted">›</span></button>`);
  }
  const ls = d.lastSession;
  const backupAge = d.lastBackup ? daysBetween(d.lastBackup, d.today) : null;
  $('#home').innerHTML = `
    <div class="thead">
      ${avatarHtml({ name: p.name || 'Teacher', photo: p.photo }, 'xl')}
      <div class="grow">
        <div class="muted">${greeting()}</div>
        <h2 style="margin:0">Hello, ${esc(p.name || 'Teacher')}</h2>
        <div class="muted">${p.instruments ? `🎹 ${esc(p.instruments)}` : 'Add your instruments'}</div>
      </div>
      <button class="btn small" id="editProfile">✎ Edit</button>
    </div>
    ${nextCardHtml(sc)}
    <div class="row" style="margin:-4px 0 14px"><button class="btn primary" id="goAtt" style="flex:1">✅ Take attendance</button></div>
    <section class="trio" aria-label="Snapshot">
      <button class="tile t1" data-go="children"><small>Children</small><b>${d.children}</b><small>in the choir ›</small></button>
      <button class="tile t2" id="lastTile"><small>Last practice</small><b>${ls ? `${ls.present}/${ls.total}` : '–'}</b><small>${ls ? `${esc(fmtDate(ls.date).replace(/ \d{4}$/, ''))} ›` : 'none yet'}</small></button>
      <button class="tile t3" id="watchTile"><small>Watch list</small><b>${d.attention.length}</b><small>on leaves ›</small></button>
    </section>
    ${d.gameEnabled || d.subs.active + d.subs.expired ? `
    <button class="card subs-card" id="subsCard">
      <span class="si" aria-hidden="true">🎤</span>
      <span class="grow"><b>Vocals subscriptions</b>
        <span class="muted">${d.subs.active} active${d.subs.soon ? ` · ${d.subs.soon} renew soon` : ''}${d.subs.expired ? ` · ${d.subs.expired} expired` : ''}</span></span>
      <span class="subs-n">${d.subs.active}</span><span class="muted">›</span>
    </button>` : ''}
    <h3 style="margin:6px 0" id="attnHead">Needs your attention</h3>
    ${att.length ? `<div class="attn-list">${att.join('')}</div>` : '<div class="card muted" style="margin:0 0 12px">All clear ✓ Nothing needs you right now.</div>'}
    <div class="card" id="topCard">
      <b>Top this month</b>
      ${d.top.length ? [1, 2, 3].map((r) => {
        const g = d.top.filter((t) => t.rank === r);
        return g.length ? `<div class="toprank r${r}"><div class="trh"><span class="medal" aria-hidden="true">${['🥇', '🥈', '🥉'][r - 1]}</span><b>${['1st', '2nd', '3rd'][r - 1]}</b><span class="muted">${fmtPts(g[0].points)} pts</span></div>
          <div class="chips">${g.map((t) => `<button class="chip" data-open="${esc(t.id)}">${avatarHtml({ name: t.name, photo: t.head || t.photo }, 'sm')}<span>${esc(t.name.split(' ')[0])}</span></button>`).join('')}</div></div>` : '';
      }).join('') : '<div class="muted">Points appear after the first practice</div>'}
    </div>
    <div class="card row between">
      <span style="font-size:1.5rem" aria-hidden="true">💾</span>
      <div class="grow"><b>${d.lastBackup ? `Last backup ${backupAge === 0 ? 'today' : backupAge === 1 ? 'yesterday' : `${backupAge} days ago`}` : 'No backup yet'}</b><div class="muted">Download one to keep safe</div></div>
      <button class="btn small ${backupAge === null || backupAge > 14 ? 'primary' : ''}" id="goBackup">Backup</button>
    </div>`;
  $('#goAtt').addEventListener('click', () => showTab('attendance'));
  $('#lastTile').addEventListener('click', openRecent);
  $('#watchTile').addEventListener('click', () => $('#attnHead').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('#unmarkedRow')?.addEventListener('click', () => { date = ls.date; type = ls.type; event = ls.event || ''; showTab('attendance'); });
  $('#subsCard')?.addEventListener('click', () => showTab('vocals'));
  $('#home').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.go)));
  $('#goBackup').addEventListener('click', async () => { await showTab('settings'); $('#backupBox')?.scrollIntoView({ block: 'start' }); });
  $('#editProfile').addEventListener('click', () => openProfile(p));
}

// The last practices, newest first. Tap a date to see who was there.
async function openRecent() {
  $('#dlgBody').innerHTML = '<div class="dlg-top"><h2 style="margin:0" class="grow">Recent practices</h2><button class="btn small" id="close" type="button" aria-label="Close">✕</button></div><div class="empty">Loading…</div>';
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  try {
    const { sessions } = await call('teacher/sessions');
    const group = (title, cls, names) => (names.length ? `<div class="rg"><div class="muted">${title} (${names.length})</div><div class="chips">${names.map((n) => `<span class="chip ${cls}">${esc(n)}</span>`).join('')}</div></div>` : '');
    const marked = (x) => x.present.length + x.absent.length + x.excused.length;
    $('#dlgBody').innerHTML = `
      <div class="dlg-top"><h2 style="margin:0" class="grow">Recent practices</h2><button class="btn small" id="close" type="button" aria-label="Close">✕</button></div>
      <div class="muted" style="margin:6px 0 10px">Tap a date to see who was there.</div>
      ${sessions.map((x, i) => `
        <details class="rs"${i === 0 ? ' open' : ''}>
          <summary><span class="grow"><b>${esc(fmtDate(x.date))}</b><span class="muted">${esc(typeLabel(x.type, x.event))}</span></span>
            <span class="badge ok">${x.present.length} present</span>${x.absent.length + x.excused.length ? `<span class="badge bad">${x.absent.length + x.excused.length} away</span>` : ''}</summary>
          ${group('Present', 'p', x.present)}${group('Absent', 'a', x.absent)}${group('Medical leave', 'm', x.excused)}${group('Not marked', 'n', x.unmarked)}
          <div class="row" style="margin-top:8px"><button class="btn small" data-edit-day="${i}">Open this day in Attendance</button></div>
        </details>`).join('') || '<div class="empty">No practices recorded yet. Take attendance to see them here.</div>'}`;
    $('#close').addEventListener('click', () => dlg.close());
    $('#dlgBody').querySelectorAll('[data-edit-day]').forEach((b) => b.addEventListener('click', () => {
      const x = sessions[Number(b.dataset.editDay)];
      date = x.date; type = x.type; event = x.event || '';
      dlg.close();
      showTab('attendance');
    }));
  } catch (err) { $('#dlgBody').innerHTML = `<div class="alert bad">${esc(err.message)}</div>`; }
}

function openProfile(p) {
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">My profile</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <div class="row" style="margin:12px 0">
      <span id="pav">${avatarHtml({ name: p.name || 'Teacher', photo: p.photo }, 'xl')}</span>
      <div class="row" style="gap:6px"><label class="btn small" for="pcam">📷 Take photo</label><label class="btn small" for="pgal">🖼 Choose photo</label>
        <input id="pcam" type="file" accept="image/*" capture="user" hidden><input id="pgal" type="file" accept="image/*" hidden></div>
    </div>
    <div class="muted" id="pmsg" aria-live="polite"></div>
    <form id="pf">
      <label class="field">Your name<input name="name" maxlength="60" value="${esc(p.name)}" placeholder="e.g. Zenildo Dias"></label>
      <label class="field">Instruments you play<input name="instruments" maxlength="120" value="${esc(p.instruments)}" placeholder="e.g. Keyboard, guitar, vocals"></label>
      <div class="row"><button class="btn primary">Save</button><span id="psaved" class="muted" aria-live="polite"></span></div>
    </form>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  const setPhoto = async (file) => {
    if (!file) return;
    try {
      const image = await pickProfilePhoto(file);
      if (!image) return;
      $('#pmsg').textContent = 'Saving…';
      const r = await call('teacher/profile/photo', { method: 'POST', body: { image } });
      p.photo = r.photo;
      $('#pav').innerHTML = avatarHtml({ name: p.name || 'Teacher', photo: r.photo }, 'xl');
      $('#pmsg').textContent = '✅ Photo saved.';
      loadHome();
    } catch (err) { $('#pmsg').textContent = `⚠️ ${err.message}`; }
  };
  $('#pcam').addEventListener('change', (e) => { setPhoto(e.target.files[0]); e.target.value = ''; });
  $('#pgal').addEventListener('change', (e) => { setPhoto(e.target.files[0]); e.target.value = ''; });
  $('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await call('teacher/profile', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
      dlg.close();
      await loadHome();
    } catch (err) { $('#psaved').textContent = `⚠️ ${err.message}`; }
  });
}

// ======================= Attendance =======================

let date = todayStr();
let type = '';
let event = '';
let view;

const isOccasion = (t) => t === 'practice' || t === 'feast';

// Children over the leave limit still waiting for the teacher's decision.
const pendingHtml = (pending) => (pending?.length ? `
  <div class="alert warn"><b>⚠️ Over the leave limit — your decision needed:</b>
    ${pending.map((p) => `<button class="btn small" data-open="${esc(p.id)}">${esc(p.name)} (${p.leaves} leaves)</button>`).join(' ')}
    <div class="muted">Nobody is removed automatically. Open a child to keep them in the choir or mark them as not continuing.</div></div>` : '');

const overNote = (c) => (c.decision === 'out' ? '<div class="muted">Not continuing this year (your decision).</div>'
  : c.decision === 'keep' ? '<div class="muted">Over the leave limit — kept in the choir ✓</div>'
  : `<div class="muted">⚠️ Over the leave limit — <button class="link" data-open="${esc(c.id)}">decide</button></div>`);

async function loadAttendance() {
  const qs = () => new URLSearchParams({ date, ...(type ? { type } : {}), ...(isOccasion(type) ? { event } : {}) });
  view = await call(`teacher/session?${qs()}`);
  type = view.type;
  if (isOccasion(type)) {
    const hit = view.occasions.find((o) => o.toLowerCase() === event.toLowerCase());
    if (hit) event = hit;
    else if (view.occasions.length) { event = view.occasions[0]; view = await call(`teacher/session?${qs()}`); }
    else event = '';
  }
  renderAttendance();
}

function renderAttendance() {
  const s = view.settings;
  const waiting = isOccasion(type) && view.missingOccasion;
  const when = date < todayStr() ? `📅 Back-dated entry for ${fmtDate(date)}` : date > todayStr() ? `📅 Future date: ${fmtDate(date)}` : '';
  $('#attendance').innerHTML = `
    <div class="card">
      <div class="row">
        <input type="date" id="date" value="${date}" aria-label="Date">
        <button class="btn small" data-jump="today">Today</button>
        <button class="btn small" data-jump="6">Last Saturday</button>
        <button class="btn small" data-jump="0">Last Sunday</button>
      </div>
      <div class="row" style="margin-top:10px">
        <select id="type" aria-label="Session type">
          <option value="saturday">Saturday practice (${fmtPts(s.satPoints)} pt)</option>
          <option value="sunday">Sunday mass (${fmtPts(s.sunPoints)} pts)</option>
          <option value="practice">Special practice – feast (${fmtPts(s.practicePoints)} pt)</option>
          <option value="feast">Special mass – feast (${fmtPts(s.feastPoints)} pts)</option>
        </select>
        ${isOccasion(type) ? (view.occasions.length ? `
          <select id="event" aria-label="Occasion">
            ${view.occasions.map((e) => `<option${e === event ? ' selected' : ''}>${esc(e)}</option>`).join('')}
            <option value="__new">＋ New occasion…</option>
          </select>` : '<button class="btn small" id="newOcc">＋ Create an occasion</button>') : ''}
      </div>
    </div>
    ${pendingHtml(view.pending)}
    ${when ? `<div class="banner">${when}</div>` : ''}
    ${waiting ? `<div class="empty">No occasion yet for this year.<br>Create one (Christmas, Easter…) and choose who takes part.<br><br><button class="btn primary" id="newOcc2">＋ Create an occasion</button></div>` : `
    <div class="row between"><span class="muted" id="sumline">${summaryText()}</span>
      <button class="btn small" id="allPresent">Mark all present</button></div>
    <div class="muted legend"><b>P</b> Present · <b>A</b> Absent · <b>ML</b> Medical leave · <b>⋯</b> remarks &amp; notes</div>
    <div class="card att-list">${view.children.length ? view.children.map(childRow).join('') : '<div class="empty">Add children in the Children tab first.</div>'}</div>`}`;
  $('#type').value = type;
  $('#date').addEventListener('change', (e) => {
    if (!e.target.value) return;
    date = e.target.value;
    if (!isOccasion(type)) type = ''; // keep feast sessions when back-dating; otherwise pick Saturday/Sunday from the date
    run(loadAttendance);
  });
  $('#attendance').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
    const j = b.dataset.jump;
    date = j === 'today' ? todayStr() : lastWeekday(Number(j));
    type = '';
    run(loadAttendance);
  }));
  $('#type').addEventListener('change', (e) => { type = e.target.value; run(loadAttendance); });
  $('#event')?.addEventListener('change', (e) => {
    if (e.target.value === '__new') { e.target.value = event; run(() => openOccasion(null, view.season)); return; }
    event = e.target.value;
    run(loadAttendance);
  });
  ['newOcc', 'newOcc2'].forEach((id) => $(`#${id}`)?.addEventListener('click', () => run(() => openOccasion(null, view.season))));
  $('#allPresent')?.addEventListener('click', () => run(async () => {
    await call('teacher/mark-all-present', { method: 'POST', body: { date, type, event } });
    await loadAttendance();
  }));
  $('#attendance').querySelectorAll('[data-child]').forEach(wireRow);
}

const openRows = new Set(); // children whose remarks panel is expanded

function summaryText() {
  const n = (k) => view.children.filter((c) => c.status === k).length;
  const left = view.children.filter((c) => !c.status).length;
  return `P ${n('present')} · A ${n('absent')} · ML ${n('excused')} · ${left} not marked`;
}

function extraHtml(c) {
  return `
    <div class="att-extra">
      ${c.status === 'excused' ? `<label class="field">Medical reason
        <select class="reason"><option value="">Optional</option>${view.excuseReasons.map((r) => `<option${c.reason === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
        <div class="muted">Medical leave never counts as a leave.</div>` : ''}
      <div class="chk-grid">${view.remarkOptions.map((r) => `<label class="chk"><input type="checkbox" value="${esc(r)}"${c.remarks.includes(r) ? ' checked' : ''}> ${esc(r)}</label>`).join('')}</div>
      <textarea rows="2" maxlength="500" placeholder="Private note (parents can't see this)">${esc(c.note)}</textarea>
    </div>`;
}

function childRow(c) {
  const b = (k, label, title) => `<button class="pa ${k}${c.status === k ? ' on' : ''}" data-set="${k}" aria-pressed="${c.status === k}" aria-label="${title}" title="${title}">${label}</button>`;
  const open = openRows.has(c.id);
  const hasExtra = c.remarks.length || c.note || c.reason;
  return `
    <div class="att-row" data-child="${esc(c.id)}">
      <div class="att-main">
        ${avatarHtml(c, 'sm')}
        <div class="att-name">
          <button class="link" data-open="${esc(c.id)}">${esc(c.name)}</button>
          <div class="att-meta">${c.guest ? '<span class="badge info">Guest</span>' : leaveBadge(c.leaves, view.settings.maxLeaves, c.exceeded)}${c.status === 'excused' && c.reason ? ` <span class="badge info">${esc(c.reason)}</span>` : ''}</div>
        </div>
        <div class="pam">
          ${b('present', 'P', 'Present')}${b('absent', 'A', 'Absent')}${b('excused', 'ML', 'Medical leave')}
          <button class="more${open ? ' on' : ''}${hasExtra ? ' has' : ''}" data-more aria-expanded="${open}" aria-label="Remarks and notes" title="Remarks and notes">⋯</button>
        </div>
      </div>
      ${c.exceeded ? `<div class="att-over">${overNote(c)}</div>` : ''}
      ${open ? extraHtml(c) : ''}
    </div>`;
}

function replaceRow(el, c) {
  const tmp = document.createElement('div');
  tmp.innerHTML = childRow(c);
  const fresh = tmp.firstElementChild;
  el.replaceWith(fresh);
  wireRow(fresh);
  const sum = $('#sumline');
  if (sum) sum.textContent = summaryText();
}

function wireRow(el) {
  const c = view.children.find((x) => x.id === el.dataset.child);
  const save = () => run(async () => {
    await call('teacher/mark', { method: 'PUT', body: { date, type, event, childId: c.id, status: c.status, reason: c.reason, remarks: c.remarks, note: c.note } });
    const qs = new URLSearchParams({ date, type, ...(isOccasion(type) ? { event } : {}) });
    view = await call(`teacher/session?${qs}`); // refresh leave tallies
    replaceRow(document.querySelector(`[data-child="${CSS.escape(c.id)}"]`), view.children.find((x) => x.id === c.id));
  });
  el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
    c.status = c.status === b.dataset.set ? null : b.dataset.set; // tap again to clear
    if (c.status !== 'excused') c.reason = '';
    save();
  }));
  $('[data-more]', el).addEventListener('click', () => {
    if (openRows.has(c.id)) openRows.delete(c.id); else openRows.add(c.id);
    replaceRow(el, c);
  });
  $('.reason', el)?.addEventListener('change', (e) => { c.reason = e.target.value; save(); });
  el.querySelectorAll('input[type=checkbox]').forEach((i) => i.addEventListener('change', () => {
    c.remarks = [...el.querySelectorAll('input[type=checkbox]:checked')].map((x) => x.value);
    save();
  }));
  $('textarea', el)?.addEventListener('change', (e) => { c.note = e.target.value; save(); });
}

// Any element with data-open opens that child's details.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open]');
  if (t) run(() => openChild(t.dataset.open));
});

// ======================= Occasions =======================

let occSeason = null;

async function loadOccasions() {
  const o = await call(`teacher/occasions${occSeason ? `?season=${occSeason}` : ''}`);
  occSeason = o.season;
  const sym = (st) => (st === 'present' ? '<span class="sym p">✓</span>' : st === 'absent' ? '<span class="sym a">✗</span>' : st === 'excused' ? '<span class="sym e">ML</span>' : '<span class="sym n">–</span>');
  $('#occasions').innerHTML = `
    <div class="card row between">
      <div><h3 style="margin:0">Special occasions</h3><div class="muted">Pick who takes part in each feast (main group and guests), then take attendance for its practices and mass.</div></div>
      <div class="row"><select id="occSeason" aria-label="Choir year">${o.seasons.map((x) => `<option value="${x}"${x === o.season ? ' selected' : ''}>${x}–${String(x + 1).slice(2)}</option>`).join('')}</select>
        <button class="btn primary" id="newOccasion">＋ New occasion</button></div>
    </div>
    ${o.events.length ? o.events.map((ev) => `
      <div class="card">
        <div class="row between"><h3 style="margin:0">${esc(ev.event)} <span class="muted">· ${ev.total} people</span></h3>
          <div class="row"><button class="btn small" data-edit="${esc(ev.id)}">👥 People</button>
            <button class="btn small" data-add="${esc(ev.event)}">＋ Practice</button></div></div>
        ${ev.sessions.length ? `<div class="matrix-wrap"><table class="matrix">
          <thead><tr><th>Child</th>${ev.sessions.map((x) => `
            <th><button class="link" data-goto="${x.date}|${x.type}|${esc(ev.event)}">${x.date.slice(8)}/${x.date.slice(5, 7)}</button><div class="muted">${x.type === 'feast' ? '🎶 Mass' : 'Practice'}<br>${x.presentCount} here</div></th>`).join('')}
            <th>Attended</th><th>Points</th><th>Remarks</th><th></th></tr></thead>
          <tbody>${ev.children.map((c) => `
            <tr><td><button class="link" data-open="${esc(c.id)}">${esc(c.name)}</button>${c.guest ? ' <span class="badge info">Guest</span>' : ''}</td>
              ${c.cells.map((st) => `<td>${sym(st)}</td>`).join('')}
              <td><b>${c.attended}/${ev.sessions.length}</b></td><td>${fmtPts(c.points)}</td>
              <td>${c.good ? `👍 ${c.good}` : ''} ${c.concerns ? `⚠️ ${c.concerns}` : ''}</td>
              <td>${c.guest ? `<button class="btn small" data-promote="${esc(c.id)}">⬆ Main group</button>` : ''}</td></tr>`).join('')}</tbody>
        </table></div>` : '<div class="muted" style="margin-top:8px">No practices recorded yet. Tap “＋ Practice” to start.</div>'}
      </div>`).join('') : `<div class="empty">No occasions for this year yet.<br>Tap <b>＋ New occasion</b>, name it (Christmas, Easter…) and choose who takes part.</div>`}`;
  $('#occSeason').addEventListener('change', (e) => { occSeason = Number(e.target.value); run(loadOccasions); });
  $('#newOccasion').addEventListener('click', () => run(() => openOccasion(null)));
  $('#occasions').querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => run(() => openOccasion(b.dataset.edit))));
  $('#occasions').querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    type = 'practice'; event = b.dataset.add; date = todayStr();
    showTab('attendance');
  }));
  $('#occasions').querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    [date, type, event] = b.dataset.goto.split('|');
    showTab('attendance');
  }));
  $('#occasions').querySelectorAll('[data-promote]').forEach((b) => b.addEventListener('click', () => run(async () => {
    const c = o.events.flatMap((e) => e.children).find((x) => x.id === b.dataset.promote);
    if (!confirm(`Move ${c.name} to the main group? They will appear in regular attendance and on the leaderboard.`)) return;
    await call(`teacher/children/${c.id}`, { method: 'PATCH', body: { guest: false } });
    await loadOccasions();
  })));
}

// Create or edit an occasion: choose main-group children, add guests who are not in the choir.
async function openOccasion(id, seasonWanted = occSeason) {
  const o = await call(`teacher/occasions${seasonWanted ? `?season=${seasonWanted}` : ''}`);
  const season = o.season;
  const ev = id ? o.events.find((x) => x.id === id) : null;
  const picked = new Set(ev ? ev.memberIds : o.main.map((c) => c.id)); // new occasions start with everyone ticked
  const guestsIn = ev ? ev.children.filter((c) => c.guest) : [];
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">${ev ? esc(ev.event) : 'New occasion'}</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <form id="occForm">
      ${ev ? '' : `<label class="field">Occasion name
        <input id="occNameInput" required maxlength="60" placeholder="Type your own name, e.g. Feast of St. Francis"></label>
        <div class="muted" style="margin:-4px 0 6px">Or tap a quick start:</div>
        <div class="row">${o.presets.map((n) => `<button type="button" class="btn small" data-preset="${esc(n)}">${esc(n)}</button>`).join('')}</div>`}
      <div class="row between"><h3 style="margin:12px 0 4px">Main group</h3>
        <span class="row"><button type="button" class="btn small" id="selAll">Select all</button><button type="button" class="btn small" id="selNone">None</button></span></div>
      <div class="pick-list">${o.main.map((c) => `<label class="chk"><input type="checkbox" data-m="${esc(c.id)}"${picked.has(c.id) ? ' checked' : ''}> ${esc(c.name)}</label>`).join('') || '<div class="muted">No children in the main group yet.</div>'}</div>
      ${guestsIn.length ? `<h3 style="margin:12px 0 4px">Guests in this occasion</h3>
        <div class="pick-list">${guestsIn.map((c) => `<label class="chk"><input type="checkbox" data-m="${esc(c.id)}" checked> ${esc(c.name)} <span class="badge info">Guest</span></label>`).join('')}</div>` : ''}
      <h3 style="margin:12px 0 4px">Add guests <span class="muted">(not in the main choir)</span></h3>
      <textarea id="guests" rows="4" placeholder="One name per line, e.g.&#10;Gita Menezes&#10;Harry Lobo, 5th"></textarea>
      <div class="muted">Guests appear only in this occasion. If they do well, move them to the main group later.</div>
      <div class="row" style="margin-top:12px"><button class="btn primary">${ev ? 'Save people' : 'Create occasion'}</button>
        ${ev && !ev.sessions.length ? '<button type="button" class="btn danger" id="delOcc">Delete occasion</button>' : ''}
        <span id="occMsg" class="muted" aria-live="polite"></span></div>
    </form>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  $('#dlgBody').querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => { $('#occNameInput').value = b.dataset.preset; $('#occNameInput').focus(); }));
  const boxes = () => [...$('#dlgBody').querySelectorAll('[data-m]')];
  $('#selAll').addEventListener('click', () => boxes().forEach((b) => { b.checked = true; }));
  $('#selNone').addEventListener('click', () => boxes().forEach((b) => { b.checked = false; }));
  $('#delOcc')?.addEventListener('click', () => run(async () => {
    if (!confirm(`Delete ${ev.event}? This cannot be undone.`)) return;
    await call(`teacher/occasions/${id}`, { method: 'DELETE' });
    dlg.close(); await loadOccasions();
  }));
  $('#occForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const members = boxes().filter((b) => b.checked).map((b) => b.dataset.m);
    const guests = $('#guests').value;
    try {
      const name = ev ? ev.event : $('#occNameInput').value.trim();
      const r = ev
        ? await call(`teacher/occasions/${id}`, { method: 'PUT', body: { members, guests } })
        : await call('teacher/occasions', { method: 'POST', body: { season, name, members, guests } });
      if (r.skipped?.length) alert(`Some guest names were skipped:\n${r.skipped.map((x) => `${x.line}: ${x.reason}`).join('\n')}`);
      dlg.close();
      if (!ev) { type = 'practice'; event = name; }
      refreshVisible();
    } catch (err) { $('#occMsg').textContent = `⚠️ ${err.message}`; }
  });
}

// ======================= Children =======================

const codeText = (code) => code;
const mask = (code) => '•'.repeat(code.length);

async function loadChildren() {
  const { children, pending } = await call('teacher/children');
  const main = children.filter((c) => !c.guest);
  const guests = children.filter((c) => c.guest);
  const row = (c) => `
    <div class="card row">
      ${avatarHtml(c)}
      <div class="grow"><button class="link" data-open="${esc(c.id)}">${esc(c.name)}</button>
        <div class="muted">${c.standard ? `Std ${esc(c.standard)}` : 'No standard yet'}${c.joinedYear ? ` · joined ${c.joinedYear}` : ''}</div></div>
      ${c.active ? '' : '<span class="badge">left choir</span>'}
      ${c.gamePaid ? '<span class="badge ok" title="Full Vocals game unlocked">🎤 unlocked</span>' : ''}
      ${c.guest ? `<button class="btn small" data-promote="${esc(c.id)}">⬆ Move to main group</button>` : ''}
    </div>`;
  $('#children').innerHTML = `
    ${pendingHtml(pending)}
    <div class="row between"><h3 style="margin:8px 0">${main.filter((c) => c.active).length} children (A–Z)</h3>
      <div class="row"><button class="btn primary" id="addChild">＋ Add child</button>
        <button class="btn" id="addMany">＋ Add many</button>
        <button class="btn" id="parentLinks">🔑 Parent access</button></div></div>
    ${main.map(row).join('') || '<div class="empty">No children yet — tap “Add child”.</div>'}
    ${guests.length ? `<h3 style="margin:18px 0 4px">Guests <span class="muted">(only in special occasions)</span></h3>${guests.map(row).join('')}` : ''}`;
  $('#addChild').addEventListener('click', () => run(() => openChild(null)));
  $('#addMany').addEventListener('click', openBulk);
  $('#parentLinks').addEventListener('click', () => run(openLinks));
  $('#children').querySelectorAll('[data-promote]').forEach((b) => b.addEventListener('click', () => run(async () => {
    const c = guests.find((x) => x.id === b.dataset.promote);
    if (!confirm(`Move ${c.name} to the main group? They will appear in regular attendance and on the leaderboard.`)) return;
    await call(`teacher/children/${c.id}`, { method: 'PATCH', body: { guest: false } });
    await loadChildren();
  })));
}

// ---- child details dialog ----

const dlg = $('#dlg');
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

async function resizeToJpeg(file, size = 480) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

// ---- add many children at once ----

function openBulk() {
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">Add many children</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <p class="muted">Type or paste one child per line. Add the standard after a comma if you like, e.g. <b>Ben Fernandes, 5th</b>. Photos and other details can be added later by tapping a name.</p>
    <form id="bulkForm">
      <textarea name="text" rows="10" required placeholder="Anna Dias&#10;Ben Fernandes, 5th&#10;Chloe Pereira, 6th"></textarea>
      <div class="row"><label class="field grow">Standard for everyone (optional)<input name="standard" maxlength="20"></label>
        <label class="field grow">Year joined<input name="joinedYear" type="number" min="1990" max="2100" value="${new Date().getFullYear()}"></label></div>
      <div class="row"><button class="btn primary">Add children</button><span id="bulkMsg" class="muted" aria-live="polite"></span></div>
    </form>
    <div id="bulkResult"></div>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => { dlg.close(); refreshVisible(); });
  $('#bulkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const r = await call('teacher/bulk-children', { method: 'POST', body });
      $('#bulkResult').innerHTML = `
        <div class="alert ok"><b>Added ${r.added.length} ${r.added.length === 1 ? 'child' : 'children'}.</b>
          ${r.added.length ? 'Each one has a private parent code.' : ''}</div>
        ${r.skipped.length ? `<div class="alert warn"><b>Skipped ${r.skipped.length}:</b>${r.skipped.map((x) => `<div>${esc(x.line)} — ${esc(x.reason)}</div>`).join('')}</div>` : ''}
        <div class="row"><button class="btn primary" id="toLinks">🔑 Get parent codes</button><button class="btn" id="done">Done</button></div>`;
      $('#bulkForm').hidden = true;
      $('#done').addEventListener('click', () => { dlg.close(); refreshVisible(); });
      $('#toLinks').addEventListener('click', () => run(openLinks));
    } catch (err) { $('#bulkMsg').textContent = `⚠️ ${err.message}`; }
  });
}

// ---- parent access: ONE shared link for everybody + a private code per child ----

async function openLinks() {
  const { children, settings, lockedOut } = await call('teacher/children');
  const base = settings.publicUrl || location.origin;
  const list = children.filter((c) => c.active && !c.guest);
  const hello = `Hi parents! Open ${base} , tap "My child" and enter the code I give you for your child.`;
  const msg = (c) => `Hi! Open ${base} , tap "My child" and enter this code for ${c.name}: ${codeText(c.code)}`;
  let revealed = false;
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">Parent access</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <h3 style="margin:14px 0 4px">1. One link for everyone</h3>
    <div class="linkrow"><input readonly value="${esc(base)}" id="baseBox" aria-label="Link for all parents">
      <button class="btn small" id="copyBase">Copy link</button>
      <a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(hello)}">WhatsApp</a></div>
    ${settings.publicUrl ? '' : `<div class="muted">This is the address you're using now. Once the app is online, set the real web address in <b>Settings</b>.</div>`}
    <div class="alert ${lockedOut ? 'warn' : 'ok'}" id="lockBox" style="margin-top:14px">
      ${lockedOut ? `<b>🔒 ${lockedOut === 1 ? 'A device is' : 'Some devices are'} locked out</b> after too many wrong codes.` : '<b>No one is locked out.</b> After 5 wrong codes a device waits half an hour.'}
      <div class="row" style="margin-top:6px"><button class="btn small" id="unlock">🔓 Unlock everyone now</button><span class="muted" id="unlockMsg" aria-live="polite"></span></div></div>
    <h3 style="margin:16px 0 4px">2. A private code for each child</h3>
    <div class="muted">Like a roll number. Parents open the link above, tap <b>My child</b> and type the code. A code opens only that child. Only you can see this list, so give each parent only their own code.</div>
    <div class="row" style="margin:8px 0"><button class="btn small" id="toggleAll">Show codes</button><button class="btn small" id="copyAll">Copy all (name + code)</button></div>
    <div class="links-list">${list.map((c) => `
      <div class="row between">
        <span class="row">${avatarHtml(c, 'sm')}<span><b>${esc(c.name)}</b><div class="code-mask" data-code="${esc(c.id)}">${mask(c.code)}</div></span></span>
        <span class="row"><button class="btn small" data-copy="${esc(c.id)}">Copy code</button>
          <a class="btn small" target="_blank" rel="noopener" href="${waLink(c.contact, msg(c))}" title="${c.contact ? `Opens WhatsApp chat with ${esc(c.contact)}` : 'No number saved: pick a contact in WhatsApp'}">WhatsApp</a></span>
      </div>`).join('') || '<div class="empty">No children yet.</div>'}</div>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  const copy = async (text, btn, done) => {
    try { await navigator.clipboard.writeText(text); const old = btn.textContent; btn.textContent = done; setTimeout(() => { btn.textContent = old; }, 1500); } catch { prompt('Copy this:', text); }
  };
  $('#unlock').addEventListener('click', () => run(async () => {
    const r = await call('teacher/unlock-codes', { method: 'POST', body: {} });
    $('#unlockMsg').textContent = r.cleared ? 'Unlocked. Parents can try again now.' : 'Nobody was locked, all clear.';
    $('#lockBox').className = 'alert ok';
  }));
  $('#copyBase').addEventListener('click', (e) => copy(base, e.target, 'Copied ✓'));
  $('#copyAll').addEventListener('click', (e) => copy(list.map((c) => `${c.name}\t${codeText(c.code)}`).join('\n'), e.target, 'Copied ✓'));
  $('#toggleAll').addEventListener('click', (e) => {
    revealed = !revealed;
    $('#dlgBody').querySelectorAll('[data-code]').forEach((el) => { const c = list.find((x) => x.id === el.dataset.code); el.textContent = revealed ? codeText(c.code) : mask(c.code); });
    e.target.textContent = revealed ? 'Hide codes' : 'Show codes';
  });
  $('#dlgBody').querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(codeText(list.find((c) => c.id === b.dataset.copy).code), b, 'Copied ✓')));
}

function decisionPanel(d) {
  const st = d.stats;
  const cur = st.decision?.status ?? null;
  if (!st.exceeded && !cur) return '';
  const btn = (v, label) => `<button class="btn small${cur === v ? ' primary' : ''}" data-decide="${v}">${label}</button>`;
  return `
    <div class="alert ${cur ? 'ok' : 'warn'}" style="margin-top:16px">
      <b>${st.exceeded ? `Over the leave limit (${st.leaves}/${d.settings.maxLeaves})` : 'Leave decision'}</b>
      <div class="muted">${cur === 'keep' ? 'You chose to keep them in the choir.' : cur === 'out' ? 'Marked as not continuing this year (hidden from the leaderboard).' : 'Nobody is removed automatically. You decide:'}</div>
      <div class="row" style="margin-top:8px">${btn('keep', '✅ Keep in choir')}${btn('out', 'Not continuing this year')}${cur ? btn('clear', 'Undo decision') : ''}</div>
    </div>`;
}

async function openChild(id) {
  const blank = { id: null, name: '', standard: '', joinedYear: new Date().getFullYear(), contact: '', address: '', emergencyName: '', emergencyPhone: '', photo: null, active: true };
  const d = id ? await call(`teacher/child/${id}`) : blank;
  let pendingPhoto = null; // chosen before the child exists
  const base = (await call('teacher/children')).settings.publicUrl || location.origin;
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">${id ? esc(d.name) : 'New child'}</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <div class="profile-head" style="margin-top:12px">
      <span id="pic">${avatarHtml(d, 'xl')}</span>
      <div class="grow">
        <label class="btn small" style="display:inline-block">📷 Take photo<input type="file" accept="image/*" capture="user" id="cam" hidden></label>
        <label class="btn small" style="display:inline-block">🖼️ Choose photo<input type="file" accept="image/*" id="gal" hidden></label>
        <div class="muted" id="picMsg" aria-live="polite"></div>
      </div>
    </div>
    <form id="cf">
      <label class="field">Name<input name="name" required maxlength="80" value="${esc(d.name)}"></label>
      <div class="row"><label class="field grow">Standard<input name="standard" maxlength="20" placeholder="e.g. 5th" value="${esc(d.standard)}"></label>
        <label class="field grow">Year joined<input name="joinedYear" type="number" min="1990" max="2100" value="${d.joinedYear ?? ''}"></label></div>
      <label class="field">Contact number<input name="contact" type="tel" maxlength="20" value="${esc(d.contact)}"></label>
      <label class="field">Address<textarea name="address" rows="2" maxlength="300">${esc(d.address)}</textarea></label>
      <div class="row"><label class="field grow">Parent name<input name="emergencyName" maxlength="80" value="${esc(d.emergencyName)}"></label>
        <label class="field grow">Parent number<input name="emergencyPhone" type="tel" maxlength="20" value="${esc(d.emergencyPhone)}"></label></div>
      <div class="row"><button class="btn primary">${id ? 'Save details' : 'Add child'}</button><span id="cfMsg" class="muted" aria-live="polite"></span></div>
    </form>
    ${id ? `
      <h3 style="margin-top:20px">Parent code</h3>
      <div class="card" style="margin-top:6px">
        <div class="row between"><span class="code-mask" id="codeShown" data-shown="0">${mask(d.code)}</span>
          <span class="row"><button class="btn small" id="reveal">Show</button><button class="btn small" id="copyCode">Copy code</button>
            <a class="btn small" target="_blank" rel="noopener" href="${waLink(d.contact, `Hi! Open ${base} , tap \"My child\" and enter this code for ${d.name}: ${codeText(d.code)}`)}">WhatsApp</a></span></div>
        <div class="row" style="margin-top:8px"><button class="btn small" id="editCode">Choose my own code</button>
          <button class="btn small danger" id="newCode">Make a new code</button></div>
        <div class="muted">Only you can see this code. Give it privately to this child's parent. Make a new code if it was shared by mistake.</div>
      </div>
      <h3 style="margin-top:20px">Vocals game</h3>
      <div class="card row between" style="margin-top:6px">
        <span>${d.gamePaid ? `✅ Full game unlocked until ${esc(fmtDate(d.gamePaidUntil))}` : d.gameExpired ? `⌛ The year ended on ${esc(fmtDate(d.gamePaidUntil))}. Renew when they pay again` : '🔒 Free version only (Level 1 and 3 Warm-up sessions)'}</span>
        <span class="row">
          <button class="btn small primary" id="gameUnlock">${d.gamePaid ? 'Renew for a year' : d.gameExpired ? 'Renew for a year' : 'Unlock for a year'}</button>
          ${d.gamePaid ? '<button class="btn small" id="gameLock">Lock now</button>' : ''}</span></div>
      ${d.gamePaid ? '' : `<div class="card row between" style="margin-top:6px"><span>🔥 Free Warm-up sessions left: <b>${d.warmupLeft ?? 3} of 3</b></span><button class="btn small" id="warmReset"${(d.warmupLeft ?? 3) >= 3 ? ' disabled' : ''}>Reset to 3</button></div>`}
      <div class="muted">One payment gives 365 days. Renewing while it is running adds a year to the end date. Progress and scores are always kept.</div>
      ${decisionPanel(d)}
      ${leaveAlertHtml(d, { teacher: true })}
      <h3 style="margin-top:20px">This year</h3>${statsHtml(d)}
      <h3 style="margin-top:20px">Remarks log <span class="muted">(all dates)</span></h3><div class="card">${remarksLogHtml(d.remarkLog)}</div>
      <h3 style="margin-top:20px">Attendance this year</h3><div class="card">${historyHtml(d.history)}</div>
      <button class="btn danger" id="toggle">${d.active ? 'Remove from choir' : 'Add back to choir'}</button>` : ''}`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  const gameSet = (paid) => run(async () => { await call(`teacher/children/${id}/game`, { method: 'PUT', body: { paid } }); await openChild(id); });
  $('#gameUnlock')?.addEventListener('click', () => gameSet(true));
  $('#gameLock')?.addEventListener('click', () => gameSet(false));
  $('#warmReset')?.addEventListener('click', () => run(async () => { await call(`teacher/children/${id}/game`, { method: 'PUT', body: { resetWarmups: true } }); await openChild(id); }));

  const setPhoto = async (file) => {
    if (!file) return;
    try {
      const picked = await pickPhotos(file); // square profile photo, then the face for the leaderboard
      if (!picked) return;
      const { image } = picked;
      if (id) {
        const r = await call(`teacher/children/${id}/photo`, { method: 'POST', body: picked });
        d.photo = `${r.photo}`; d.head = r.head;
      } else {
        pendingPhoto = picked;
        d.photo = image;
      }
      $('#pic').innerHTML = avatarHtml(d, 'xl');
      $('#picMsg').textContent = id ? '✅ Photo saved' : 'Photo ready — it saves with the child.';
    } catch (err) { $('#picMsg').textContent = `⚠️ ${err.message}`; }
  };
  $('#cam').addEventListener('change', (e) => setPhoto(e.target.files[0]));
  $('#gal').addEventListener('change', (e) => setPhoto(e.target.files[0]));

  $('#cf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      if (id) {
        await call(`teacher/children/${id}`, { method: 'PATCH', body });
      } else {
        const created = await call('teacher/children', { method: 'POST', body });
        if (pendingPhoto) await call(`teacher/children/${created.id}/photo`, { method: 'POST', body: pendingPhoto });
      }
      dlg.close();
      refreshVisible();
    } catch (err) { $('#cfMsg').textContent = `⚠️ ${err.message}`; }
  });
  if (!id) return;
  $('#dlgBody').querySelectorAll('[data-decide]').forEach((b) => b.addEventListener('click', () => run(async () => {
    const v = b.dataset.decide;
    await call(`teacher/children/${id}/decision`, { method: 'PUT', body: { season: d.season, status: v === 'clear' ? null : v } });
    await openChild(id);
    refreshVisible();
  })));
  $('#reveal').addEventListener('click', () => {
    const el = $('#codeShown');
    const show = el.dataset.shown !== '1';
    el.dataset.shown = show ? '1' : '0';
    el.textContent = show ? codeText(d.code) : mask(d.code);
    $('#reveal').textContent = show ? 'Hide' : 'Show';
  });
  $('#copyCode').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(codeText(d.code)); $('#copyCode').textContent = 'Copied ✓'; } catch { prompt('Copy this code:', codeText(d.code)); }
  });
  $('#editCode').addEventListener('click', async () => {
    const v = prompt(`Type a short code for ${d.name} (3–8 letters or digits), e.g. 1001 or CC01`, d.code);
    if (v === null || !v.trim()) return;
    await run(async () => { await call(`teacher/children/${id}`, { method: 'PATCH', body: { code: v } }); await openChild(id); });
  });
  $('#newCode').addEventListener('click', async () => {
    if (!confirm(`The old link for ${d.name} will stop working. Continue?`)) return;
    await run(async () => { await call(`teacher/children/${id}/new-code`, { method: 'POST', body: {} }); await openChild(id); });
  });
  $('#toggle').addEventListener('click', () => run(async () => {
    await call(`teacher/children/${id}`, { method: 'PATCH', body: { active: !d.active } });
    dlg.close();
    refreshVisible();
  }));
}

function refreshVisible() {
  const t = tabs.find((x) => !$(`#${x}`).hidden);
  run(loaders[t]);
}

// ======================= Leaderboard (teacher) =======================

let boardRange = 'month';
async function loadBoard() {
  const o = await call('teacher/board');
  const eligible = (rows) => rows.filter((r) => r.eligible);
  const table = (rows) => `<table><thead><tr><th>#</th><th>Name</th><th class="num">Leaves</th><th class="num">Points</th></tr></thead><tbody>${rows.map((r) => `
    <tr${r.eligible ? '' : ' style="color:var(--muted)"'}><td>${r.rank ?? '–'}</td>
      <td><button class="link" data-open="${esc(r.id)}">${esc(r.name)}</button>${r.eligible ? (r.over ? ` <span class="badge ${r.decision === 'keep' ? 'info' : 'warn'}">${r.decision === 'keep' ? 'over limit – kept' : 'over limit – decide'}</span>` : '') : ' <span class="badge bad">not continuing</span>'}</td>
      <td class="num">${r.leaves}</td><td class="num"><b>${fmtPts(r.points)}</b></td></tr>`).join('')}</tbody></table>`;
  $('#board').innerHTML = `
    <div class="stage">
      <h2>🎤 Leaderboard preview</h2>
      <div class="sub">This is what parents see.</div>
      <div class="toggle">
        <button class="pill ${boardRange === 'month' ? 'on' : ''}" data-range="month">${esc(o.monthLabel)}</button>
        <button class="pill ${boardRange === 'year' ? 'on' : ''}" data-range="year">This year</button>
      </div>
      <div id="lb"></div>
    </div>
    ${pendingHtml(o.pending)}
    <h2>Prize race <span class="muted">(private – parents don't see this)</span></h2>
    <div class="card"><b>Prize at ${esc(o.prize.label)}</b>
      <div class="muted">Counting ${esc(o.seasonLabel)} up to ${fmtDate(o.prize.date)}. Children you marked as not continuing are not eligible.</div>
      ${table(o.prizeBoard)}</div>`;
  const draw = () => renderBoard($('#lb'), eligible(boardRange === 'month' ? o.monthBoard : o.yearBoard));
  draw();
  $('#board').querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
    boardRange = b.dataset.range;
    $('#board').querySelectorAll('[data-range]').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
}

// ======================= Settings =======================

async function loadSettings() {
  const { settings: s, firstSeason } = await call('teacher/children');
  // step="any": values like 0.25 (the remark bonus) must be allowed, or the browser silently refuses to save the form
  const num = (name, label, val, extra = '') => `<label class="field">${label}<input name="${name}" type="number" ${extra.includes('step') ? '' : 'step="any"'} min="0" value="${val}" ${extra}></label>`;
  const sec = (title, sub, body, open = false) => `<details class="card set-sec"${open ? ' open' : ''}><summary><span class="grow"><b>${title}</b><span class="muted">${sub}</span></span><span class="chev" aria-hidden="true">▾</span></summary><div class="set-body">${body}</div></details>`;
  $('#settings').innerHTML = `
    <form id="setForm">
      ${sec('Points and leaves', 'How children score and how many leaves they get', `
        ${num('satPoints', 'Saturday practice points', s.satPoints)}
        ${num('sunPoints', 'Sunday mass points', s.sunPoints)}
        ${num('practicePoints', 'Points per feast practice (Christmas, Easter…)', s.practicePoints)}
        ${num('feastPoints', 'Points for the feast mass itself', s.feastPoints)}
        ${num('remarkPenalty', 'Points taken off a session with any negative remark (charged once, however many)', s.remarkPenalty)}
        ${num('remarkBonus', 'Points added for each positive remark (well behaved, helped others)', s.remarkBonus)}
        ${num('latePointsFactor', 'Share of points when late (1 = full points; the remark penalty applies on top)', s.latePointsFactor, 'step="0.1" max="1"')}
        ${num('maxLeaves', 'Leaves allowed per year (April–April)', s.maxLeaves, 'step="1"')}
        <label class="chk"><input name="countSundayAbsences" type="checkbox"${s.countSundayAbsences ? ' checked' : ''}> Missing Sunday mass also counts as a leave</label>
        <p class="muted">Feast practices, feast masses and medical absences never count as leaves. Going over the leave limit never removes a child by itself; you decide.</p>`, true)}
      ${sec('Vocals and payment', 'The singing game, its price and how parents pay', `
        <div class="muted" style="margin-bottom:4px"><b>Games for parents.</b> Switch each game on when you are ready. They can be launched one at a time.</div>
        <label class="chk"><input name="gameEnabled" type="checkbox"${s.gameEnabled ? ' checked' : ''}> 🎤 Vocals (singing) game is on for parents</label>
        <label class="chk"><input name="staffEnabled" type="checkbox"${s.staffEnabled ? ' checked' : ''}> 🎼 Read the staff game is on for parents</label>
        <div class="muted" style="margin:8px 0">Warm-up (3 free sessions) and Level 1 are free. Parents pay you directly, then you unlock their child for a year (Children → the child → Vocals game). After 365 days they pay again.</div>
        <label class="field">Price for one year (₹)<input name="gamePrice" type="number" min="0" step="1" value="${s.gamePrice ?? 500}"></label>
        <label class="field">Mobile number to pay (UPI or phone)<input name="gamePayMobile" type="tel" maxlength="20" value="${esc(s.gamePayMobile ?? '')}"></label>
        <label class="field">UPI ID (optional, like name@bank)<input name="gameUpi" maxlength="60" value="${esc(s.gameUpi ?? '')}"></label>
        <div class="muted"><a href="/voice-test.html" target="_blank" rel="noopener">🎤 Open the test version of Vocals</a> (every level open, nothing saved on the server, parents never see it)</div>
        <div class="row" style="margin:6px 0"><button type="button" class="btn small" id="warmResetAll">🔥 Give everyone 3 free Warm-up sessions again</button><span class="muted" id="warmResetMsg" aria-live="polite"></span></div>`)}
      ${sec('Website and choir year', 'The link you share and when the year starts', `
        <label class="field">Website address to share with parents<input name="publicUrl" type="url" placeholder="https://your-choir-app.example.com" value="${esc(s.publicUrl || '')}"></label>
        <label class="field">First year (starts April of)<input name="firstSeason" type="number" placeholder="${firstSeason}" value="${s.firstSeason ?? ''}"></label>
        <p class="muted">Your private prize race ends at Easter in the first year and at the end of December every year after. Leave blank to start from your first recorded session.</p>`)}
      <div class="savebar"><button class="btn primary">Save settings</button></div>
    </form>
    <details class="card set-sec" open><summary><span class="grow"><b>Look of the app</b><span class="muted">Light, Bright or Dark</span></span><span class="chev" aria-hidden="true">▾</span></summary><div class="set-body">${lookCardHtml().replace('<div class="card look" id="lookCard">', '<div id="lookCard">').replace('<h3>Look of the app</h3>', '')}</div></details>`;
  $('#settings').insertAdjacentHTML('beforeend', `
    <details class="card set-sec" id="backupBox" open><summary><span class="grow"><b>Backup &amp; restore</b><span class="muted">Keep your data safe</span></span><span class="chev" aria-hidden="true">▾</span></summary><div class="set-body">
      <div class="muted">One file with all children, attendance, occasions, hymns, photos and recordings. Download one regularly and keep it safe (for example in your D drive or Google Drive). Use <b>Restore</b> to move everything onto a new computer or the online server. Restoring replaces what is there now.</div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="dlBackup">⬇ Download backup</button>
        <label class="btn" style="display:inline-block">⬆ Restore from backup<input type="file" accept=".tar,application/x-tar" id="rsBackup" hidden></label>
        <span id="bkMsg" class="muted" aria-live="polite"></span></div>
      ${pin ? '<div class="row" style="margin-top:12px"><button class="btn small" id="forgetPin">Forget my PIN on this device</button></div>' : ''}
    </div></details>`);
  $('#dlBackup').addEventListener('click', () => run(async () => {
    $('#bkMsg').textContent = 'Preparing…';
    const res = await fetch('/api/teacher/backup', { headers: pin ? { 'x-pin': pin } : {} });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not make the backup');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `choir-backup-${todayStr()}.tar`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('#bkMsg').textContent = '✅ Downloaded';
  }));
  $('#rsBackup').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!confirm(`Restore from ${f.name}? Everything currently here (children, attendance, hymns, photos) will be replaced by the backup.`)) { e.target.value = ''; return; }
    $('#bkMsg').textContent = 'Restoring… please wait';
    try {
      const res = await fetch('/api/teacher/restore', { method: 'POST', headers: { 'content-type': 'application/x-tar', ...(pin ? { 'x-pin': pin } : {}) }, body: f });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      $('#bkMsg').textContent = `✅ Restored ${data.children} children. Reloading…`;
      setTimeout(() => location.reload(), 1200);
    } catch (err) { $('#bkMsg').textContent = `⚠️ ${err.message}`; }
  });
  $('#forgetPin')?.addEventListener('click', () => { try { localStorage.removeItem('choir-pin'); } catch { /* private mode */ } location.reload(); });
  $('#warmResetAll')?.addEventListener('click', () => {
    if (!confirm('Give EVERY child their 3 free Warm-up sessions again?')) return;
    run(async () => { const r = await call('teacher/game-warmups', { method: 'POST', body: {} }); $('#warmResetMsg').textContent = `✅ Done. ${r.reset} ${r.reset === 1 ? 'child' : 'children'} had used some.`; });
  });
  wireLook($('#settings'));
  $('#setForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    run(async () => {
      const body = Object.fromEntries(['satPoints', 'sunPoints', 'practicePoints', 'feastPoints', 'maxLeaves', 'latePointsFactor', 'remarkPenalty', 'remarkBonus'].map((k) => [k, f.get(k)]));
      body.countSundayAbsences = f.get('countSundayAbsences') === 'on';
      body.gameEnabled = f.get('gameEnabled') === 'on';
      body.staffEnabled = f.get('staffEnabled') === 'on';
      body.gamePrice = f.get('gamePrice');
      body.gamePayMobile = f.get('gamePayMobile') || '';
      body.gameUpi = f.get('gameUpi') || '';
      body.firstSeason = f.get('firstSeason') || null;
      body.publicUrl = f.get('publicUrl') || '';
      await call('teacher/settings', { method: 'PUT', body });
      flash('Settings saved.', 'ok');
    });
  });
}

// ======================= Hymn library =======================

const openHymnCats = new Set();
let hymnState = null;

async function loadHymns() {
  hymnState = await api('hymns');
  drawHymnsTab();
}

const hymnSort = () => { try { return localStorage.getItem('choir-hymn-sort') === 'az' ? 'az' : 'cat'; } catch { return 'cat'; } };

function drawHymnsTab() {
  const { categories, hymns } = hymnState;
  const az = hymnSort() === 'az';
  const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
  const groups = az ? [{ id: '_az', label: 'All hymns (A–Z)' }] : categories;
  const raw = $('#hq')?.value || ''; // keep exactly what was typed, spaces included
  const term = raw.trim().toLowerCase();
  $('#hymns').innerHTML = `
    <div class="card">
      <div class="row between"><div><h3 style="margin:0">Hymn library</h3><div class="muted">Hymns taught that are not in the book. Parents browse them by category.</div></div>
        <div class="row"><button class="btn primary" id="addHymn">＋ Add hymn</button><button class="btn" id="addHymns">＋ Add many</button></div></div>
      <div class="row" role="group" aria-label="Order of hymns" style="margin-top:8px"><button class="btn small${az ? '' : ' primary'}" data-sort="cat">By category</button><button class="btn small${az ? ' primary' : ''}" data-sort="az">A–Z</button></div>
      <details style="margin-top:8px"><summary class="muted" style="cursor:pointer;min-height:36px;display:flex;align-items:center">Missing hymns? Bring them back from a backup</summary>
        <div class="muted" style="margin:6px 0">Choose a backup file (.tar from Settings, or a saved data .json). Only hymns that are missing are added; nothing else changes.</div>
        <label class="btn small" style="display:inline-block">⬆ Choose backup file<input type="file" id="hRecover" accept=".tar,.json,application/x-tar,application/json" hidden></label>
        <span class="muted" id="hRecoverMsg" aria-live="polite"></span></details>
      <label class="field"><span class="sr">Search</span><input id="hq" type="search" placeholder="Search hymns…" value="${esc(raw)}"></label>
    </div>
    ${groups.map((c) => {
      const items = hymns.filter((h) => (az || h.category === c.id) && (!term || h.title.toLowerCase().includes(term))).sort(byTitle);
      if (term && !items.length) return '';
      return `<details class="hcat" data-cat="${esc(c.id)}"${az || term || openHymnCats.has(c.id) ? ' open' : ''}>
        <summary><span>${esc(c.label)}</span><span class="badge info">${items.length}</span></summary>
        ${items.map((h) => `
          <div class="hymn row between">
            <div class="grow"><div class="ht">${esc(h.title)}</div>
              <div>${az ? `<span class="badge info">${esc(categories.find((x) => x.id === h.category)?.label || '')}</span> ` : ''}${h.audio ? '<span class="badge ok">🎧 recording</span> ' : ''}${h.link ? '<span class="badge info">🔗 link</span>' : ''}</div></div>
            <span class="row"><button class="btn small" data-hview="${esc(h.id)}">⛶ View</button><button class="btn small" data-hedit="${esc(h.id)}">Edit</button></span>
          </div>`).join('') || '<div class="hymn muted">No hymns here yet.</div>'}
      </details>`;
    }).join('')}`;
  $('#hq').addEventListener('input', () => { drawHymnsTab(); const el = $('#hq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  $('#hymns').querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    try { localStorage.setItem('choir-hymn-sort', b.dataset.sort); } catch { /* ignore */ }
    drawHymnsTab();
  }));
  $('#hRecover').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    $('#hRecoverMsg').textContent = 'Reading…';
    try {
      const res = await fetch('/api/teacher/hymns/recover', { method: 'POST', headers: pin ? { 'x-pin': pin } : {}, body: f });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not read that file');
      await loadHymns();
      $('#hRecoverMsg').textContent = data.added.length ? `✅ Brought back ${data.added.length}: ${data.added.slice(0, 6).join(', ')}${data.added.length > 6 ? '…' : ''}` : `Nothing to add. All ${data.already} hymns in that file are already here.`;
    } catch (err) { $('#hRecoverMsg').textContent = `⚠️ ${err.message}`; }
  });
  $('#addHymn').addEventListener('click', () => openHymn(null));
  $('#addHymns').addEventListener('click', openHymnBulk);
  $('#hymns').querySelectorAll('[data-hview]').forEach((b) => b.addEventListener('click', () => {
    const h = hymns.find((x) => x.id === b.dataset.hview);
    openHymnViewer(h, categories.find((c) => c.id === h.category)?.label);
  }));
  $('#hymns').querySelectorAll('[data-hedit]').forEach((b) => b.addEventListener('click', () => openHymn(b.dataset.hedit)));
  $('#hymns').querySelectorAll('details.hcat').forEach((d) => d.addEventListener('toggle', () => {
    if (term) return;
    if (d.open) openHymnCats.add(d.dataset.cat); else openHymnCats.delete(d.dataset.cat);
  }));
}

const catOptions = (selected) => hymnState.categories.map((c) => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.label)}</option>`).join('');

function openHymn(id, prefill = null) {
  const h = id ? hymnState.hymns.find((x) => x.id === id) : { title: prefill?.title || '', category: hymnState.categories[0].id, link: '', notes: '', audio: null };
  $('#dlgBody').innerHTML = `
    <div class="dlg-top"><h2 style="margin:0" class="grow">${id ? 'Edit hymn' : 'Add hymn'}</h2><button class="btn primary small" form="hf">${id ? 'Save' : 'Add hymn'}</button><button class="btn small" id="close" aria-label="Close" type="button">✕</button></div>
    <div class="muted" id="hmsg" aria-live="polite" style="min-height:1.4em"></div>
    <form id="hf">
      <label class="field">Hymn title<input name="title" required maxlength="120" value="${esc(h.title)}"></label>
      <div class="card" style="margin:6px 0 12px">
        <div class="row"><button type="button" class="btn small" id="findLy">🔎 Find lyrics online</button><span id="lyMsg" class="muted" aria-live="polite">Searches by the title above. You can edit the words before saving.</span></div>
        <div class="row" style="margin-top:8px"><a class="btn small" id="gSearch" target="_blank" rel="noopener noreferrer" href="#">🌐 Search Google</a><a class="btn small" id="dhSearch" target="_blank" rel="noopener noreferrer" href="#">🎼 Search DivineHymns</a></div>
        <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input id="lyLink" type="url" class="grow" placeholder="Paste a link to the words (e.g. from divinehymns.com)" aria-label="Link to a page with the words"><button type="button" class="btn small" id="lyImport">Import</button></div>
        <div id="lyList"></div>
      </div>
      <label class="field">Category<select name="category">${catOptions(h.category)}</select></label>
      <label class="field">Link to the music (optional)<input name="link" type="url" placeholder="https://…" maxlength="500" value="${esc(h.link)}"></label>
      <label class="field">Notes (optional)<input name="notes" maxlength="300" placeholder="e.g. Key of D, verses 1 and 3" value="${esc(h.notes)}"></label>
      <label class="field">Lyrics (optional, shown large and full screen for the children)<textarea name="lyrics" rows="8" maxlength="6000" placeholder="Paste the words here">${esc(h.lyrics || '')}</textarea></label>
      <div class="row"><button class="btn primary">${id ? 'Save' : 'Add hymn'}</button></div>
    </form>
    ${id ? `
      <h3 style="margin-top:18px">Recording</h3>
      <div class="card" style="margin-top:6px">
        <div id="audBox">${h.audio ? `<audio controls preload="none" src="${esc(h.audio)}" style="width:100%"></audio>` : '<div class="muted">No recording yet.</div>'}</div>
        <div class="row" style="margin-top:8px">
          <label class="btn small" style="display:inline-block">🎧 ${h.audio ? 'Replace' : 'Upload'} recording<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" id="aud" hidden></label>
          ${h.audio ? '<button class="btn small danger" id="delAud">Remove recording</button>' : ''}
          <span id="audMsg" class="muted" aria-live="polite"></span></div>
        <div class="muted">MP3, M4A, WAV or OGG, up to 25 MB.</div>
      </div>
      <button class="btn danger" id="delHymn" style="margin-top:14px">Delete hymn</button>` : ''}`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  $('#hf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      if (id) {
        await call(`teacher/hymns/${id}`, { method: 'PATCH', body });
        dlg.close();
      } else {
        const created = await call('teacher/hymns', { method: 'POST', body });
        hymnState = await api('hymns');
        await openHymn(created.id); // straight on to adding a recording
        $('#hmsg').textContent = '✅ Added. You can attach a recording below.';
        return drawHymnsTab();
      }
      await loadHymns();
    } catch (err) { $('#hmsg').textContent = `⚠️ ${err.message}`; }
  });
  const q2 = (extra = '') => encodeURIComponent(`${$('#hf').elements.title.value.trim()} hymn lyrics${extra}`);
  const setLinks = () => {
    $('#gSearch').href = `https://www.google.com/search?q=${q2()}`;
    $('#dhSearch').href = `https://www.google.com/search?q=${q2(' site:divinehymns.com')}`;
  };
  setLinks();
  $('#hf').elements.title.addEventListener('input', setLinks);
  const showCards = (list) => {
    $('#lyList').innerHTML = list.map((x, i) => `
      <details class="hymn" style="padding:8px 0" open><summary><b>${esc(x.title || 'Words from the page')}</b> <span class="muted">${esc(x.artist || x.host || '')}${x.album ? ` · ${esc(x.album)}` : ''}</span></summary>
        <pre style="white-space:pre-wrap;font:inherit;margin:8px 0;max-height:200px;overflow:auto">${esc(x.lyrics)}</pre>
        <button type="button" class="btn small primary" data-use="${i}">Use these lyrics</button></details>`).join('')
      + (list.length ? '<div class="muted" style="margin-top:6px">Many songs are copyrighted. Use words you are allowed to share with the choir (older hymns are usually fine).</div>' : '');
    $('#lyList').querySelectorAll('[data-use]').forEach((btn) => btn.addEventListener('click', () => {
      const f = $('#hf'); const box = f.elements.lyrics; const pick = list[Number(btn.dataset.use)];
      if (box.value.trim() && !confirm('Replace the lyrics already typed here?')) return;
      box.value = pick.lyrics.slice(0, 6000);
      if (!f.elements.title.value.trim() && pick.title) f.elements.title.value = pick.title;
      $('#lyMsg').textContent = '✅ Lyrics added below. Edit anything you like.';
      $('#lyList').innerHTML = '';
      $('#hmsg').textContent = `✅ Lyrics added. Press ${id ? 'Save' : 'Add hymn'} at the top when you are ready.`;
      $('#dlgBody').scrollTop = 0;
    }));
  };
  $('#lyImport').addEventListener('click', async () => {
    const url = $('#lyLink').value.trim();
    if (!url) { $('#lyMsg').textContent = 'Paste a link first.'; return; }
    $('#lyMsg').textContent = 'Reading the page…';
    $('#lyList').innerHTML = '';
    try {
      const r = await call('teacher/lyrics-link', { method: 'POST', body: { url } });
      $('#lyMsg').textContent = `Read from ${r.host}.${r.cut ? ' It was long, so the end was cut.' : ''} Check it, remove anything extra, then use it.`;
      showCards([r]);
    } catch (err) { $('#lyMsg').textContent = `⚠️ ${err.message}`; }
  });
  $('#findLy').addEventListener('click', async () => {
    const f = $('#hf');
    const q = f.elements.title.value.trim();
    if (q.length < 2) { $('#lyMsg').textContent = 'Type the hymn title above first.'; return; }
    $('#lyMsg').textContent = 'Searching…';
    $('#lyList').innerHTML = '';
    try {
      const r = await call(`teacher/lyrics?q=${encodeURIComponent(q)}`);
      $('#lyMsg').textContent = r.results.length ? `${r.results.length} found. Preview one, then use it.` : 'Nothing found. Try the Google or DivineHymns button, then paste the page link below.';
      showCards(r.results);
    } catch (err) { $('#lyMsg').textContent = `⚠️ ${err.message}`; }
  });
  if (prefill?.auto) $('#findLy').click();
  if (!id) return;
  const extType = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac' };
  $('#aud').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const type = f.type || extType[f.name.split('.').pop().toLowerCase()] || '';
    $('#audMsg').textContent = 'Uploading…';
    try {
      const res = await fetch(`/api/teacher/hymns/${id}/audio`, { method: 'PUT', headers: { 'content-type': type, ...(pin ? { 'x-pin': pin } : {}) }, body: f });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      await loadHymns();
      await openHymn(id);
      $('#audMsg').textContent = '✅ Saved';
    } catch (err) { $('#audMsg').textContent = `⚠️ ${err.message}`; }
  });
  $('#delAud')?.addEventListener('click', () => run(async () => { await call(`teacher/hymns/${id}/audio`, { method: 'DELETE' }); await loadHymns(); await openHymn(id); }));
  $('#delHymn').addEventListener('click', () => run(async () => {
    if (!confirm(`Delete “${h.title}”? Parents will no longer see it.`)) return;
    await call(`teacher/hymns/${id}`, { method: 'DELETE' });
    dlg.close();
    await loadHymns();
  }));
}

function openHymnBulk() {
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">Add many hymns</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <p class="muted">Choose the category, then paste the titles, one per line. To add a music link, put it after a bar: <b>Title | https://…</b></p>
    <form id="hb">
      <label class="field">Category<select name="category">${catOptions(hymnState.categories[0].id)}</select></label>
      <textarea name="text" rows="9" required placeholder="Here I Am, Lord&#10;Gather Us In | https://youtu.be/…&#10;We Are One in the Spirit"></textarea>
      <div class="row" style="margin-top:8px"><button class="btn primary">Add hymns</button><span id="bmsg" class="muted" aria-live="polite"></span></div>
    </form><div id="bres"></div>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => { dlg.close(); loadHymns(); });
  $('#hb').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await call('teacher/hymns/bulk', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      $('#hb').hidden = true;
      $('#bres').innerHTML = `
        <div class="alert ok"><b>Added ${r.added.length} ${r.added.length === 1 ? 'hymn' : 'hymns'}.</b> Tap a hymn later to attach a recording.</div>
        ${r.skipped.length ? `<div class="alert warn"><b>Skipped ${r.skipped.length}:</b>${r.skipped.map((x) => `<div>${esc(x.line)} — ${esc(x.reason)}</div>`).join('')}</div>` : ''}
        <button class="btn primary" id="bdone">Done</button>`;
      $('#bdone').addEventListener('click', () => { dlg.close(); loadHymns(); });
    } catch (err) { $('#bmsg').textContent = `⚠️ ${err.message}`; }
  });
}

// ======================= start =======================

initBack({ home: 'home', go: (t) => showTab(t, true), current: () => currentTab });
run(async () => {
  const meta = await api('meta');
  if (!meta.teacherAllowed) return lockOut('The teacher area only opens on the computer where the app is running.');
  if (meta.pinRequired && !pin) return askPin();
  await showTab('home');
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ======================= Schedule =======================

const fmtClock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function loadSchedule() {
  const sc = await call('teacher/schedule');
  const usual = sc.usual;
  const rules = usual.rules;
  const sat = rules.find((r) => r.weekday === 6);
  const upcoming = sc.days.filter((d) => d.date >= sc.today).slice(0, 14);
  const changed = (d) => d.cancelled || d.special || d.time !== d.usualTime || d.label || (d.note && d.note !== usual.note);
  $('#schedule').innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Saturday practice</h2>
      ${sat ? `<div class="row between sched-row" style="border-top:0"><span><b>Every Saturday</b> · ${esc(fmtClock(sat.time))}</span><button class="btn small" id="satTime">Change time</button></div>
        <div class="muted" style="margin:6px 0">Saturdays are added automatically. To skip one, open it below and cancel it.</div>`
      : `<div class="muted">Saturday practice is switched off. <button class="btn small" id="satOn">Turn it back on</button></div>`}
      <label class="field" style="margin-top:10px">Note shown on every practice<input id="usualNote" maxlength="140" value="${esc(usual.note)}"></label>
    </div>
    <div class="card">
      <div class="row between"><h2 style="margin:0">Upcoming practices</h2><button class="btn primary small" id="addSpecial">＋ Add a practice</button></div>
      <div class="muted" style="margin:4px 0 8px">Saturdays appear here automatically. Tap Edit to change a time or note, or to cancel one. Use ＋ Add a practice for any other day.</div>
      ${upcoming.map((d) => `
        <div class="row between sched-row${d.cancelled ? ' off' : ''}">
          <span><b>${esc(fmtDate(d.date))}</b> · ${d.cancelled ? '<span class="badge bad">cancelled</span>' : esc(fmtClock(d.time))}${d.label ? ` · ${esc(d.label)}` : ''}${d.special ? ' <span class="badge info">extra</span>' : ''}${d.time !== d.usualTime && !d.cancelled && !d.special ? ' <span class="badge warn">time changed</span>' : ''}
            ${d.note && d.note !== usual.note ? `<div class="muted">${esc(d.note)}</div>` : ''}</span>
          <button class="btn small${changed(d) ? '' : ''}" data-day="${esc(d.date)}">${d.cancelled ? 'Restore' : 'Edit'}</button></div>`).join('') || '<div class="muted">Nothing coming up. Add a regular practice or a one-off practice.</div>'}
    </div>`;
  $('#satTime')?.addEventListener('click', () => openRule(usual, 6));
  $('#satOn')?.addEventListener('click', () => run(async () => { await call('teacher/schedule', { method: 'PUT', body: { rules: [...rules, { weekday: 6, time: '19:00' }] } }); await loadSchedule(); }));
  $('#usualNote').addEventListener('change', (e) => run(async () => { await call('teacher/schedule', { method: 'PUT', body: { note: e.target.value } }); flash('Saved', 'ok'); }));
  $('#addSpecial').addEventListener('click', () => openDay(sc, { date: sc.today }, 'special'));
  $('#schedule').querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const d = sc.days.find((x) => x.date === b.dataset.day);
    if (d.cancelled) return run(async () => { await call('teacher/schedule/day', { method: 'PUT', body: { date: d.date, cancelled: false } }); await loadSchedule(); });
    openDay(sc, d, d.special ? 'special' : 'change');
  }));
}

// Add a regular practice (weekday === null) or change / remove one.
function openRule(usual, weekday) {
  const rules = usual.rules;
  const cur = weekday == null ? { weekday: 3, time: '18:00' } : rules.find((r) => r.weekday === weekday);
  $('#dlgBody').innerHTML = `
    <div class="dlg-top"><h2 style="margin:0" class="grow">Saturday practice time</h2><button class="btn small" id="close" type="button" aria-label="Close">✕</button></div>
    <form id="uf">
      <input type="hidden" name="weekday" value="${cur.weekday}">
      <div class="muted" style="margin-bottom:6px">Every ${WEEKDAYS[cur.weekday]}</div>
      <label class="field">At<input name="time" type="time" required value="${esc(cur.time)}"></label>
      <div class="row"><button class="btn primary">Save</button>${weekday != null ? '<button type="button" class="btn danger" id="delRule">Switch off Saturdays</button>' : ''}<span id="umsg" class="muted" aria-live="polite"></span></div>
      ${weekday != null ? '<div class="muted" style="margin-top:8px">Switching off only stops future Saturday practices. Past attendance is kept.</div>' : ''}
    </form>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  const save = (next) => run(async () => { await call('teacher/schedule', { method: 'PUT', body: { rules: next } }); dlg.close(); await loadSchedule(); });
  $('#delRule')?.addEventListener('click', () => { if (confirm('Stop automatic Saturday practices? You can turn them back on.')) save(rules.filter((r) => r.weekday !== weekday)); });
  $('#uf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const entry = { weekday: Number(f.get('weekday')), time: f.get('time') };
    try { await call('teacher/schedule', { method: 'PUT', body: { rules: [...rules.filter((r) => r.weekday !== weekday), entry] } }); dlg.close(); await loadSchedule(); }
    catch (err) { $('#umsg').textContent = `⚠️ ${err.message}`; }
  });
}

function openDay(sc, d, mode) {
  const special = mode === 'special';
  const exists = sc.days.some((x) => x.date === d.date);
  const usualTime = d.usualTime || sc.usual.time;
  $('#dlgBody').innerHTML = `
    <div class="dlg-top"><h2 style="margin:0" class="grow">${special ? (exists && d.special ? 'Edit extra practice' : 'Add a practice') : 'Edit this practice'}</h2><button class="btn small" id="close" type="button" aria-label="Close">✕</button></div>
    <form id="df">
      <label class="field">Date<input name="date" type="date" required value="${esc(d.date)}"></label>
      <label class="field">Time<input name="time" type="time" value="${esc(d.time || usualTime)}"></label>
      ${special ? `<label class="field">Name (e.g. Christmas rehearsal)<input name="label" maxlength="40" value="${esc(d.label || '')}"></label>` : `
      <label class="row" style="gap:8px;margin:8px 0"><input type="checkbox" name="cancelled"${d.cancelled ? ' checked' : ''}> No practice this day</label>`}
      <label class="field">Note for this day only (optional)<input name="note" maxlength="140" placeholder="${esc(sc.usual.note)}" value="${esc(d.note && d.note !== sc.usual.note ? d.note : '')}"></label>
      <div class="row"><button class="btn primary">Save</button>${special && exists ? '<button type="button" class="btn danger" id="rm">Remove this practice</button>' : ''}<span id="dmsg" class="muted" aria-live="polite"></span></div>
    </form>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  $('#rm')?.addEventListener('click', () => run(async () => { await call('teacher/schedule/day', { method: 'DELETE', body: { date: d.date } }); dlg.close(); await loadSchedule(); }));
  $('#df').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { date: f.get('date'), time: f.get('time') === usualTime && !special ? '' : f.get('time'), note: f.get('note') };
    if (special) { body.special = true; body.label = f.get('label'); } else body.cancelled = f.get('cancelled') === 'on';
    try { await call('teacher/schedule/day', { method: 'PUT', body }); dlg.close(); await loadSchedule(); }
    catch (err) { $('#dmsg').textContent = `⚠️ ${err.message}`; }
  });
}
