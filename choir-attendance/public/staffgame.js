// The Notation trainer: learn to read music, one small step at a time, treble clef then bass clef then both.
// Each level starts with a lesson (the new notes on the staff; tap one to hear it on the piano), then a quiz:
// a note appears on the staff and the child sings it. Its own warm-up shows notes, chords and scales on the staff.
// Scores stay on this phone (nothing is sent to the server). Level 1 and 2 are free; the rest are part of the full version.
import { openAudio, micMessage } from './audio.js';
import { createPlayer } from './player.js';
import { mountWarmup } from './warmup.js';
import { spell, staffSvg } from './staff.js';
import { shuffle } from './levels.js';

export const FREE_NOTATION_LEVELS = 2;

const nat = (a, b, clefOffset = 0) => { const out = []; for (let m = a; m <= b; m++) if ([0, 2, 4, 5, 7, 9, 11].includes(((m % 12) + 12) % 12)) out.push(m + clefOffset); return out; };
// Level list. clef: 'treble' | 'bass' | 'grand' (both, by pitch). accidentals: 'none' | 'sharps' | 'flats' | 'mixed'.
export const STAFF_LEVELS = [
  { id: 1, clef: 'treble', name: 'Meet middle C', how: 'C, D and E: the first three notes.', pool: [60, 62, 64], count: 6, tol: 45, tip: 'Middle C sits on a little line of its own just below the staff.' },
  { id: 2, clef: 'treble', name: 'Five notes', how: 'C, D, E, F and G.', pool: [60, 62, 64, 65, 67], count: 7, tol: 45, tip: 'Going up the staff, the notes go up in pitch: C D E F G.' },
  { id: 3, clef: 'treble', name: 'The C octave', how: 'All the white notes from C up to the next C.', pool: nat(60, 72), count: 8, tol: 42, tip: 'Seven letters repeat: A B C D E F G.' },
  { id: 4, clef: 'treble', name: 'The treble lines', how: 'E, G, B, D, F: the five lines.', pool: [64, 67, 71, 74, 77], count: 8, tol: 40, tip: 'Every Good Boy Does Fine: E G B D F.' },
  { id: 5, clef: 'treble', name: 'The treble spaces', how: 'F, A, C, E: the four spaces.', pool: [65, 69, 72, 76], count: 8, tol: 40, tip: 'The spaces spell FACE: F A C E.' },
  { id: 6, clef: 'treble', name: 'On the staff', how: 'Every white note from the bottom line to the top line.', pool: nat(64, 77), count: 9, tol: 38, tip: 'Lines and spaces take turns, one step each.' },
  { id: 7, clef: 'treble', name: 'Below the staff', how: 'Notes under the staff, on little extra "ledger" lines.', pool: [55, 57, 59, 60, 62], count: 8, tol: 36, tip: 'G, A and B go below middle C. Ledger lines continue the staff.' },
  { id: 8, clef: 'treble', name: 'Above the staff', how: 'High notes over the top line.', pool: [76, 77, 79, 81, 83, 84], count: 8, tol: 35, tip: 'Count up from the top line F: every new ledger line adds one step.' },
  { id: 9, clef: 'treble', name: 'Sharps', how: 'A sharp ♯ raises a note by a semitone, the black key just above.', pool: [61, 63, 66, 68, 70, 73, 75, 78], count: 8, tol: 32, acc: 'sharps', tip: '♯ sits in front of the note and raises it one semitone.' },
  { id: 10, clef: 'treble', name: 'Flats', how: 'A flat ♭ lowers a note by a semitone, the black key just below.', pool: [61, 63, 66, 68, 70, 73, 75, 78], count: 8, tol: 32, acc: 'flats', tip: '♭ sits in front of the note and lowers it one semitone.' },
  { id: 11, clef: 'treble', name: 'Treble champion', how: 'Everything in the treble clef, mixed up.', pool: [...nat(55, 84), 61, 63, 66, 68, 70, 73, 75, 78], count: 10, tol: 30, acc: 'mixed', tip: 'Take a breath, find the line or space, then name it.' },
  { id: 12, clef: 'bass', name: 'Meet the bass clef', how: 'The bass clef shows lower notes: C D E F G.', pool: nat(48, 55), count: 7, tol: 42, tip: 'The two dots of the bass clef hug the F line.' },
  { id: 13, clef: 'bass', name: 'The bass lines', how: 'G, B, D, F, A.', pool: [43, 47, 50, 53, 57], count: 8, tol: 40, tip: 'Good Boys Do Fine Always: G B D F A.' },
  { id: 14, clef: 'bass', name: 'The bass spaces', how: 'A, C, E, G.', pool: [45, 48, 52, 55], count: 8, tol: 40, tip: 'All Cows Eat Grass: A C E G.' },
  { id: 15, clef: 'bass', name: 'On the bass staff', how: 'Every white note from the bottom line to the top line.', pool: nat(43, 57), count: 9, tol: 38, tip: 'Bass notes are written lower than they look: practise singing them in your own range.' },
  { id: 16, clef: 'bass', name: 'Beyond the bass staff', how: 'Ledger lines below and above.', pool: [36, 38, 40, 41, 59, 60], count: 8, tol: 35, tip: 'Middle C is a ledger line above the bass staff.' },
  { id: 17, clef: 'bass', name: 'Bass sharps and flats', how: 'Black keys in the bass clef.', pool: [44, 46, 49, 51, 54, 56, 58], count: 8, tol: 32, acc: 'mixed', tip: 'The same ♯ and ♭ rules apply in every clef.' },
  { id: 18, clef: 'bass', name: 'Bass champion', how: 'Everything in the bass clef, mixed up.', pool: [...nat(36, 60), 44, 46, 49, 51, 54, 56, 58], count: 10, tol: 30, acc: 'mixed', tip: 'Look for the F line first, between the two dots.' },
  { id: 19, clef: 'grand', name: 'Both clefs', how: 'Treble and bass together, white notes only.', pool: [...nat(43, 57), ...nat(60, 77)], count: 10, tol: 32, tip: 'Check the clef first, then read the note.' },
  { id: 20, clef: 'grand', name: 'Music reader', how: 'All notes, both clefs, sharps and flats. A real sight-reading test.', pool: [...nat(40, 60), ...nat(60, 84), 44, 46, 49, 51, 61, 63, 66, 68, 70, 73, 75, 78], count: 12, tol: 28, acc: 'mixed', tip: 'Clef, then line or space, then any ♯ or ♭. You can do it!' },
];

