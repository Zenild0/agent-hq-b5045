import {
  $, api, esc, fmtPts, fmtDate, typeLabel, headerHtml, footerHtml, avatarHtml, leaveBadge,
  renderBoard, statsHtml, historyHtml, leaveAlertHtml,
} from './common.js';

let pin = '';
try { pin = sessionStorage.getItem('choir-pin') || ''; } catch { /* private mode */ }
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
  ${headerHtml('Teacher', '<a href="/">Parent view</a>')}
  <main>
    <nav class="tabs">
      <button data-tab="attendance" class="on">✅ Attendance</button>
      <button data-tab="occasions">🎄 Occasions</button>
      <button data-tab="children">👧 Children</button>
      <button data-tab="board">🏆 Leaderboard</button>
      <button data-tab="settings">⚙️ Settings</button>
    </nav>
    <div id="msg" aria-live="polite"></div>
    <section id="attendance"></section>
    <section id="occasions" hidden></section>
    <section id="children" hidden></section>
    <section id="board" hidden></section>
    <section id="settings" hidden></section>
  </main>
  ${footerHtml()}`;

const flash = (text, kind = 'bad') => {
  $('#msg').innerHTML = text ? `<div class="alert ${kind}">${esc(text)}</div>` : '';
};
async function run(fn) {
  try { flash(''); return await fn(); } catch (e) {
    if (e.status === 401) return askPin();
    flash(e.message);
  }
}
function askPin() {
  const p = prompt('Teacher PIN');
  if (p === null) return flash('PIN required to use the teacher page.');
  pin = p;
  try { sessionStorage.setItem('choir-pin', p); } catch { /* private mode */ }
  location.reload();
}

const tabs = ['attendance', 'occasions', 'children', 'board', 'settings'];
const loaders = { attendance: loadAttendance, occasions: loadOccasions, children: loadChildren, board: loadBoard, settings: loadSettings };
function showTab(name) {
  tabs.forEach((t) => { $(`#${t}`).hidden = t !== name; });
  app.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
  return run(loaders[name]);
}
app.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ======================= Attendance =======================

let date = todayStr();
let type = '';
let event = '';
let otherMode = false; // "Other…" occasion chosen: teacher types the name
let view;

const isOccasion = (t) => t === 'practice' || t === 'feast';

async function loadAttendance() {
  if (isOccasion(type) && !event && !otherMode) event = 'Christmas';
  if (isOccasion(type) && !event) return renderAttendance(); // waiting for a custom name
  const qs = new URLSearchParams({ date, ...(type ? { type } : {}), ...(isOccasion(type) ? { event } : {}) });
  view = await call(`teacher/session?${qs}`);
  type = view.type;
  renderAttendance();
}

