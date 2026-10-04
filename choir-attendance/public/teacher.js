import { pickPhotos } from './photo.js';
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
    <nav class="tabs">
      <button data-tab="attendance" class="on">✅ Attendance</button>
      <button data-tab="schedule">📅 Schedule</button>
      <button data-tab="occasions">🎄 Occasions</button>
      <button data-tab="children">👧 Children</button>
      <button data-tab="hymns">🎵 Hymns</button>
      <button data-tab="vocals">🎤 Vocals</button>
      <button data-tab="board">🏆 Leaderboard</button>
      <button data-tab="settings">⚙️ Settings</button>
    </nav>
    <div id="msg" aria-live="polite"></div>
    <section id="attendance"></section>
    <section id="schedule" hidden></section>
    <section id="occasions" hidden></section>
    <section id="children" hidden></section>
    <section id="hymns" hidden></section>
    <section id="vocals" hidden></section>
    <section id="board" hidden></section>
    <section id="settings" hidden></section>
  </main>
  ${footerHtml()}`;

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

const tabs = ['attendance', 'schedule', 'occasions', 'children', 'hymns', 'vocals', 'board', 'settings'];
const loaders = { attendance: loadAttendance, schedule: loadSchedule, occasions: loadOccasions, children: loadChildren, hymns: loadHymns, vocals: loadVocals, board: loadBoard, settings: loadSettings };
// The teacher's own copy of Vocals: every level and the paid features are open, and progress stays on this device.
let vocals = null;
function loadVocals() {
  vocals?.destroy?.(); vocals = null;
  const box = $('#vocals');
  box.innerHTML = '<div class="empty">Loading…</div>';
  return import('./game.js').then((m) => { vocals = m.mountGame(box, { preview: true, teacher: true }); }).catch(() => { box.innerHTML = '<div class="alert bad">Vocals could not load. Please try again.</div>'; });
}

function showTab(name) {
  if (name !== 'vocals' && vocals) { vocals.destroy?.(); vocals = null; $('#vocals').innerHTML = ''; } // stops the microphone
  tabs.forEach((t) => { $(`#${t}`).hidden = t !== name; });
  app.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
  return run(loaders[name]);
}
app.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

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
  const num = (name, label, val, extra = '') => `<label class="field">${label}<input name="${name}" type="number" step="0.5" min="0" value="${val}" ${extra}></label>`;
  $('#settings').innerHTML = `
    <form class="card" id="setForm">
      ${num('satPoints', 'Saturday practice points', s.satPoints)}
      ${num('sunPoints', 'Sunday mass points', s.sunPoints)}
      ${num('practicePoints', 'Points per feast practice (Christmas, Easter…)', s.practicePoints)}
      ${num('feastPoints', 'Points for the feast mass itself', s.feastPoints)}
      ${num('maxLeaves', 'Leaves allowed per year (April–April)', s.maxLeaves, 'step="1"')}
      ${num('remarkPenalty', 'Points taken off a session with any negative remark (charged once, however many)', s.remarkPenalty)}
      ${num('remarkBonus', 'Points added for each positive remark (well behaved, helped others)', s.remarkBonus)}
      ${num('latePointsFactor', 'Share of points when late (1 = full points; the remark penalty applies on top)', s.latePointsFactor, 'step="0.1" max="1"')}
      <div class="muted" style="margin-top:10px"><b>Full Vocals game: how parents pay.</b> Warm-up and Level 1 are free. Parents pay you directly, then you unlock their child for a year (Children → the child → Vocals game). After 365 days they need to pay again.</div>
      <label class="field">Price for one year (₹)<input name="gamePrice" type="number" min="0" step="1" value="${s.gamePrice ?? 500}"></label>
      <label class="field">Mobile number to pay (UPI or phone)<input name="gamePayMobile" type="tel" maxlength="20" value="${esc(s.gamePayMobile ?? '')}"></label>
      <label class="field">UPI ID (optional, like name@bank)<input name="gameUpi" maxlength="60" value="${esc(s.gameUpi ?? '')}"></label>
      <div class="muted"><a href="/voice-test.html" target="_blank" rel="noopener">🎤 Open the test version of Vocals</a> (every level open, nothing saved on the server, parents never see it)</div>
      <label class="chk"><input name="gameEnabled" type="checkbox"${s.gameEnabled ? ' checked' : ''}> 🎤 Vocals game is on for parents</label>
      <label class="chk"><input name="countSundayAbsences" type="checkbox"${s.countSundayAbsences ? ' checked' : ''}> Missing Sunday mass also counts as a leave</label>
      <label class="field">Website address to share with parents<input name="publicUrl" type="url" placeholder="https://your-choir-app.example.com" value="${esc(s.publicUrl || '')}"></label>
      <label class="field">First year (starts April of)<input name="firstSeason" type="number" placeholder="${firstSeason}" value="${s.firstSeason ?? ''}"></label>
      <p class="muted">Your private prize race ends at Easter in the first year and at the end of December every year after. Leave blank to start from your first recorded session. Feast practices, feast masses and medical absences never count as leaves. Going over the leave limit never removes a child by itself; you decide.</p>
      <button class="btn primary">Save settings</button>
    </form>`;
  $('#settings').insertAdjacentHTML('beforeend', `
    <div class="card" id="backupBox">
      <h3>Backup &amp; restore</h3>
      <div class="muted">One file with all children, attendance, occasions, hymns, photos and recordings. Download one regularly and keep it safe (for example in your D drive or Google Drive). Use <b>Restore</b> to move everything onto a new computer or the online server. Restoring replaces what is there now.</div>
      <div class="row" style="margin-top:10px"><button class="btn primary" id="dlBackup">⬇ Download backup</button>
        <label class="btn" style="display:inline-block">⬆ Restore from backup<input type="file" accept=".tar,application/x-tar" id="rsBackup" hidden></label>
        <span id="bkMsg" class="muted" aria-live="polite"></span></div>
      ${pin ? '<div class="row" style="margin-top:12px"><button class="btn small" id="forgetPin">Forget my PIN on this device</button></div>' : ''}
    </div>`);
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
  $('#setForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    run(async () => {
      const body = Object.fromEntries(['satPoints', 'sunPoints', 'practicePoints', 'feastPoints', 'maxLeaves', 'latePointsFactor', 'remarkPenalty', 'remarkBonus'].map((k) => [k, f.get(k)]));
      body.countSundayAbsences = f.get('countSundayAbsences') === 'on';
      body.gameEnabled = f.get('gameEnabled') === 'on';
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
  const term = ($('#hq')?.value || '').trim().toLowerCase();
  $('#hymns').innerHTML = `
    <div class="card">
      <div class="row between"><div><h3 style="margin:0">Hymn library</h3><div class="muted">Hymns taught that are not in the book. Parents browse them by category.</div></div>
        <div class="row"><button class="btn primary" id="addHymn">＋ Add hymn</button><button class="btn" id="addHymns">＋ Add many</button></div></div>
      <div class="row" role="group" aria-label="Order of hymns" style="margin-top:8px"><button class="btn small${az ? '' : ' primary'}" data-sort="cat">By category</button><button class="btn small${az ? ' primary' : ''}" data-sort="az">A–Z</button></div>
      <label class="field"><span class="sr">Search</span><input id="hq" type="search" placeholder="Search hymns…" value="${esc(term)}"></label>
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

function openHymn(id) {
  const h = id ? hymnState.hymns.find((x) => x.id === id) : { title: '', category: hymnState.categories[0].id, link: '', notes: '', audio: null };
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">${id ? 'Edit hymn' : 'Add hymn'}</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <form id="hf">
      <label class="field">Hymn title<input name="title" required maxlength="120" value="${esc(h.title)}"></label>
      <label class="field">Category<select name="category">${catOptions(h.category)}</select></label>
      <label class="field">Link to the music (optional)<input name="link" type="url" placeholder="https://…" maxlength="500" value="${esc(h.link)}"></label>
      <label class="field">Notes (optional)<input name="notes" maxlength="300" placeholder="e.g. Key of D, verses 1 and 3" value="${esc(h.notes)}"></label>
      <label class="field">Lyrics (optional, shown large and full screen for the children)<textarea name="lyrics" rows="8" maxlength="6000" placeholder="Paste the words here">${esc(h.lyrics || '')}</textarea></label>
      <div class="row"><button class="btn primary">${id ? 'Save' : 'Add hymn'}</button><span id="hmsg" class="muted" aria-live="polite"></span></div>
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

run(async () => {
  const meta = await api('meta');
  if (!meta.teacherAllowed) return lockOut('The teacher area only opens on the computer where the app is running.');
  if (meta.pinRequired && !pin) return askPin();
  await loadAttendance();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ======================= Schedule =======================

const fmtClock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
};

async function loadSchedule() {
  const sc = await call('teacher/schedule');
  const usual = sc.usual;
  // Only the exceptions are listed: cancelled, a different time, a note of their own, or a special day.
  const exceptions = sc.days.filter((d) => d.date >= sc.today && (d.cancelled || d.special || d.time !== usual.time || d.label || (d.note && d.note !== usual.note)));
  $('#schedule').innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Schedule</h2>
      <div class="row between" style="background:#f1edff;border-radius:12px;padding:10px 12px">
        <div><b>Usual practice</b><div class="muted">Every Saturday, ${esc(fmtClock(usual.time))}</div></div>
        <button class="btn small" id="editUsual">Edit</button></div>
      <div class="muted" style="margin:8px 0">Saturdays are added automatically. You only change the exceptions.</div>
      <label class="field">Note shown on every practice<input id="usualNote" maxlength="140" value="${esc(usual.note)}"></label>
      <h3>Exceptions</h3>
      ${exceptions.map((d) => `
        <div class="row between" style="border-top:1px solid var(--line);padding:8px 0${d.cancelled ? ';opacity:.75' : ''}">
          <span><b>${esc(fmtDate(d.date))}</b> · ${d.cancelled ? 'cancelled' : esc(fmtClock(d.time))}${d.label ? ` · ${esc(d.label)}` : ''}${d.note && d.note !== usual.note ? `<div class="muted">${esc(d.note)}</div>` : ''}</span>
          <button class="btn small" data-day="${esc(d.date)}">${d.cancelled ? 'Restore' : 'Change'}</button></div>`).join('') || '<div class="muted">No exceptions. Every Saturday is on as usual.</div>'}
      <div class="row" style="margin-top:12px">
        <button class="btn" id="chgDay">Cancel or change a day</button>
        <button class="btn primary" id="addSpecial">Add a special day</button></div>
    </div>`;
  $('#editUsual').addEventListener('click', () => openUsual(usual));
  $('#usualNote').addEventListener('change', (e) => run(async () => { await call('teacher/schedule', { method: 'PUT', body: { note: e.target.value } }); flash('Saved', 'ok'); }));
  $('#chgDay').addEventListener('click', () => openDay(sc, { date: sc.next?.date || sc.today }, 'change'));
  $('#addSpecial').addEventListener('click', () => openDay(sc, { date: sc.today }, 'special'));
  $('#schedule').querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
    const d = sc.days.find((x) => x.date === b.dataset.day);
    if (d.cancelled) return run(async () => { await call('teacher/schedule/day', { method: 'PUT', body: { date: d.date, cancelled: false } }); await loadSchedule(); });
    openDay(sc, d, d.special ? 'special' : 'change');
  }));
}