const pcOf = (m) => ((m % 12) + 12) % 12;
// Levels of the same kind that come before this one (treble builds on treble, bass on bass, both clefs on everything).
const earlierLevels = (lv) => STAFF_LEVELS.filter((l) => l.id < lv.id && (lv.clef === 'grand' || l.clef === lv.clef));
// The notes this level introduces: in its pool but in none of the earlier levels.
export const newNotesOf = (lv) => { const seen = new Set(earlierLevels(lv).flatMap((l) => l.pool)); return [...new Set(lv.pool)].filter((m) => !seen.has(m)).sort((a, b) => a - b); };
const isBlack = (m) => [1, 3, 6, 8, 10].includes(pcOf(m));

// The challenges of one round: a list the player understands. Silent: the child reads, then sings.
export function staffDeck(levelId, rng = Math.random) {
  const lv = STAFF_LEVELS.find((l) => l.id === levelId);
  if (!lv) throw new Error('unknown staff level');
  // Mostly this level's notes (the new ones come first and most often), with about a third revising earlier levels.
  const before = earlierLevels(lv).flatMap((l) => l.pool);
  const fresh = newNotesOf(lv);
  const reviewN = before.length ? Math.round(lv.count * 0.3) : 0;
  let picks = [];
  while (picks.length < lv.count - reviewN) {
    const pass = shuffle(lv.pool, rng);
    if (picks.length && pass[0] === picks.at(-1)) pass.push(pass.shift()); // never the same note twice in a row
    picks = picks.concat(pass);
  }
  picks = picks.slice(0, lv.count - reviewN);
  const olderPool = [...new Set(before)];
  const fromOlder = shuffle(olderPool.filter((m) => !picks.includes(m)), rng); // revision notes that are not already in this round
  const rev = [...fromOlder, ...shuffle(olderPool.filter((m) => picks.includes(m)), rng)].slice(0, reviewN);
  const tagged = [...picks.map((m) => ({ m, review: false })), ...rev.map((m) => ({ m, review: true }))];
  // order them: something new first, then never the same note twice in a row where it can be avoided
  const pool = shuffle(tagged, rng);
  const order = [];
  const firstK = pool.findIndex((x) => fresh.includes(x.m));
  order.push(...pool.splice(firstK > 0 ? firstK : 0, 1));
  while (pool.length) {
    const counts = new Map();
    for (const x of pool) counts.set(x.m, (counts.get(x.m) ?? 0) + 1);
    let k = -1, best = 0;
    pool.forEach((x, i) => { if (x.m !== order.at(-1).m && counts.get(x.m) > best) { best = counts.get(x.m); k = i; } }); // the note with most left to place keeps the end free of repeats
    if (k < 0) k = 0;
    order.push(...pool.splice(k, 1));
  }
  return order.map(({ m: midi, review }) => {
    const flats = isBlack(midi) && (lv.acc === 'flats' ? true : lv.acc === 'sharps' ? false : rng() < 0.5);
    const clef = lv.clef === 'grand' ? (midi < 60 ? 'bass' : midi > 60 ? 'treble' : rng() < 0.5 ? 'bass' : 'treble') : lv.clef;
    const s = spell(midi, flats, clef);
    return {
      kind: 'staff', level: lv.id, timed: false, blind: false, silent: true, tol: lv.tol, hold: 500, limit: 20,
      title: 'Read the note', how: review ? 'Review · sing this note' : 'Sing this note', review, staff: [midi], staffFlats: flats, clef,
      noteName: s.full, play: { type: 'piano', midi }, targets: [pcOf(midi)],
    };
  });
}