function renderAttendance() {
  const s = view.settings;
  const showOther = isOccasion(type) && (otherMode || !view.events.includes(event));
  const waiting = isOccasion(type) && !event.trim();
  const marked = view.children.filter((c) => c.status).length;
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
        ${isOccasion(type) ? `
          <select id="event" aria-label="Occasion">
            ${view.events.map((e) => `<option${!showOther && e === event ? ' selected' : ''}>${esc(e)}</option>`).join('')}
            <option value="__other"${showOther ? ' selected' : ''}>Other…</option>
          </select>
          ${showOther ? `<input id="eventName" placeholder="Occasion name" maxlength="60" value="${esc(event)}">` : ''}` : ''}
      </div>
    </div>
    ${when ? `<div class="banner">${when}</div>` : ''}
    ${waiting ? '<div class="empty">Type the occasion name above to start.</div>' : `
    <div class="row between"><span class="muted">${marked} of ${view.children.length} marked</span>
      <button class="btn small" id="allPresent">Mark all present</button></div>`}
    ${waiting ? '' : view.children.length ? view.children.map(childRow).join('') : '<div class="empty">Add children in the Children tab first.</div>'}`;
  $('#type').value = type;
  $('#date').addEventListener('change', (e) => {
    if (!e.target.value) return;
    date = e.target.value;
    type = '';
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
    otherMode = e.target.value === '__other';
    event = otherMode ? '' : e.target.value;
    run(loadAttendance);
  });
  $('#eventName')?.addEventListener('change', (e) => { event = e.target.value.trim(); run(loadAttendance); });
  $('#allPresent')?.addEventListener('click', () => run(async () => {
    await call('teacher/mark-all-present', { method: 'POST', body: { date, type, event } });
    await loadAttendance();
  }));
  $('#attendance').querySelectorAll('[data-child]').forEach(wireRow);
}

function childRow(c) {
  const st = (k, label) => `<button class="${k}${c.status === k ? ' on' : ''}" data-set="${k}" aria-pressed="${c.status === k}">${label}</button>`;
  const open = c.remarks.length || c.note ? ' open' : '';
  return `
    <div class="card" data-child="${esc(c.id)}">
      <div class="row between">
        <span class="row">${avatarHtml(c)}<button class="link" data-open="${esc(c.id)}">${esc(c.name)}</button></span>
        ${leaveBadge(c.leaves, view.settings.maxLeaves, c.exceeded)}
      </div>
      ${c.exceeded ? '<div class="muted">Over the leave limit – not continuing this year.</div>' : ''}
      <div class="status">${st('present', 'Present')}${st('absent', 'Absent')}${st('excused', 'Sick / hospital')}</div>
      <details class="remarks"${open}>
        <summary>Behaviour remarks${c.remarks.length ? ` (${c.remarks.length})` : ''}</summary>
        ${view.remarkOptions.map((r) => `<label class="chk"><input type="checkbox" value="${esc(r)}"${c.remarks.includes(r) ? ' checked' : ''}> ${esc(r)}</label>`).join('')}
        <textarea rows="2" maxlength="500" placeholder="Private note (parents can't see this)">${esc(c.note)}</textarea>
      </details>
    </div>`;
}

function wireRow(el) {
  const c = view.children.find((x) => x.id === el.dataset.child);
  const save = () => run(async () => {
    await call('teacher/mark', { method: 'PUT', body: { date, type, event, childId: c.id, status: c.status, remarks: c.remarks, note: c.note } });
    const qs = new URLSearchParams({ date, type, ...(isOccasion(type) ? { event } : {}) });
    view = await call(`teacher/session?${qs}`); // refresh leave tallies
    const next = view.children.find((x) => x.id === c.id);
    const wasOpen = $('details', el).open;
    const tmp = document.createElement('div');
    tmp.innerHTML = childRow(next);
    el.replaceWith(tmp.firstElementChild);
    const fresh = document.querySelector(`[data-child="${CSS.escape(c.id)}"]`);
    $('details', fresh).open = wasOpen;
    wireRow(fresh);
  });
  el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
    c.status = c.status === b.dataset.set ? null : b.dataset.set; // tap again to clear
    save();
  }));
  el.querySelectorAll('input[type=checkbox]').forEach((i) => i.addEventListener('change', () => {
    c.remarks = [...el.querySelectorAll('input[type=checkbox]:checked')].map((x) => x.value);
    save();
  }));
  $('textarea', el).addEventListener('change', (e) => { c.note = e.target.value; save(); });
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
  const sym = (s) => (s === 'present' ? '<span class="sym p">✓</span>' : s === 'absent' ? '<span class="sym a">✗</span>' : s === 'excused' ? '<span class="sym e">S</span>' : '<span class="sym n">–</span>');
  $('#occasions').innerHTML = `
    <div class="card row between">
      <div><h3 style="margin:0">Special occasions</h3><div class="muted">Who attended each practice and mass for feasts. Points add to the leaderboard.</div></div>
      <select id="occSeason" aria-label="Choir year">${o.seasons.map((s) => `<option value="${s}"${s === o.season ? ' selected' : ''}>${s}–${String(s + 1).slice(2)}</option>`).join('')}</select>
    </div>
    ${o.events.length ? o.events.map((ev) => `
      <div class="card">
        <div class="row between"><h3 style="margin:0">${esc(ev.event)}</h3>
          <button class="btn small" data-add="${esc(ev.event)}">＋ Add practice</button></div>
        <div class="matrix-wrap"><table class="matrix">
          <thead><tr><th>Child</th>${ev.sessions.map((s) => `
            <th><button class="link" data-goto="${s.date}|${s.type}|${esc(ev.event)}">${s.date.slice(8)}/${s.date.slice(5, 7)}</button><div class="muted">${s.type === 'feast' ? '🎶 Mass' : 'Practice'}<br>${s.presentCount} here</div></th>`).join('')}
            <th>Attended</th><th>Points</th></tr></thead>
          <tbody>${ev.children.map((c) => `
            <tr><td><button class="link" data-open="${esc(c.id)}">${esc(c.name)}</button></td>
              ${c.cells.map((s) => `<td>${sym(s)}</td>`).join('')}
              <td><b>${c.attended}/${ev.sessions.length}</b></td><td>${fmtPts(c.points)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>`).join('') : `<div class="empty">No special practices recorded yet.<br>In <b>Attendance</b>, choose “Special practice” and pick the occasion.</div>`}
    <div class="card"><b>Quick start:</b> ${['Christmas', 'New Year', 'Maundy Thursday', 'Good Friday', 'Easter', "Mother Mary's Feast", 'Communion Mass', 'Confirmation Mass'].map((e) => `<button class="btn small" data-add="${esc(e)}">${esc(e)}</button>`).join(' ')}</div>`;
  $('#occSeason').addEventListener('change', (e) => { occSeason = Number(e.target.value); run(loadOccasions); });
  $('#occasions').querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    type = 'practice'; event = b.dataset.add; date = todayStr(); otherMode = false;
    showTab('attendance');
  }));
  $('#occasions').querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    [date, type, event] = b.dataset.goto.split('|');
    otherMode = false;
    showTab('attendance');
  }));
}

// ======================= Children =======================

