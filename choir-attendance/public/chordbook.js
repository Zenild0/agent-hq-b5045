// Chord Book: search the teacher's chord sheets, keep your own songs, build set lists for an occasion and play them.
// The teacher adds sheets to the library. A student's songs and set lists live on this phone (no account, no audio),
// and the sheets of "My songs" are saved here too, so they open at practice even without a signal.
import { api, esc } from './common.js';
import { parseSheet, transposeChord, keyAfter, preferFlats, isChord, chordShape, chordSvg } from './chordpro.js';

const SPEEDS = [0, 10, 18, 28, 42, 60]; // pixels a second; 0 is off
const clampN = (n, a, b) => Math.max(a, Math.min(b, n));
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDay = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

export function mountChordBook(host, { code, access }) {
  const root = document.createElement('div');
  host.replaceChildren(root);
  const KEY = `choir-chordbook-${code}`;
  const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.mine && v.sets) return v; } catch { /* start fresh */ } return { mine: {}, sets: [] }; };
  let data = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ } };
  let lib = null, locked = null, offline = false;
  let view = 'lib', tab = 'lib', q = '', kind = 'all', cat = '', songId = null, setId = null, playAt = 0;
  let adhoc = null; // a library song opened but not kept: { song, semi, capo, size }
  let scroll = { level: 0, raf: 0, last: 0 }, wake = null, showChord = '';
  const mine = () => Object.values(data.mine).sort((a, b) => a.title.localeCompare(b.title));
  const stopScroll = () => { scroll.level = 0; cancelAnimationFrame(scroll.raf); };
  const release = () => { try { wake?.release?.(); } catch { /* ignore */ } wake = null; };
  const keepAwake = async () => { try { wake ||= await navigator.wakeLock?.request('screen'); } catch { /* not supported */ } };
  const scroller = () => root.querySelector('.cb-play-body') || document.scrollingElement;

  function tick(t) {
    if (!scroll.level) return;
    const el = scroller();
    const dt = scroll.last ? (t - scroll.last) / 1000 : 0;
    scroll.last = t;
    scroll.carry = (scroll.carry || 0) + SPEEDS[scroll.level] * dt;
    const whole = Math.floor(scroll.carry);
    if (whole >= 1) { el.scrollTop += whole; scroll.carry -= whole; }
    scroll.raf = requestAnimationFrame(tick);
  }
  function setScroll(level) {
    cancelAnimationFrame(scroll.raf);
    scroll.level = level; scroll.last = 0; scroll.carry = 0;
    if (level) { keepAwake(); scroll.raf = requestAnimationFrame(tick); } else if (view !== 'play') release();
  }

  // ---- loading ----
  async function loadLib() {
    try {
      const r = await api('me/chords', { code });
      offline = false;
      if (r.locked) { locked = r; lib = null; } else {
        locked = null; lib = r;
        try { localStorage.setItem(`${KEY}:lib`, JSON.stringify(r)); } catch { /* storage full */ }
        refreshMine();
      }
    } catch (e) {
      if (e.status) throw e;
      offline = true;
      try { lib = JSON.parse(localStorage.getItem(`${KEY}:lib`) || 'null'); } catch { lib = null; }
    }
  }
  // sheets the teacher has changed since they were saved here are fetched again, quietly
  function refreshMine() {
    for (const s of lib.songs) {
      const m = data.mine[s.id];
      if (m && m.v !== s.v) api(`me/chords/${s.id}`, { code }).then((full) => { Object.assign(m, { title: full.title, key: full.key, kind: full.kind, category: full.category, body: full.body, v: full.v }); save(); if (view === 'mine' || view === 'song' || view === 'set') draw(); }).catch(() => {});
    }
  }
  async function addToMine(id) {
    const s = await api(`me/chords/${id}`, { code });
    data.mine[id] = { id, title: s.title, key: s.key, kind: s.kind, category: s.category, body: s.body, v: s.v, semi: 0, capo: 0, size: 1 };
    save();
    return data.mine[id];
  }
  const removeFromMine = (id) => {
    delete data.mine[id];
    for (const set of data.sets) set.songs = set.songs.filter((x) => x !== id);
    save();
  };

  // ---- drawing a sheet ----
  function sheetHtml(s, semi, capo) {
    const shape = semi - capo;
    const flats = preferFlats(keyAfter(s.key, shape));
    const mv = (c) => (isChord(c) ? transposeChord(c, shape, flats) : c);
    return parseSheet(s.body).map((l) => (l.kind === 'blank' ? '<div class="cp-gap"></div>'
      : l.kind === 'section' ? `<div class="cp-sec">${esc(l.text)}</div>`
        : `<div class="cp-line">${l.segs.map((g) => `<span class="cp-seg">${g.chord ? `<button class="cp-c" data-chord="${esc(mv(g.chord))}">${esc(mv(g.chord))}</button>` : '<span class="cp-c">&nbsp;</span>'}<span class="cp-l">${esc(g.text) || '&nbsp;'}</span></span>`).join('')}</div>`)).join('');
  }
  const chordsOf = (s, semi, capo) => {
    const flats = preferFlats(keyAfter(s.key, semi - capo));
    return [...new Set([...s.body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim()).filter(isChord).map((c) => transposeChord(c, semi - capo, flats)))];
  };
  const diagramHtml = () => {
    if (!showChord) return '';
    const sh = chordShape(showChord);
    return `<div class="cb-diagram">${sh ? chordSvg(sh) : ''}<div><b>${esc(showChord)}</b><div class="muted">${sh ? 'Guitar, standard tuning. × = do not play, ○ = open string.' : 'No fingering picture for this chord yet.'}</div></div><button class="btn small" data-act="hidechord" aria-label="Close">✕</button></div>`;
  };

  const current = () => (data.mine[songId] ?? (adhoc?.song.id === songId ? { ...adhoc.song, semi: adhoc.semi, capo: adhoc.capo, size: adhoc.size } : null));
  const setPref = (k, v) => {
    if (data.mine[songId]) { data.mine[songId][k] = v; save(); } else if (adhoc) adhoc[k] = v;
  };

  const controls = (s) => `
    <div class="cb-ctl">
      <span class="cb-grp"><button class="btn small" data-act="semi" data-d="-1" aria-label="Lower the key">−</button><span class="cb-val">Key ${esc(keyAfter(s.key, s.semi))}</span><button class="btn small" data-act="semi" data-d="1" aria-label="Raise the key">＋</button></span>
      <span class="cb-grp"><button class="btn small" data-act="capo" data-d="-1" aria-label="Capo lower">−</button><span class="cb-val">Capo ${s.capo || 0}</span><button class="btn small" data-act="capo" data-d="1" aria-label="Capo higher">＋</button></span>
      <span class="cb-grp"><button class="btn small" data-act="size" data-d="-0.1" aria-label="Smaller text">A−</button><button class="btn small" data-act="size" data-d="0.1" aria-label="Bigger text">A＋</button></span>
      <button class="btn small${scroll.level ? ' primary' : ''}" data-act="scroll">${scroll.level ? `⏸ Scroll ${scroll.level}` : '▶ Scroll'}</button>
      ${s.semi || s.capo ? '<button class="btn small" data-act="reset">Reset</button>' : ''}
    </div>
    <div class="muted cb-info">${s.semi ? `Sounds in ${esc(keyAfter(s.key, s.semi))}` : `Original key ${esc(s.key)}`}${s.capo ? ` · capo ${s.capo}, play the shapes of ${esc(keyAfter(s.key, s.semi - s.capo))}` : ''}</div>`;

  // ---- screens ----
  const tabs = () => `<div class="cb-tabs" role="tablist">${[['lib', 'Library'], ['mine', `My songs · ${mine().length}`], ['sets', `Set lists · ${data.sets.length}`]].map(([id, l]) => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}" class="${tab === id ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const row = (s, inMine) => `
    <div class="cb-row" data-song="${esc(s.id)}">
      <span class="cb-key">${esc(s.key || '–')}</span>
      <span class="grow"><b>${esc(s.title)}</b><span class="cb-chs">${esc((s.chords || chordsOf(s, 0, 0).slice(0, 8)).join('  '))}</span></span>
      ${inMine === null ? '' : inMine ? '<button class="btn small cb-in" data-act="open" aria-label="Open">✓ Added</button>' : `<button class="btn small primary" data-act="add" data-id="${esc(s.id)}">＋ Add</button>`}
    </div>`;
  const filt = (list) => list.filter((s) => (kind === 'all' || s.kind === kind) && (!cat || s.category === cat) && (!q || `${s.title} ${s.category || ''}`.toLowerCase().includes(q.toLowerCase())));
  const filters = (cats) => `
    <label class="cb-search"><span class="sr">Search</span><input id="cbq" type="search" placeholder="Search a song or hymn…" value="${esc(q)}" autocomplete="off"></label>
    <div class="cb-chips">${[['all', 'All'], ['hymn', 'Hymns'], ['song', 'Songs']].map(([id, l]) => `<button data-kind="${id}" class="${kind === id ? 'on' : ''}">${l}</button>`).join('')}${cats.map((c) => `<button data-cat="${esc(c)}" class="${cat === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>`;

  function paywall() {
    const pay = locked.pay;
    return `<div class="card gm-unlock"><h3 style="margin:0">${locked.trial?.started ? 'Your free trial has ended' : 'Free to try'} · unlock the Chord Book for ₹${esc(pay?.price ?? 500)} a year</h3>
      <div class="muted">${locked.count} song${locked.count === 1 ? '' : 's'} with chords are waiting. The same payment unlocks every training game too.</div>
      ${pay?.mobile || pay?.upi ? `<div class="gm-pay">Pay your choir teacher${pay.mobile ? ` on <b>${esc(pay.mobile)}</b>` : ''}${pay.upi ? ` (UPI: <b>${esc(pay.upi)}</b>)` : ''}. They will unlock it for you.</div>` : '<div class="muted">Ask your choir teacher how to pay.</div>'}</div>
      ${mine().length ? '<div class="muted" style="margin:8px 0">Your saved songs are still on this phone:</div>' : ''}`;
  }

  function screen() {
    if (view === 'lib') {
      if (locked) return `${paywall()}${tabs()}${tab === 'lib' ? '' : ''}`;
      const list = filt(lib?.songs ?? []);
      return `${tabs()}${offline ? '<div class="alert warn">No signal. Showing the last library this phone saw.</div>' : ''}
        ${lib?.trial && !lib.paid && lib.trial.active ? `<div class="muted cb-trial">🎁 Free trial: ${lib.trial.daysLeft} day${lib.trial.daysLeft === 1 ? '' : 's'} left</div>` : ''}
        ${filters(lib?.categories ?? [])}
        <div id="cbList">${list.map((s) => row(s, Boolean(data.mine[s.id]))).join('') || `<div class="empty">${lib?.songs?.length ? 'No song matches.' : 'Your teacher has not added any chords yet.'}</div>`}</div>`;
    }
    if (view === 'mine') {
      const list = filt(mine());
      return `${locked ? paywall() : ''}${tabs()}${filters([...new Set(mine().map((s) => s.category).filter(Boolean))])}
        <div id="cbList">${list.map((s) => row(s, null)).join('') || `<div class="empty">${mine().length ? 'No song matches.' : 'Nothing here yet. Open the Library and tap ＋ Add to keep a song on this phone.'}</div>`}</div>`;
    }
    if (view === 'sets') {
      return `${locked ? paywall() : ''}${tabs()}
        <button class="btn primary" data-act="newset">＋ New set list</button>
        ${data.sets.map((st) => `<button class="cb-set" data-set="${esc(st.id)}"><span class="grow"><b>${esc(st.name)}</b><span class="muted">${st.songs.filter((id) => data.mine[id]).length} song${st.songs.length === 1 ? '' : 's'}${st.date ? ` · ${fmtDay(st.date)}` : ''}</span></span><span>›</span></button>`).join('') || '<div class="empty">Make a set list for an occasion, like Christmas Mass, then add songs from My songs.</div>'}`;
    }
    if (view === 'song') {
      const s = current();
      if (!s) return '<div class="empty">That song is not available.</div>';
      const kept = Boolean(data.mine[s.id]);
      return `<div class="cb-bar"><button class="btn small" data-act="back">‹ Back</button><span class="grow"></span>${kept ? `<select id="addToSet" aria-label="Add to a set list"><option value="">＋ Add to a set list…</option>${data.sets.map((st) => `<option value="${esc(st.id)}">${esc(st.name)}</option>`).join('')}</select>` : '<button class="btn small primary" data-act="keep">＋ Add to my songs</button>'}</div>
        <h2 class="cb-title">${esc(s.title)}</h2>
        ${controls(s)}
        <div class="cb-chordstrip">${chordsOf(s, s.semi, s.capo).map((c) => `<button data-chord="${esc(c)}" class="${showChord === c ? 'on' : ''}">${esc(c)}</button>`).join('')}<span class="muted">tap for fingering</span></div>
        ${diagramHtml()}
        <div class="cb-sheet" style="--cb-size:${s.size || 1}rem">${sheetHtml(s, s.semi || 0, s.capo || 0)}</div>
        ${kept ? '<div style="margin-top:14px"><button class="btn small danger" data-act="drop">Remove from my songs</button></div>' : ''}`;
    }
    if (view === 'set') {
      const st = data.sets.find((x) => x.id === setId);
      if (!st) return '';
      const songs = st.songs.map((id) => data.mine[id]).filter(Boolean);
      const free = mine().filter((s) => !st.songs.includes(s.id));
      return `<div class="cb-bar"><button class="btn small" data-act="back">‹ Set lists</button><span class="grow"></span><button class="btn small" data-act="shareset">Share</button><button class="btn small danger" data-act="delset">Delete</button></div>
        <div class="cb-setname"><input id="setName" maxlength="60" value="${esc(st.name)}" aria-label="Set list name"><input id="setDate" type="date" value="${esc(st.date || '')}" aria-label="Date"></div>
        <button class="btn primary" data-act="play"${songs.length ? '' : ' disabled'}>▶ Play set${songs.length ? ` · ${songs.length} song${songs.length === 1 ? '' : 's'}` : ''}</button>
        ${songs.map((s, i) => `<div class="cb-row"><span class="cb-n">${i + 1}</span><span class="grow"><b>${esc(s.title)}</b></span><span class="cb-key">${esc(keyAfter(s.key, s.semi || 0))}</span>
          <button class="ibtn" data-act="up" data-i="${i}" aria-label="Move up"${i ? '' : ' disabled'}>▲</button><button class="ibtn" data-act="down" data-i="${i}" aria-label="Move down"${i < songs.length - 1 ? '' : ' disabled'}>▼</button><button class="ibtn" data-act="rm" data-i="${i}" aria-label="Remove from the set">✕</button></div>`).join('') || '<div class="empty">No songs yet. Add some below.</div>'}
        ${free.length ? `<select id="addSong" aria-label="Add a song"><option value="">＋ Add a song from My songs…</option>${free.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select>` : '<div class="muted">All of your songs are in this set. Add more from the Library.</div>'}
        <div class="muted" style="margin-top:8px">The key you set for a song is the one used here and when you play the set.</div>`;
    }
    if (view === 'play') {
      const st = data.sets.find((x) => x.id === setId);
      const songs = st ? st.songs.map((id) => data.mine[id]).filter(Boolean) : [];
      const s = songs[playAt];
      if (!s) return '<div class="empty">Nothing to play.</div>';
      return `<div class="cb-play">
        <div class="cb-playbar"><button class="btn small" data-act="exitplay">✕ Close</button><span class="grow cb-playtitle"><b>${esc(s.title)}</b><span class="muted">${playAt + 1} of ${songs.length} · ${esc(keyAfter(s.key, s.semi || 0))}</span></span>
          <button class="btn small" data-act="size" data-d="-0.1" aria-label="Smaller text">A−</button><button class="btn small" data-act="size" data-d="0.1" aria-label="Bigger text">A＋</button>
          <button class="btn small${scroll.level ? ' primary' : ''}" data-act="scroll">${scroll.level ? `⏸ ${scroll.level}` : '▶'}</button></div>
        <div class="cb-play-body"><div class="cb-sheet" style="--cb-size:${s.size || 1}rem">${sheetHtml(s, s.semi || 0, s.capo || 0)}</div></div>
        <div class="cb-playnav"><button class="btn" data-act="prev"${playAt ? '' : ' disabled'}>‹ Previous</button><button class="btn primary" data-act="next"${playAt < songs.length - 1 ? '' : ' disabled'}>Next ›</button></div>
      </div>`;
    }
    return '';
  }

  function draw(keepScroll = true) {
    const y = keepScroll ? window.scrollY : 0;
    const body = root.querySelector('.cb-play-body')?.scrollTop;
    const typing = document.activeElement?.id === 'cbq' ? document.activeElement.selectionStart : null;
    root.innerHTML = `<div class="cb">${screen()}</div>`;
    if (typing !== null) { const el = root.querySelector('#cbq'); el.focus(); el.setSelectionRange(typing, typing); }
    if (keepScroll) { window.scrollTo(0, y); const pb = root.querySelector('.cb-play-body'); if (pb && body) pb.scrollTop = body; }
  }
  const go = (v) => { stopScroll(); view = v; if (v === 'lib' || v === 'mine' || v === 'sets') tab = v; showChord = ''; draw(false); window.scrollTo(0, 0); };

  async function openSong(id) {
    songId = id; adhoc = null;
    if (!data.mine[id]) {
      try { const s = await api(`me/chords/${id}`, { code }); adhoc = { song: s, semi: 0, capo: 0, size: 1 }; } catch (e) { alert(e.status ? e.message : 'No signal. Add songs to My songs to use them without internet.'); return; }
    }
    go('song');
  }

  // ---- events ----
  root.addEventListener('input', (e) => {
    if (e.target.id === 'cbq') { q = e.target.value; const list = view === 'lib' ? filt(lib?.songs ?? []) : filt(mine()); root.querySelector('#cbList').innerHTML = list.map((s) => row(s, view === 'lib' ? Boolean(data.mine[s.id]) : null)).join('') || '<div class="empty">No song matches.</div>'; }
  });
  root.addEventListener('change', (e) => {
    const st = data.sets.find((x) => x.id === setId);
    if (e.target.id === 'addToSet' && e.target.value) { const set = data.sets.find((x) => x.id === e.target.value); if (set && !set.songs.includes(songId)) { set.songs.push(songId); save(); } alert(`Added to ${set.name}`); e.target.value = ''; }
    if (e.target.id === 'addSong' && e.target.value && st) { st.songs.push(e.target.value); save(); draw(); }
    if (e.target.id === 'setName' && st) { st.name = e.target.value.trim() || st.name; save(); }
    if (e.target.id === 'setDate' && st) { st.date = e.target.value; save(); }
  });
  root.addEventListener('click', async (e) => {
    const t = e.target;
    const tabB = t.closest('[data-tab]');
    if (tabB) { q = ''; kind = 'all'; cat = ''; return go(tabB.dataset.tab); }
    const kB = t.closest('[data-kind]'); if (kB) { kind = kB.dataset.kind; return draw(); }
    const cB = t.closest('[data-cat]'); if (cB) { cat = cat === cB.dataset.cat ? '' : cB.dataset.cat; return draw(); }
    const ch = t.closest('[data-chord]'); if (ch) { showChord = showChord === ch.dataset.chord ? '' : ch.dataset.chord; return draw(); }
    const setB = t.closest('[data-set]'); if (setB) { setId = setB.dataset.set; return go('set'); }
    const a = t.closest('[data-act]');
    const rowEl = t.closest('[data-song]');
    if (!a && rowEl) return openSong(rowEl.dataset.song);
    if (!a) return;
    const act = a.dataset.act;
    const st = data.sets.find((x) => x.id === setId);
    const songsOf = () => (st ? st.songs.filter((id) => data.mine[id]) : []);
    const cur = view === 'play' ? data.mine[songsOf()[playAt]] : current();
    if (act === 'add') { e.stopPropagation(); a.disabled = true; try { await addToMine(a.dataset.id); draw(); } catch (err) { a.disabled = false; alert(err.status ? err.message : 'No signal. Try again when you are online.'); } return; }
    if (act === 'open') return openSong(rowEl.dataset.song);
    if (act === 'keep') { try { const s = adhoc.song; data.mine[s.id] = { ...s, semi: adhoc.semi, capo: adhoc.capo, size: adhoc.size }; save(); adhoc = null; draw(); } catch { /* ignore */ } return; }
    if (act === 'drop') { if (confirm(`Remove ${cur.title} from My songs? It also leaves your set lists.`)) { removeFromMine(cur.id); go('mine'); } return; }
    if (act === 'back') return go(view === 'song' ? tab : 'sets');
    if (act === 'hidechord') { showChord = ''; return draw(); }
    if (act === 'semi' && cur) { const v = clampN((cur.semi || 0) + Number(a.dataset.d), -11, 11); if (view === 'song') setPref('semi', v); else { data.mine[cur.id].semi = v; save(); } return draw(); }
    if (act === 'capo' && cur) { const v = clampN((cur.capo || 0) + Number(a.dataset.d), 0, 9); setPref('capo', v); return draw(); }
    if (act === 'size' && cur) { const v = clampN(Math.round(((cur.size || 1) + Number(a.dataset.d)) * 10) / 10, 0.7, 2.2); if (view === 'song') setPref('size', v); else { data.mine[cur.id].size = v; save(); } return draw(); }
    if (act === 'reset' && cur) { setPref('semi', 0); setPref('capo', 0); return draw(); }
    if (act === 'scroll') { setScroll((scroll.level + 1) % SPEEDS.length); return draw(); }
    if (act === 'newset') { const name = prompt('Name of the set list (for example Christmas Mass)'); if (name?.trim()) { const ns = { id: uid(), name: name.trim().slice(0, 60), date: '', songs: [] }; data.sets.push(ns); save(); setId = ns.id; go('set'); } return; }
    if (act === 'delset' && st) { if (confirm(`Delete the set list ${st.name}? Your songs stay in My songs.`)) { data.sets = data.sets.filter((x) => x !== st); save(); go('sets'); } return; }
    if (act === 'up' || act === 'down') { const i = Number(a.dataset.i), ids = songsOf(), j = act === 'up' ? i - 1 : i + 1; if (ids[j]) { [ids[i], ids[j]] = [ids[j], ids[i]]; st.songs = ids; save(); draw(); } return; }
    if (act === 'rm') { const ids = songsOf(); ids.splice(Number(a.dataset.i), 1); st.songs = ids; save(); return draw(); }
    if (act === 'shareset' && st) {
      const body = `${st.name}${st.date ? ` (${fmtDay(st.date)})` : ''}\n${songsOf().map((id, i) => `${i + 1}. ${data.mine[id].title} (${keyAfter(data.mine[id].key, data.mine[id].semi || 0)})`).join('\n')}`;
      try { if (navigator.share) await navigator.share({ title: st.name, text: body }); else { await navigator.clipboard.writeText(body); alert('Copied. Paste it into a message.'); } } catch { /* cancelled */ }
      return;
    }
    if (act === 'play') { playAt = 0; view = 'play'; keepAwake(); document.body.classList.add('cb-playing'); return draw(false); }
    if (act === 'exitplay') { stopScroll(); release(); document.body.classList.remove('cb-playing'); return go('set'); }
    if (act === 'prev' || act === 'next') { stopScroll(); playAt = clampN(playAt + (act === 'next' ? 1 : -1), 0, songsOf().length - 1); return draw(false); }
  });
  // swipe between songs in Play mode
  let sx = null;
  root.addEventListener('touchstart', (e) => { if (view === 'play') sx = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (view !== 'play' || sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 90) root.querySelector(`[data-act="${dx < 0 ? 'next' : 'prev'}"]`)?.click();
  }, { passive: true });
  const stopOnTouch = () => { if (scroll.level) { setScroll(0); draw(); } };
  root.addEventListener('wheel', stopOnTouch, { passive: true });

  (async () => {
    root.innerHTML = '<div class="empty">Loading…</div>';
    try { await loadLib(); draw(false); } catch (e) { root.innerHTML = `<div class="card"><div class="alert bad">${esc(e.message)}</div></div>`; }
  })();

  return {
    destroy() { stopScroll(); release(); document.body.classList.remove('cb-playing'); },
    // the phone's Back button: leave the song or set, then go back to the list
    back() {
      if (view === 'play') { stopScroll(); release(); document.body.classList.remove('cb-playing'); go('set'); return true; }
      if (view === 'song') { go(tab); return true; }
      if (view === 'set') { go('sets'); return true; }
      return false;
    },
  };
}