const KEY = 'choir-staff-best';
const readBest = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const writeBest = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);
const clefLabel = (c) => (c === 'treble' ? 'Treble clef' : c === 'bass' ? 'Bass clef' : 'Both clefs');

// access: { full: bool } from the server (omit for the teacher's own copy: everything open).
export function mountStaffGame(host, { access = null } = {}) {
  const root = document.createElement('div'); // its own container, so listeners from an earlier visit never pile up
  host.replaceChildren(root);
  let current = null, audio = null, view = 'home', learnAudio = null, nameHandler = null;
  const dropName = () => { if (nameHandler) { root.removeEventListener('click', nameHandler); nameHandler = null; } };
  const full = () => (access ? Boolean(access.full) : true);
  const locked = (id, best) => (id > FREE_NOTATION_LEVELS && !full()) ? 'pay' : (id > 1 && !best[id - 1]) ? 'order' : '';

  function closeLearnAudio() { learnAudio?.close(); learnAudio = null; dropName(); }

  function home() {
    closeLearnAudio();
    view = 'home';
    const best = readBest();
    const groups = [['treble', 'Treble clef'], ['bass', 'Bass clef'], ['grand', 'Both clefs']];
    root.innerHTML = `
      <div class="card gm-hero">
        <h2 class="gm-title">Notation trainer</h2>
        <div class="muted">Learn to read music. Each level starts with a short lesson, then you read a note on the staff and sing it.</div>
        <div class="wu-staff">${staffSvg([{ midi: 60 }, { midi: 64 }, { midi: 67 }, { midi: 72 }], { mode: 'seq' })}</div>
        <div class="row" style="justify-content:center"><button class="btn primary gm-cta" data-a="warm">🎹 Warm-up</button><button class="btn gm-cta" data-a="chart">📖 All the notes</button></div>
      </div>
      ${groups.map(([clef, title]) => `
        <div class="card">
          <h3 style="margin:0 0 6px">${title}</h3>
          <div class="gm-list">${STAFF_LEVELS.filter((l) => l.clef === clef).map((l) => {
    const why = locked(l.id, best);
    return `<button class="gm-lvcard${why ? ' lock' : ''}${best[l.id] ? ' done' : ''}" data-lvl="${l.id}" ${why === 'order' ? 'aria-disabled="true"' : ''}><span class="gm-n">${l.id}</span>
              <span class="gm-lvt"><b>${l.name}</b><small>${why === 'pay' ? 'Part of the full version' : why === 'order' ? 'Pass the level before this one first' : l.how}</small></span>
              <span class="gm-pips">${why ? '🔒' : best[l.id] ? stars(best[l.id].stars) : '☆☆☆'}</span></button>`;
  }).join('')}</div>
        </div>`).join('')}
      <div class="muted" style="text-align:center">Not sure of a note? Press <b>Hear the note</b> while you sing. It counts as help.</div>`;
  }

  // Every note on the staff, in both clefs, to look at and to hear. Black keys can be shown as sharps or as flats.
  let chartMode = 'natural';
  function chart() {
    closeLearnAudio();
    view = 'chart';
    const range = (a, b) => { const out = []; for (let m = a; m <= b; m++) out.push(m); return out; };
    const sel = (list) => (chartMode === 'natural' ? list.filter((m) => !isBlack(m)) : list);
    const part = (title, sub, midis, clef, flats) => `<div class="card"><h3 style="margin:0">${title}</h3><div class="muted" style="margin-bottom:6px">${sub}</div>
      <div class="wu-staff">${staffSvg(sel(midis).map((m) => ({ midi: m })), { mode: 'seq', flats, clef, labels: true })}</div>
      <div class="wu-meet">${sel(midis).map((m) => `<button class="btn" data-hear="${m}">${spell(m, flats, clef).full}</button>`).join('')}</div></div>`;
    const flats = chartMode === 'flats';
    root.innerHTML = `
      <div class="card"><div class="row between"><h2 style="margin:0">All the notes</h2><button class="btn small" data-a="home">‹ Levels</button></div>
        <div class="muted" style="margin:4px 0 8px">Every note on the staff, low to high. Tap a name to hear it on the piano. Swipe sideways to see more.</div>
        <div class="seg" role="group" aria-label="Which notes">${[['natural', 'White keys'], ['sharps', 'With sharps ♯'], ['flats', 'With flats ♭']].map(([v, t]) => `<button type="button" data-chart="${v}" class="${chartMode === v ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="gm-note" style="margin-top:8px">💡 Treble lines: E G B D F (Every Good Boy Does Fine). Spaces: F A C E. Bass lines: G B D F A (Good Boys Do Fine Always). Spaces: A C E G (All Cows Eat Grass). Middle C sits between the two staves.</div></div>
      ${part('Treble clef', 'From the G below middle C, up to the C two octaves above it.', range(55, 84), 'treble', flats)}
      ${part('Bass clef', 'From the C two octaves below middle C, up to middle C.', range(36, 60), 'bass', flats)}`;
  }

  // The lesson before a level.
  function learn(id) {
    const lv = STAFF_LEVELS.find((l) => l.id === id);
    view = 'learn';
    const notes = [...new Set(lv.pool)].sort((a, b) => a - b);
    const treble = notes.filter((m) => lv.clef === 'treble' || (lv.clef === 'grand' && m >= 60));
    const bass = notes.filter((m) => lv.clef === 'bass' || (lv.clef === 'grand' && m < 60));
    const flats = lv.acc === 'flats';
    const fresh = new Set(newNotesOf(lv));
    const show = (list, clef) => (list.length ? `<div class="wu-staff">${staffSvg(list.map((m) => ({ midi: m })), { mode: 'seq', flats, clef, labels: true, marks: new Set(list.map((m, i) => (fresh.has(m) ? i : -1)).filter((i) => i >= 0)) })}</div>
      <div class="wu-meet">${list.map((m) => `<button class="btn" data-hear="${m}" data-clef="${clef}">${spell(m, flats, clef).full}</button>`).join('')}</div>` : '');
    root.innerHTML = `
      <div class="card">
        <div class="row between"><div><div class="muted">${clefLabel(lv.clef)} · Level ${lv.id}</div><h2 style="margin:0">${lv.name}</h2></div><button class="btn small" data-a="home">‹ Levels</button></div>
        <p style="margin:8px 0"><b>${lv.how}</b></p>
        ${fresh.size && fresh.size < new Set(lv.pool).size ? `<div class="muted"><b>New in this level:</b> ${[...fresh].map((m) => spell(m, lv.acc === 'flats', lv.clef === 'bass' ? 'bass' : 'treble').name).join(', ')} (shown in colour). The rest is revision from earlier levels.</div>` : ''}
        ${show(treble, 'treble')}${show(bass, 'bass')}
        <div class="gm-note" style="margin-top:8px">💡 ${lv.tip}</div>
        <div class="muted" style="margin-top:6px">Tap a note name to hear it on the piano.</div>
        <div class="row" style="margin-top:10px"><button class="btn primary" data-lvl-start="${lv.id}">🎤 Sing the notes</button><button class="btn primary" data-name-start="${lv.id}">🔤 Name the notes</button></div>
        <div class="muted" style="margin-top:6px">Two ways to practise the same level: sing each note, or tap its letter name. About a third of each quiz revises earlier levels. <button class="btn small" data-a="chart">📖 See all the notes</button></div>
      </div>`;
  }

  async function play(levelId) {
    closeLearnAudio();
    try { audio = await openAudio(); } catch (e) { root.insertAdjacentHTML('afterbegin', `<div class="alert bad">${micMessage(e)}</div>`); return; }
    const lv = STAFF_LEVELS.find((l) => l.id === levelId);
    view = 'play';
    current = createPlayer(root, {
      audio, deck: staffDeck(levelId), heading: `Level ${lv.id}: ${lv.name}`,
      onExit: () => { current = null; audio?.close(); audio = null; home(); },
      onDone: (results) => { current?.destroy(); current = null; audio?.close(); audio = null; finish(levelId, results); },
    });
  }

  function finish(levelId, results, named = false) {
    view = 'result';
    const won = results.filter((r) => r.won).length;
    const share = results.length ? won / results.length : 0;
    const helped = results.filter((r) => r.hints > 0).length;
    const n = share >= 0.9 && helped <= 1 ? 3 : share >= 0.7 ? 2 : won ? 1 : 0;
    const passed = share >= 0.7;
    const best = readBest();
    const was = best[levelId]?.stars ?? 0;
    if (passed && n > was) { best[levelId] = { stars: n, on: new Date().toISOString().slice(0, 10) }; writeBest(best); }
    const next = STAFF_LEVELS.find((l) => l.id === levelId + 1);
    const msg = n === 3 ? 'Brilliant! You read them like a pro.' : n === 2 ? 'Well done! Your reading is getting strong.' : passed ? 'Good work. Keep practising.' : 'Good try. Review the lesson, then go again.';
    root.innerHTML = `
      <div class="card gm-result">
        <div class="gm-praise ${passed ? '' : 'gm-try'}">${msg}</div>
        <div class="gm-big">${passed ? stars(n) : ''}</div>
        <div><b>${won} of ${results.length}</b> notes ${named ? 'named' : 'read and sung'}${helped ? ` · ${helped} with help` : ''}</div>
        <div class="row" style="justify-content:center">
          ${passed && next && !locked(next.id, readBest()) ? `<button class="btn primary" data-learn="${next.id}">Next: ${next.name}</button>` : ''}
          <button class="btn${passed && next ? '' : ' primary'}" ${named ? `data-name-start="${levelId}"` : `data-lvl="${levelId}"`}>🔁 ${passed ? 'Play again' : 'Try again'}</button>
          ${!passed ? '<button class="btn" data-a="warm">🎹 Staff warm-up</button>' : ''}
          <button class="btn" data-a="home">Levels</button></div>
      </div>`;
  }

  // "Name it": the note appears on the staff and you tap its letter (and a sharp or flat if it has one). No microphone.
  function nameQuiz(levelId) {
    closeLearnAudio();
    view = 'name';
    const lv = STAFF_LEVELS.find((l) => l.id === levelId);
    const deck = staffDeck(levelId);
    let i = 0, right = 0, acc = '', done = false;
    const results = [];
    const draw = (feedback = '') => {
      const c = deck[i];
      root.innerHTML = `
        <div class="card pl-hud"><div class="row between"><b>Level ${lv.id}: ${lv.name} · name the note</b><button class="btn small" data-a="home">✕ Leave</button></div>
          <div class="pl-dots">${deck.map((_, k) => `<i class="${k < results.length ? (results[k] ? 'done' : 'miss') : k === i ? 'now' : ''}"></i>`).join('')}</div>
          <div class="pl-stats"><span>Note ${i + 1} of ${deck.length}</span><span>${right} right</span></div></div>
        <div class="card" style="text-align:center">
          <div class="wu-staff">${staffSvg([{ midi: c.staff[0] }], { mode: 'chord', flats: c.staffFlats, labels: false, clef: c.clef })}</div>
          <div class="muted" style="margin:6px 0">${clefLabel(c.clef)}. Which note is it?</div>
          ${lv.acc ? `<div class="seg" role="group" aria-label="Sharp, flat or natural">${[['', '♮ natural'], ['♯', '♯ sharp'], ['♭', '♭ flat']].map(([v, t]) => `<button type="button" data-acc="${v}" class="${acc === v ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}
          <div class="letters">${['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((L) => `<button class="btn letter" data-letter="${L}" ${feedback ? 'disabled' : ''}>${L}</button>`).join('')}</div>
          <div class="pl-msg ${feedback.startsWith('✓') ? 'ok' : feedback ? 'bad' : ''}" style="height:auto;min-height:2.4em;margin-top:8px">${feedback}</div>
          ${feedback ? `<div class="row" style="justify-content:center"><button class="btn" data-hear-q="${c.staff[0]}">🔊 Hear it</button><button class="btn primary" data-next-q>${i + 1 >= deck.length ? 'See my result' : 'Next ▶'}</button></div>` : ''}
        </div>`;
    };
    draw();
    const onClick = async (e) => {
      if (view !== 'name') return;
      const a = e.target.closest('[data-acc]');
      if (a) { acc = a.dataset.acc; return draw(); }
      const L = e.target.closest('[data-letter]');
      if (L && !done) {
        const c = deck[i];
        const want = spell(c.staff[0], c.staffFlats, c.clef);
        const ok = L.dataset.letter === want.letter && (lv.acc ? acc : '') === want.acc;
        results.push(ok); if (ok) right += 1;
        draw(ok ? `✓ Yes, ${want.name}!` : `That note is ${want.name} (${want.full}).`);
        return;
      }
      if (e.target.closest('[data-hear-q]')) { try { learnAudio ||= await openAudio(); await learnAudio.ensure(); learnAudio.stop(); learnAudio.sound.pianoNote(Number(e.target.closest('[data-hear-q]').dataset.hearQ), 2.2); } catch { /* no sound */ } return; }
      if (e.target.closest('[data-next-q]')) {
        i += 1; acc = '';
        if (i >= deck.length) { dropName(); finish(levelId, results.map((w) => ({ won: w, hints: 0 })), true); return; }
        draw();
      }
    };
    nameHandler = onClick;
    root.addEventListener('click', onClick);
  }

  function warm() {
    closeLearnAudio();
    view = 'warm';
    current = mountWarmup(root, { staff: true, onExit: () => { current?.destroy?.(); current = null; home(); } });
  }

  root.addEventListener('click', async (e) => {
    const start = e.target.closest('[data-lvl-start]');
    if (start) return play(Number(start.dataset.lvlStart));
    const ln = e.target.closest('[data-learn]');
    if (ln) return learn(Number(ln.dataset.learn));
    const ns = e.target.closest('[data-name-start]');
    if (ns) return nameQuiz(Number(ns.dataset.nameStart));
    const cm = e.target.closest('[data-chart]');
    if (cm && view === 'chart') { chartMode = cm.dataset.chart; return chart(); }
    const hear = e.target.closest('[data-hear]');
    if (hear && (view === 'learn' || view === 'chart')) {
      try { learnAudio ||= await openAudio(); await learnAudio.ensure(); learnAudio.stop(); learnAudio.sound.pianoNote(Number(hear.dataset.hear), 2.2); } catch { /* no sound available */ }
      return;
    }
    const lv = e.target.closest('[data-lvl]');
    if (lv && (view === 'home' || view === 'result')) {
      const id = Number(lv.dataset.lvl);
      const why = locked(id, readBest());
      if (why === 'order') return;
      if (why === 'pay') { root.insertAdjacentHTML('afterbegin', '<div class="alert warn" data-pay>This level is part of the full version. The free trial gives every level for a few days, and the full version unlocks every training game.</div>'); setTimeout(() => root.querySelector('[data-pay]')?.remove(), 5000); return; }
      return view === 'result' ? play(id) : learn(id);
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'warm') return warm();
    if (a === 'chart') return chart();
    if (a === 'home') return home();
  });
  home();
  return {
    destroy() { current?.destroy?.(); audio?.close(); closeLearnAudio(); },
    back() { // the phone's Back button
      if (view === 'play') { current?.destroy?.(); current = null; audio?.close(); audio = null; home(); return true; }
      if (view !== 'home') { current?.destroy?.(); current = null; home(); return true; }
      return false;
    },
  };
}
