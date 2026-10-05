// The second game: Read the staff. A note is shown on the staff; the child works out what it is and sings it.
// Its own warm-up shows every note, chord and scale on the staff while the grand piano plays it.
// Scores stay on this phone (nothing is sent to the server); it is free for everyone.
import { openAudio, micMessage } from './audio.js';
import { createPlayer } from './player.js';
import { mountWarmup } from './warmup.js';
import { spell, staffSvg } from './staff.js';
import { shuffle } from './levels.js';

export const STAFF_LEVELS = [
  { id: 1, name: 'Lines and spaces', how: 'The white notes from middle C up to the next C.', pool: [60, 62, 64, 65, 67, 69, 71, 72], count: 7, tol: 45 },
  { id: 2, name: 'Going higher', how: 'White notes, two octaves from middle C. The top ones sit above the staff.', pool: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84], count: 8, tol: 40 },
  { id: 3, name: 'Below and above', how: 'Notes under the staff and over it, on little extra lines.', pool: [55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81], count: 8, tol: 35 },
  { id: 4, name: 'Sharps and flats', how: 'Every note from C to C, including the black keys.', pool: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72], count: 8, tol: 30 },
];

// The challenges of one round: a list the player understands. Silent: the child reads, then sings.
export function staffDeck(levelId, rng = Math.random) {
  const lv = STAFF_LEVELS.find((l) => l.id === levelId);
  if (!lv) throw new Error('unknown staff level');
  const picks = shuffle(lv.pool, rng).slice(0, lv.count);
  return picks.map((midi) => {
    const flats = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12) && rng() < 0.5;
    const s = spell(midi, flats);
    return {
      kind: 'staff', level: lv.id, timed: false, blind: false, silent: true, tol: lv.tol, hold: 500, limit: 20,
      title: 'Read the note', how: 'Sing this note', staff: [midi], staffFlats: flats,
      noteName: s.full, play: { type: 'piano', midi }, targets: [((midi % 12) + 12) % 12],
    };
  });
}

const KEY = 'choir-staff-best';
const readBest = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const writeBest = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const stars = (n) => '⭐'.repeat(n) + '☆'.repeat(3 - n);

export function mountStaffGame(root) {
  let current = null, audio = null, view = 'home', last = null;

  function home() {
    view = 'home';
    const best = readBest();
    root.innerHTML = `
      <div class="card gm-hero">
        <h2 class="gm-title">Read the staff</h2>
        <div class="muted">See a note on the staff, find which note it is, and sing it. Learn to read music by ear and eye.</div>
        <div class="wu-staff">${staffSvg([{ midi: 60 }, { midi: 64 }, { midi: 67 }, { midi: 72 }], { mode: 'seq' })}</div>
        <button class="btn primary gm-cta" data-a="warm">🎹 Warm-up: hear it and see it on the staff</button>
      </div>
      <div class="card">
        <h3 style="margin:0 0 6px">Levels</h3>
        <div class="gm-list">${STAFF_LEVELS.map((l) => `
          <button class="gm-lvcard" data-lvl="${l.id}"><span class="gm-n">${l.id}</span>
            <span class="gm-lvt"><b>${l.name}</b><small>${l.how}</small></span>
            <span class="gm-pips">${best[l.id] ? stars(best[l.id].stars) : '☆☆☆'}</span></button>`).join('')}</div>
        <div class="muted" style="margin-top:8px">Not sure of a note? Press <b>Hear the note</b> while you sing. It counts as help.</div>
      </div>`;
  }

  async function play(levelId) {
    try { audio = await openAudio(); } catch (e) { root.insertAdjacentHTML('afterbegin', `<div class="alert bad">${micMessage(e)}</div>`); return; }
    const lv = STAFF_LEVELS.find((l) => l.id === levelId);
    view = 'play';
    current = createPlayer(root, {
      audio, deck: staffDeck(levelId), heading: `Level ${lv.id}: ${lv.name}`,
      onExit: () => { current = null; audio?.close(); audio = null; home(); },
      onDone: (results) => { current?.destroy(); current = null; audio?.close(); audio = null; finish(levelId, results); },
    });
  }

  function finish(levelId, results) {
    view = 'result';
    const won = results.filter((r) => r.won).length;
    const share = results.length ? won / results.length : 0;
    const helped = results.filter((r) => r.hints > 0).length;
    const n = share >= 0.9 && helped <= 1 ? 3 : share >= 0.7 ? 2 : won ? 1 : 0;
    const passed = share >= 0.7;
    const best = readBest();
    const was = best[levelId]?.stars ?? 0;
    if (passed && n > was) { best[levelId] = { stars: n, on: new Date().toISOString().slice(0, 10) }; writeBest(best); }
    const msg = n === 3 ? 'Brilliant! You read them like a pro.' : n === 2 ? 'Well done! Your reading is getting strong.' : passed ? 'Good work. Keep practising.' : 'Good try. Warm up on the staff, then go again.';
    root.innerHTML = `
      <div class="card gm-result">
        <div class="gm-praise ${passed ? '' : 'gm-try'}">${msg}</div>
        <div class="gm-big">${passed ? stars(n) : ''}</div>
        <div><b>${won} of ${results.length}</b> notes read and sung${helped ? ` · ${helped} with help` : ''}</div>
        <div class="row" style="justify-content:center">
          <button class="btn primary" data-lvl="${levelId}">🔁 ${passed ? 'Play again' : 'Try again'}</button>
          ${!passed ? '<button class="btn" data-a="warm">🎹 Staff warm-up</button>' : ''}
          <button class="btn" data-a="home">Back</button></div>
      </div>`;
  }

  function warm() {
    view = 'warm';
    current = mountWarmup(root, { staff: true, onExit: () => { current?.destroy?.(); current = null; home(); } });
  }

  root.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-lvl]');
    if (lv && (view === 'home' || view === 'result')) return play(Number(lv.dataset.lvl));
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'warm') return warm();
    if (a === 'home') return home();
  });
  home();
  return {
    destroy() { current?.destroy?.(); audio?.close(); },
    back() { // the phone's Back button
      if (view === 'play') { current?.destroy?.(); current = null; audio?.close(); audio = null; home(); return true; }
      if (view !== 'home') { current?.destroy?.(); current = null; home(); return true; }
      return false;
    },
  };
}