async function loadChildren() {
  const { children } = await call('teacher/children');
  $('#children').innerHTML = `
    <div class="row between"><h3 style="margin:8px 0">${children.filter((c) => c.active).length} children</h3>
      <button class="btn primary" id="addChild">＋ Add child</button></div>
    ${children.map((c) => `
      <div class="card row">
        ${avatarHtml(c)}
        <div class="grow"><button class="link" data-open="${esc(c.id)}">${esc(c.name)}</button>
          <div class="muted">${c.standard ? `Std ${esc(c.standard)}` : 'No standard yet'}${c.joinedYear ? ` · joined ${c.joinedYear}` : ''}</div></div>
        ${c.active ? '' : '<span class="badge">left choir</span>'}
      </div>`).join('') || '<div class="empty">No children yet — tap “Add child”.</div>'}`;
  $('#addChild').addEventListener('click', () => run(() => openChild(null)));
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

async function openChild(id) {
  const blank = { id: null, name: '', standard: '', joinedYear: new Date().getFullYear(), contact: '', address: '', emergencyName: '', emergencyPhone: '', photo: null, active: true };
  const d = id ? await call(`teacher/child/${id}`) : blank;
  let pendingPhoto = null; // chosen before the child exists
  const link = d.code ? `${location.origin}/?c=${d.code}` : '';
  const shown = d.code ? `${d.code.slice(0, 4)}-${d.code.slice(4)}` : '';
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
      <h3 style="margin-top:20px">Parent access</h3>
      <div class="card" style="margin-top:6px">
        <div class="muted">Private code: <b style="font-size:1.1rem;letter-spacing:.08em">${shown}</b></div>
        <div class="linkrow">
          <input readonly value="${esc(link)}" id="linkBox" aria-label="Parent link">
          <button class="btn small" id="copy">Copy link</button>
          <a class="btn small" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`Hi! Here is ${d.name}'s private choir page: ${link}`)}">WhatsApp</a>
        </div>
        <button class="btn small danger" id="newCode" style="margin-top:8px">Make a new code</button>
        <div class="muted">Anyone with this link can see ${esc(d.name)}'s details. Make a new code if it was shared by mistake.</div>
      </div>
      ${leaveAlertHtml(d)}
      <h3 style="margin-top:20px">This year</h3>${statsHtml(d)}
      <h3 style="margin-top:20px">Attendance</h3><div class="card">${historyHtml(d.history)}</div>
      <button class="btn danger" id="toggle">${d.active ? 'Remove from choir' : 'Add back to choir'}</button>` : ''}`;
  dlg.showModal();
  $('#close').addEventListener('click', () => dlg.close());

  const setPhoto = async (file) => {
    if (!file) return;
    try {
      const image = await resizeToJpeg(file);
      if (id) {
        const r = await call(`teacher/children/${id}/photo`, { method: 'POST', body: { image } });
        d.photo = `${r.photo}`;
      } else {
        pendingPhoto = image;
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
        if (pendingPhoto) await call(`teacher/children/${created.id}/photo`, { method: 'POST', body: { image: pendingPhoto } });
      }
      dlg.close();
      refreshVisible();
    } catch (err) { $('#cfMsg').textContent = `⚠️ ${err.message}`; }
  });
  if (!id) return;
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); $('#copy').textContent = 'Copied ✓'; } catch { $('#linkBox').select(); }
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
      <td><button class="link" data-open="${esc(r.id)}">${esc(r.name)}</button>${r.eligible ? '' : ' <span class="badge bad">out this year</span>'}</td>
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
    <h2>Prize race <span class="muted">(private – parents don't see this)</span></h2>
    <div class="card"><b>Prize at ${esc(o.prize.label)}</b>
      <div class="muted">Counting ${esc(o.seasonLabel)} up to ${fmtDate(o.prize.date)}. Children over the leave limit are not eligible.</div>
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
      ${num('latePointsFactor', 'Share of points when late (0 to 1)', s.latePointsFactor, 'step="0.1" max="1"')}
      <label class="chk"><input name="countSundayAbsences" type="checkbox"${s.countSundayAbsences ? ' checked' : ''}> Missing Sunday mass also counts as a leave</label>
      <label class="field">First year (starts April of)<input name="firstSeason" type="number" placeholder="${firstSeason}" value="${s.firstSeason ?? ''}"></label>
      <p class="muted">Your private prize race ends at Easter in the first year and at the end of December every year after. Leave blank to start from your first recorded session. Feast practices and masses never count as leaves.</p>
      <button class="btn primary">Save settings</button>
    </form>`;
  $('#setForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    run(async () => {
      const body = Object.fromEntries(['satPoints', 'sunPoints', 'practicePoints', 'feastPoints', 'maxLeaves', 'latePointsFactor'].map((k) => [k, f.get(k)]));
      body.countSundayAbsences = f.get('countSundayAbsences') === 'on';
      body.firstSeason = f.get('firstSeason') || null;
      await call('teacher/settings', { method: 'PUT', body });
      flash('Settings saved.', 'ok');
    });
  });
}

// ======================= start =======================

run(async () => {
  const meta = await api('meta');
  if (meta.pinRequired && !pin) return askPin();
  await loadAttendance();
});
