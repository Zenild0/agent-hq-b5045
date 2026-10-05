// Warm-up room: a vocal trainer. Grand-piano scales and exercises to sing along with (each key is held for
// two seconds), chords, a slide, and a live tuner. No score, no clock, nothing saved.
import { detectPitch, rms, noteFromFreq, freqOfMidi } from './pitch.js';
import { NAMES, chordSymbol, chordRoot } from './levels.js';
import { openAudio, micMessage } from './audio.js';
import { staffSvg, spell, prefersFlats } from './staff.js';

const HOLD = 2; // seconds each piano key is held
// Offsets in semitones from the starting key.
export const EXERCISES = [
  { id: 'long', name: 'Long tone', how: 'One key. Sing "Ahh" and hold it steady for the whole two seconds.', steps: [0] },
  { id: 'three', name: 'Three-note step', how: 'Do, re, mi and back. Smooth and connected.', steps: [0, 2, 4, 2, 0] },
  { id: 'five', name: 'Five-note scale', how: 'Do up to sol and back down. Keep the breath long.', steps: [0, 2, 4, 5, 7, 5, 4, 2, 0] },
  { id: 'major', name: 'Major scale', how: 'The full do-re-mi scale up and back down.', steps: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0] },
  { id: 'minor', name: 'Minor scale', how: 'The natural minor scale. Listen for the darker third and sixth.', steps: [0, 2, 3, 5, 7, 8, 10, 12, 10, 8, 7, 5, 3, 2, 0] },
  { id: 'arp', name: 'Major arpeggio', how: 'Do, mi, sol, high do. The notes of the major chord, one at a time.', steps: [0, 4, 7, 12, 7, 4, 0] },
  { id: 'marp', name: 'Minor arpeggio', how: 'The same shape with a minor third: do, me, sol, high do.', steps: [0, 3, 7, 12, 7, 3, 0] },
  { id: 'leap', name: 'Octave and fifth leaps', how: 'Jump up and come back. Aim before you sing.', steps: [0, 7, 0, 12, 0] },
];

