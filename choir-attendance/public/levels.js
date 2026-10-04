// The singing game's ladder: from first steps to Legend. Pure logic (no sound, no screen), so it can be tested.
// A "challenge" is: what the phone plays, which notes (by name, any octave) the child must sing in order,
// how close they must be (cents), how long to hold each, and how long they have.

import { CHORDS } from './pitch.js';

export const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const INTERVALS = [{ n: 'major 3rd', s: 4 }, { n: '4th', s: 5 }, { n: '5th', s: 7 }, { n: '6th', s: 9 }];

export const LEVELS = [
  { id: 1, tier: 'Beginner', emoji: '🐣', name: 'Little Lark', how: 'Sing the first note of each chord, C to B in order.', tol: 45, hold: 500, count: 7 },
  { id: 2, tier: 'Beginner', emoji: '🐦', name: 'Songbird', how: 'The same seven chords, but in a mixed-up order.', tol: 40, hold: 500, count: 7 },
  { id: 3, tier: 'Beginner', emoji: '🎶', name: 'Chorister', how: 'All twelve notes, including the sharps. Ten chords.', tol: 35, hold: 500, count: 10 },
  { id: 4, tier: 'Amateur', emoji: '🔮', name: 'Minor Magic', how: 'Major and sad minor chords. Sing the first note.', tol: 30, hold: 500, count: 10 },
  { id: 5, tier: 'Amateur', emoji: '🎡', name: 'Third Wheel', how: 'Sing the THIRD note of the chord, not the first. Real harmony!', tol: 30, hold: 550, count: 8 },
  { id: 6, tier: 'Amateur', emoji: '🎤', name: 'Harmony Hero', how: 'Sing the third or the fifth of the chord.', tol: 25, hold: 550, count: 8 },
  { id: 7, tier: 'Pro', emoji: '🔁', name: 'Echo Master', how: 'Listen to a short tune, then sing it back note by note.', tol: 25, hold: 400, count: 6 },
  { id: 8, tier: 'Pro', emoji: '🥷', name: 'Interval Ninja', how: 'Hear one note, then sing the jump you are asked for.', tol: 25, hold: 550, count: 8 },
  { id: 9, tier: 'Pro', emoji: '🧠', name: 'Memory Lane', how: 'The chord plays, then silence. Sing it from memory.', tol: 20, hold: 600, count: 8 },
  { id: 10, tier: 'Expert', emoji: '🙈', name: 'Blind Ear', how: 'Longer tunes, nothing on screen. Only your ears.', tol: 20, hold: 500, count: 6 },
  { id: 11, tier: 'Expert', emoji: '⭐', name: 'Steady Star', how: 'Find the note and hold it dead steady for 3 seconds.', tol: 12, hold: 3000, count: 6 },
  { id: 12, tier: 'Legend', emoji: '👑', name: 'Legend', how: 'A mix of everything, hidden, tiny margin. Only the best.', tol: 12, hold: 700, count: 10 },
];

const pick = (a, r) => a[Math.floor(r() * a.length)];
export const shuffle = (a, r = Math.random) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const rootMidi = (pc) => 60 + pc;