function openUsual(usual) {
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">Usual practice time</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <form id="uf"><label class="field">Every Saturday at<input name="time" type="time" required value="${esc(usual.time)}"></label>
      <div class="row"><button class="btn primary">Save</button><span id="umsg" class="muted" aria-live="polite"></span></div></form>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  $('#uf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await call('teacher/schedule', { method: 'PUT', body: { time: new FormData(e.target).get('time') } }); dlg.close(); await loadSchedule(); }
    catch (err) { $('#umsg').textContent = `⚠️ ${err.message}`; }
  });
}

function openDay(sc, d, mode) {
  const special = mode === 'special';
  const exists = sc.days.some((x) => x.date === d.date);
  $('#dlgBody').innerHTML = `
    <div class="row between"><h2 style="margin:0">${special ? 'Special day' : 'Change a day'}</h2><button class="btn small" id="close" aria-label="Close">✕</button></div>
    <form id="df">
      <label class="field">Date<input name="date" type="date" required value="${esc(d.date)}"></label>
      <label class="field">Time<input name="time" type="time" value="${esc(d.time || sc.usual.time)}"></label>
      ${special ? `<label class="field">Name (e.g. Christmas)<input name="label" maxlength="40" value="${esc(d.label || '')}"></label>` : `
      <label class="row" style="gap:8px;margin:8px 0"><input type="checkbox" name="cancelled"${d.cancelled ? ' checked' : ''}> No practice this day</label>`}
      <label class="field">Note for this day only (optional)<input name="note" maxlength="140" placeholder="${esc(sc.usual.note)}" value="${esc(d.note && d.note !== sc.usual.note ? d.note : '')}"></label>
      <div class="row"><button class="btn primary">Save</button>${special && exists ? '<button type="button" class="btn danger" id="rm">Remove this day</button>' : ''}<span id="dmsg" class="muted" aria-live="polite"></span></div>
    </form>`;
  if (!dlg.open) dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());
  $('#rm')?.addEventListener('click', () => run(async () => { await call('teacher/schedule/day', { method: 'DELETE', body: { date: d.date } }); dlg.close(); await loadSchedule(); }));
  $('#df').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { date: f.get('date'), time: f.get('time') === sc.usual.time && !special ? '' : f.get('time'), note: f.get('note') };
    if (special) { body.special = true; body.label = f.get('label'); } else body.cancelled = f.get('cancelled') === 'on';
    try { await call('teacher/schedule/day', { method: 'PUT', body }); dlg.close(); await loadSchedule(); }
    catch (err) { $('#dmsg').textContent = `⚠️ ${err.message}`; }
  });
}