// With { staff: true } this is the warm-up of the staff-reading game: everything played is also shown on the staff.
export function mountWarmup(root, { onExit, staff = false } = {}) {
  let quality = 'major', audio = null, raf = 0, playingUntil = 0, dead = false, micOn = false, lastPc = 0, run = null, paused = false;
  const box = document.createElement('div'); // its own container, so its listeners go away with it
  root.replaceChildren(box);
  box.innerHTML = `
    <div class="card">
      <div class="row between"><h2 style="margin:0">${staff ? 'Staff warm-up' : 'Warm-up'}</h2><button class="btn small" data-x="exit">‹ Back</button></div>
      <p class="muted" style="margin:6px 0">${staff ? 'Hear each note and see where it sits on the staff. Nothing is scored. Sing along on "Ahh".' : 'Vocal exercises on a grand piano. Nothing is scored. Breathe low, sing "Ahh", take your time.'}</p>
      <h3 style="margin:10px 0 6px">1. Choose your starting key</h3>
      <div class="wu-grid" data-x="pads"></div>
      <div class="muted">Starting key: <b data-x="start">C</b></div>
    </div>
    ${staff ? `<div class="card" data-x="staffCard">
      <h3 style="margin:0 0 6px">Where the note lives</h3>
      <div class="wu-staff" data-x="staffBox"><div class="muted">Tap a key, a chord or an exercise to see its notes on the staff.</div></div>
      <div class="wu-meet" data-x="meet"></div>
      <div class="muted" data-x="staffTip">Lines from the bottom: E G B D F (Every Good Boy Does Fine). Spaces: F A C E (FACE).</div>
    </div>` : ''}
    <div class="card" id="wuEx">
      <h3 style="margin:0 0 6px">2. Pick an exercise</h3>
      <div class="wu-ex" data-x="list"></div>
    </div>
    <div class="card wu-player" data-x="player" hidden>
      <div class="wu-pl-top"><b data-x="plName">Exercise</b><span class="muted" data-x="plProg"></span></div>
      <div class="wu-keys" data-x="plKeys" aria-live="polite"></div>
      <div class="wu-now" data-x="now">&nbsp;</div>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" data-x="pause">⏸ Pause</button>
        <button class="btn" data-x="stop">⏹ Stop</button>
        <button class="btn" data-x="again">🔁 Again</button>
      </div>
    </div>
    <div class="card">
      <h3 style="margin:0 0 6px">3. Chords</h3>
      <div class="row" role="group" aria-label="Chord type">
        <button class="btn small primary" data-q="major">Major chords</button>
        <button class="btn small" data-q="minor">Minor chords</button>
      </div>
      <div class="wu-grid" data-x="chords"></div>
      <div class="muted" data-x="chordNow">Tap a chord, then sing its first note.</div>
      <div class="row" style="margin-top:10px"><button class="btn small" data-s="siren">🚨 Siren slide</button><span class="muted">Slide your voice up and down with the sound.</span></div>
    </div>
    <div class="card">
      <div class="row between"><h3 style="margin:0">Hear yourself</h3><button class="btn small" data-x="mic">🎤 Listen to my voice</button></div>
      <div class="wu-tuner">
        <div class="wu-big" data-x="note">–</div>
        <div class="wu-meter" aria-label="Flat or sharp"><b></b><i data-x="needle"></i></div>
        <div class="wu-lab"><span>flat</span><span data-x="cents">&nbsp;</span><span>sharp</span></div>
      </div>
      <div class="muted" data-x="err" role="alert">The phone listens live. Nothing is recorded or sent anywhere.</div>
    </div>`;
  const X = (n) => box.querySelector(`[data-x="${n}"]`);
  const cache = new Map();
  const setText = (n, v) => { if (cache.get(n) !== v) { cache.set(n, v); X(n).textContent = v; } };
  const paintPads = () => {
    X('pads').innerHTML = NAMES.map((n, i) => `<button class="btn${i === lastPc ? ' on' : ''}" data-pc="${i}">${n}</button>`).join('');
    X('chords').innerHTML = NAMES.map((_, i) => `<button class="btn" data-chord="${i}">${chordSymbol(i, quality)}</button>`).join('');
    setText('start', NAMES[lastPc]);
  };
  X('list').innerHTML = EXERCISES.map((e) => `<button class="wu-card" data-ex="${e.id}"><b>${e.name}</b><span class="muted">${e.how}</span><span class="wu-len">${e.steps.length} keys · ${e.steps.length * HOLD} s</span></button>`).join('');
  if (staff) X('meet').innerHTML = [60, 62, 64, 65, 67, 69, 71, 72].map((m) => `<button class="btn" data-meet="${m}">${spell(m).name}</button>`).join('');
  paintPads();

  const showStaff = (midis, mode = 'seq', cur = -1) => {
    if (!staff) return;
    const flats = prefersFlats(lastPc, run?.ex?.id === 'minor' || run?.ex?.id === 'marp' || quality === 'minor');
    X('staffBox').innerHTML = staffSvg(midis.map((m) => ({ midi: m })), { mode, flats, current: cur });
  };

  const ensureAudio = async () => { if (!audio) audio = await openAudio(); await audio.ensure(); return audio; };
  const setPaused = (p) => {
    paused = p;
    if (!audio) return;
    if (p) audio.pause(); else audio.resume();
    X('pause').textContent = p ? '▶ Play' : '⏸ Pause';
  };

  // Play an exercise: the keys are scheduled on the audio clock, so Pause holds everything, including the highlight.
  async function start(ex) {
    const a = await ensureAudio();
    a.stop(); setPaused(false);
    const root0 = 60 + lastPc;
    const midis = ex.steps.map((s) => root0 + s);
    const t0 = a.ctx.currentTime + 0.05;
    const ms = a.sound.melody(midis, HOLD, HOLD + 0.1);
    playingUntil = performance.now() + ms; // the microphone ignores the piano while it plays
    run = { ex, midis, t0, total: midis.length * HOLD, a };
    X('player').hidden = false;
    setText('plName', `${ex.name} from ${NAMES[lastPc]}`);
    X('plKeys').innerHTML = midis.map((m, i) => `<span class="wk" data-k="${i}">${NAMES[((m % 12) + 12) % 12]}</span>`).join('');
    showStaff(midis, 'seq', 0);
    cancelAnimationFrame(raf);
    followRun();
  }
  function followRun() {
    if (dead || !run) return;
    raf = requestAnimationFrame(followRun);
    const el = run.a.ctx.currentTime - run.t0;
    const i = Math.min(run.midis.length - 1, Math.max(0, Math.floor(el / HOLD)));
    box.querySelectorAll('.wk').forEach((k, n) => { k.classList.toggle('now', n === i && el >= 0 && el < run.total); k.classList.toggle('done', n < i || el >= run.total); });
    if (staff) box.querySelectorAll('.sn').forEach((n, k) => n.classList.toggle('on', k === i && el >= 0 && el < run.total));
    setText('plProg', el >= 0 && el < run.total ? `${Math.min(run.midis.length, i + 1)} of ${run.midis.length}` : '');
    setText('now', el < run.total ? `Sing ${NAMES[((run.midis[i] % 12) + 12) % 12]} along with the piano` : 'Finished. Well done! Press Again, or choose another exercise.');
    if (el >= run.total + 0.2) { cancelAnimationFrame(raf); }
  }
  function stopRun(keepPanel = true) {
    if (audio) { audio.stop(); setPaused(false); }
    cancelAnimationFrame(raf);
    if (run) { box.querySelectorAll('.wk').forEach((k) => k.classList.remove('now', 'done')); setText('now', 'Stopped.'); }
    if (!keepPanel) X('player').hidden = true;
  }

  box.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { quality = q.dataset.q; box.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('primary', b === q)); paintPads(); return; }
    const pad = e.target.closest('[data-pc]');
    if (pad) { lastPc = Number(pad.dataset.pc); paintPads(); return; }
    const meet = e.target.closest('[data-meet]');
    if (meet) {
      const m = Number(meet.dataset.meet);
      const a = await ensureAudio();
      a.stop(); setPaused(false);
      const ms = a.sound.pianoNote(m, 2.2);
      playingUntil = performance.now() + ms;
      lastPc = ((m % 12) + 12) % 12;
      showStaff([m], 'chord');
      setText('now', `That is ${spell(m).full}. Sing it along with the piano.`);
      return;
    }
    const ex = e.target.closest('[data-ex]');
    if (ex) return start(EXERCISES.find((x) => x.id === ex.dataset.ex));
    const ch = e.target.closest('[data-chord]');
    if (ch) {
      const pc = Number(ch.dataset.chord);
      lastPc = pc;
      const a = await ensureAudio();
      a.stop(); setPaused(false);
      const ms = a.sound.chord(60 + pc, quality, 2.4);
      playingUntil = performance.now() + ms;
      showStaff((quality === 'minor' ? [0, 3, 7] : [0, 4, 7]).map((s) => 60 + pc + s), 'chord');
      setText('chordNow', `${chordSymbol(pc, quality)} (${chordRoot(pc, quality)} ${quality}). Sing the first note, ${chordRoot(pc, quality)}. The ${quality === 'minor' ? 'minor' : 'major'} third is in the chord.`);
      return;
    }
    if (e.target.closest('[data-x="pause"]')) { if (audio && run) setPaused(!paused); return; }
    if (e.target.closest('[data-x="stop"]')) { stopRun(); return; }
    if (e.target.closest('[data-x="again"]')) { if (run) start(run.ex); return; }
    const sc = e.target.closest('[data-s]');
    if (sc) {
      const a = await ensureAudio();
      a.stop(); setPaused(false);
      const root0 = 60 + lastPc;
      const o = a.ctx.createOscillator(), g = a.ctx.createGain(), t0 = a.ctx.currentTime + 0.05;
      o.type = 'sine';
      o.frequency.setValueAtTime(freqOfMidi(root0), t0);
      o.frequency.exponentialRampToValueAtTime(freqOfMidi(root0 + 12), t0 + 3);
      o.frequency.exponentialRampToValueAtTime(freqOfMidi(root0), t0 + 6);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.2, t0 + 0.2); g.gain.setValueAtTime(0.2, t0 + 5.6); g.gain.linearRampToValueAtTime(0, t0 + 6);
      o.connect(g).connect(a.ctx.destination); o.start(t0); o.stop(t0 + 6.1);
      playingUntil = performance.now() + 6200;
      setText('chordNow', 'Slide your voice up and down with the sound.');
      return;
    }
    if (e.target.closest('[data-x="mic"]')) {
      const a = await ensureAudio();
      if (micOn) { a.stopMic(); micOn = false; cancelAnimationFrame(micRaf); X('mic').textContent = '🎤 Listen to my voice'; setText('note', '–'); return; }
      try { await a.enableMic(); micOn = true; X('mic').textContent = '⏹ Stop listening'; X('err').textContent = ''; loop(); }
      catch (err) { X('err').textContent = micMessage(err); }
      return;
    }
    if (e.target.closest('[data-x="exit"]')) { destroy(); onExit?.(); }
  });

  let recent = [], shownAt = 0, shown = '–', micRaf = 0;
  function loop(now = performance.now()) {
    if (dead || !micOn) return;
    micRaf = requestAnimationFrame(loop);
    audio.analyser.getFloatTimeDomainData(audio.buf);
    let f = 0;
    if (rms(audio.buf) > 0.01 && now > playingUntil && !paused) {
      const p = detectPitch(audio.buf, audio.ctx.sampleRate);
      if (p && p.clarity > 0.85) { recent.push(p.freq); if (recent.length > 5) recent.shift(); f = [...recent].sort((x, y) => x - y)[Math.floor(recent.length / 2)]; }
    }
    if (!f && recent.length) recent.shift();
    if (f) {
      const n = noteFromFreq(f);
      shown = `${n.name}${n.octave}`; shownAt = now;
      setText('cents', `${n.cents > 0 ? '+' : ''}${n.cents}`);
      X('needle').style.transform = `translateX(${n.cents * 2.2}px)`;
    }
    setText('note', now - shownAt < 350 ? shown : '–');
    if (now - shownAt >= 350) setText('cents', ' ');
  }
  function destroy() { dead = true; cancelAnimationFrame(raf); cancelAnimationFrame(micRaf); audio?.stop(); audio?.close(); }
  return { destroy };
}