// One challenge of the given kind. `lv` carries the level's tolerance and hold time.
function make(kind, lv, r, { pc = Math.floor(r() * 12), quality = 'major', blind = false } = {}) {
  const base = { kind, tol: lv.tol, hold: lv.hold, blind, level: lv.id };
  const chord = { type: 'chord', root: rootMidi(pc), quality };
  const chordName = `${NAMES[pc]} ${quality}`;
  if (kind === 'root') return { ...base, title: chordName, how: 'Sing the FIRST note', play: chord, targets: [pc], limit: 15 - Math.min(5, lv.id) };
  if (kind === 'third' || kind === 'fifth') {
    const steps = kind === 'fifth' ? 7 : CHORDS[quality][1];
    return { ...base, title: chordName, how: kind === 'fifth' ? 'Sing the FIFTH' : 'Sing the THIRD', play: chord, targets: [(pc + steps) % 12], limit: 14 };
  }
  if (kind === 'hold') return { ...base, title: chordName, how: 'Sing it and HOLD it steady', play: chord, targets: [pc], limit: 14 };
  if (kind === 'memory') return { ...base, title: chordName, how: 'Remember it, then sing the FIRST note', play: chord, targets: [pc], delayMs: 4000, hideAfterPlay: true, limit: 10 };
  if (kind === 'interval') {
    const iv = pick(INTERVALS, r), up = lv.id < 8 ? true : r() < 0.5;
    const target = ((pc + (up ? iv.s : -iv.s)) % 12 + 12) % 12;
    return { ...base, title: `You hear ${NAMES[pc]}`, how: `Sing a ${iv.n} ${up ? 'above' : 'below'}`, play: { type: 'note', midi: rootMidi(pc) }, targets: [target], limit: 12 };
  }
  if (kind === 'echo') {
    const len = lv.id >= 10 ? 4 : 3;
    const notes = [rootMidi(pc)];
    for (let i = 1; i < len; i++) {
      const prev = notes[i - 1];
      const step = lv.id >= 10 ? pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5], r) : pick([-4, -2, -1, 1, 2, 4], r);
      let n = prev + step;
      if (n < 55) n += 12; if (n > 76) n -= 12;
      notes.push(n);
    }
    return { ...base, title: blind ? '🙈 Blind' : 'Echo the tune', how: `${len} notes, in order`, play: { type: 'melody', notes }, targets: notes.map((m) => m % 12), limit: 8 + len * 4 };
  }
  throw new Error(`unknown kind ${kind}`);
}

// Every level has three stages. Stage 1 is a gentle practice round, stage 2 is shorter than the full level,
// and stage 3 is the full showdown at the level's own margin (it clears the level, and counts for the weekly board).
export const STAGES = [
  { stage: 1, name: 'Practice', share: 0.5, tolDelta: +10 },
  { stage: 2, name: 'Challenge', share: 0.75, tolDelta: 0 },
  { stage: 3, name: 'Showdown', share: 1, tolDelta: -3 },
];
export function stageSpec(levelId, stage) {
  const lv = LEVELS.find((l) => l.id === levelId);
  const st = STAGES.find((s) => s.stage === stage);
  if (!lv || !st) throw new Error('unknown stage');
  return { stage, name: st.name, count: Math.min(lv.count, Math.max(3, Math.ceil(lv.count * st.share))), tol: Math.min(50, Math.max(10, lv.tol + st.tolDelta)) };
}

// Who you are on the journey, from the highest level cleared.
export const titleFor = (maxCleared) => (maxCleared ? LEVELS.find((l) => l.id === maxCleared).tier : 'Newcomer');

// The piano keys, one per level: C, C#, D ... B. Black keys are the sharps.
export const PIANO_KEYS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

// The list of challenges for one round of a level stage (stage 3 is the full level).
export function buildDeck(levelId, r = Math.random, stage = 3) {
  const lv0 = LEVELS.find((l) => l.id === levelId);
  const spec = lv0 && stageSpec(levelId, stage);
  const lv = lv0 && { ...lv0, tol: spec.tol };
  const pcs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const q = () => (r() < 0.5 ? 'major' : 'minor');
  const deck = [];
  switch (levelId) {
    case 1: [0, 2, 4, 5, 7, 9, 11].forEach((pc) => deck.push(make('root', lv, r, { pc }))); break;
    case 2: shuffle([0, 2, 4, 5, 7, 9, 11], r).forEach((pc) => deck.push(make('root', lv, r, { pc }))); break;
    case 3: shuffle(pcs, r).slice(0, lv.count).forEach((pc) => deck.push(make('root', lv, r, { pc }))); break;
    case 4: shuffle(pcs, r).slice(0, lv.count).forEach((pc) => deck.push(make('root', lv, r, { pc, quality: q() }))); break;
    case 5: shuffle(pcs, r).slice(0, lv.count).forEach((pc) => deck.push(make('third', lv, r, { pc, quality: q() }))); break;
    case 6: shuffle(pcs, r).slice(0, lv.count).forEach((pc, i) => deck.push(make(i % 2 ? 'fifth' : 'third', lv, r, { pc, quality: q() }))); break;
    case 7: for (let i = 0; i < lv.count; i++) deck.push(make('echo', lv, r)); break;
    case 8: for (let i = 0; i < lv.count; i++) deck.push(make('interval', lv, r)); break;
    case 9: shuffle(pcs, r).slice(0, lv.count).forEach((pc) => deck.push(make('memory', lv, r, { pc, quality: q() }))); break;
    case 10: for (let i = 0; i < lv.count; i++) deck.push(make('echo', lv, r, { blind: true })); break;
    case 11: shuffle(pcs, r).slice(0, lv.count).forEach((pc) => deck.push(make('hold', lv, r, { pc, quality: q() }))); break;
    case 12: {
      const kinds = shuffle(['echo', 'memory', 'third', 'fifth', 'interval', 'hold', 'echo', 'memory', 'third', 'interval'], r);
      kinds.slice(0, lv.count).forEach((k) => deck.push(make(k, lv, r, { quality: q(), blind: k !== 'interval' && r() < 0.6 })));
      break;
    }
    default: throw new Error('unknown level');
  }
  return deck.slice(0, spec.count).map((c) => (c.kind === 'hold' ? { ...c, hold: levelId === 12 ? 2000 : lv.hold } : c));
}

// Cents between a sung pitch (as a fractional MIDI number) and a note name, in any octave (0..600).
export function centsTo(midiFloat, pc) {
  const d = (((midiFloat - pc) % 12) + 12) % 12;
  return Math.min(d, 12 - d) * 100;
}

// Follows the child's voice through a challenge. Feed it every frame: feed(nowMs, midiFloat | null).
// A note counts when it has been held in range for `hold` ms. Repeated notes need a short break between them.
export function makeTracker(ch) {
  let step = 0, hitAt = 0, needBreak = false, clearSince = 0, doneAt = 0;
  return {
    feed(now, midi) {
      const target = ch.targets[step] ?? ch.targets.at(-1);
      const cents = midi == null ? Infinity : centsTo(midi, target);
      const inRange = cents <= ch.tol;
      let justAdvanced = false;
      if (needBreak) {
        if (!inRange) { if (!clearSince) clearSince = now; if (now - clearSince >= 120) { needBreak = false; clearSince = 0; } } else clearSince = 0;
      }
      if (!doneAt) {
        if (inRange && !needBreak) {
          if (!hitAt) hitAt = now;
          if (now - hitAt >= ch.hold) {
            step += 1; justAdvanced = true;
            if (step >= ch.targets.length) doneAt = now;
            else { needBreak = ch.targets[step] === ch.targets[step - 1]; hitAt = 0; clearSince = 0; }
          }
        } else hitAt = 0;
      }
      const warm = cents === Infinity ? 0 : Math.max(0, 1 - cents / 150);
      return { step, steps: ch.targets.length, hold: hitAt ? Math.min(1, (now - hitAt) / ch.hold) : 0, warm, done: Boolean(doneAt), justAdvanced, cents };
    },
    get hitStart() { return hitAt; },
    get done() { return Boolean(doneAt); },
  };
}

export const starsFor = (results, limitOf) => {
  const won = results.filter((r) => r.won);
  if (!results.length || !won.length) return 0;
  const ratio = won.reduce((s, r, i) => s + r.ms / limitOf(i), 0) / won.length;
  const share = won.length / results.length;
  return share >= 0.9 && ratio < 0.35 ? 3 : share >= 0.7 && ratio < 0.6 ? 2 : 1;
};

export const DAILY_COUNT = 6;

// A small deterministic random generator: the same seed gives the same sequence on every phone.
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Today's Legend challenge: the same hard round for everybody.
export const dailyDeck = (seed) => buildDeck(12, seededRng(seed)).slice(0, DAILY_COUNT);
