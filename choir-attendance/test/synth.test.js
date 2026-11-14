import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPiano, renderGuitar } from '../public/synth.js';
import { detectPitch } from '../public/pitch.js';
import { buildDeck, chordSymbol, chordTitle } from '../public/levels.js';
import { EXERCISES } from '../public/warmup.js';

const SR = 48000;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const centsOff = (buf, f) => {
  const seg = buf.subarray(Math.floor(SR * 0.35), Math.floor(SR * 0.35) + 4096);
  const p = detectPitch(seg, SR, { minHz: 50, maxHz: 2000, threshold: 0.2 });
  return p ? 1200 * Math.log2(p.freq / f) : null;
};

test('piano and guitar notes are in tune (within a few cents) from the bass to the treble', () => {
  for (const midi of [43, 48, 55, 60, 64, 67, 72]) {
    for (const [name, fn] of [['piano', renderPiano], ['guitar', renderGuitar]]) {
      const c = centsOff(fn(hz(midi), 3.5, SR), hz(midi));
      assert.ok(c !== null && Math.abs(c) < 4, `${name} ${midi}: ${c}`);
    }
  }
});

test('notes are loud enough but never clip, fade out smoothly, and the piano key rings for two seconds without an added sustain', () => {
  const p = renderPiano(hz(60), 2, SR);
  let peak = 0;
  for (const v of p) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0.3 && peak <= 0.7, `peak ${peak}`);
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += p[i] ** 2; return Math.sqrt(s / (b - a)); };
  const early = rms(4800, 9600), late = rms(Math.floor(SR * 1.8), Math.floor(SR * 1.9));
  assert.ok(late > early * 0.15 && late < early * 0.8, 'still audible near 2 seconds, and fading naturally');
  // mellow: little energy in the harsh high range
  let hiE = 0, allE = 0;
  for (let i = 4800; i < 4800 + 4096; i++) allE += p[i] ** 2;
  const lpHi = (() => { let y = 0, e = 0; for (let i = 4800; i < 4800 + 4096; i++) { y += 0.5 * (p[i] - y); const h = p[i] - y; e += h * h; } return e; })();
  hiE = lpHi;
  assert.ok(hiE / allE < 0.05, `high-frequency share ${hiE / allE}`);
  assert.ok(Math.abs(p[p.length - 1]) < 1e-3, 'ends silent, no click');
});

test('minor chords are named and spelled as a musician would', () => {
  assert.equal(chordSymbol(0, 'major'), 'C');
  assert.equal(chordSymbol(0, 'minor'), 'Cm');
  assert.equal(chordSymbol(3, 'major'), 'E♭');
  assert.equal(chordSymbol(3, 'minor'), 'E♭m');
  assert.equal(chordSymbol(6, 'minor'), 'F♯m');
  assert.equal(chordTitle(1, 'minor'), 'C♯m · C♯ minor');
  const deck = buildDeck(4, () => 0.9, 3);
  const minors = deck.filter((c) => c.play.quality === 'minor');
  assert.ok(minors.length > 0);
  for (const c of minors) assert.match(c.title, /m · .+ minor$/);
});

test('warm-up exercises start on the chosen key, stay in a singable range and hold each key two seconds', () => {
  assert.ok(EXERCISES.length >= 6);
  for (const e of EXERCISES) {
    assert.equal(e.steps[0], 0, e.name);
    assert.ok(Math.max(...e.steps) <= 12 && Math.min(...e.steps) >= 0, e.name);
  }
  assert.ok(EXERCISES.some((e) => e.steps.includes(3) && e.steps.includes(8)), 'a minor scale is there');
});

import { spell, prefersFlats } from '../public/staff.js';
import { staffDeck, STAFF_LEVELS, newNotesOf } from '../public/staffgame.js';

test('notes are written on the right line or space of the treble staff', () => {
  const pos = (m, f = false) => spell(m, f).pos;
  assert.equal(pos(64), 0);   // E4: bottom line
  assert.equal(pos(67), 2);   // G4: second line
  assert.equal(pos(71), 4);   // B4: middle line
  assert.equal(pos(77), 8);   // F5: top line
  assert.equal(pos(60), -2);  // middle C: a ledger line below
  assert.equal(pos(81), 10);  // A5: a ledger line above
  assert.equal(spell(61, false).full, 'C♯4');
  assert.equal(spell(61, true).full, 'D♭4');
  assert.equal(spell(70, true).full, 'B♭4');
  assert.ok(prefersFlats(3) && !prefersFlats(2) && prefersFlats(0, true) && !prefersFlats(4, true));
});

test('notation trainer: 20 levels, each round the right size, silent, sung by name in any octave', () => {
  assert.equal(STAFF_LEVELS.length, 20);
  assert.deepEqual(STAFF_LEVELS.map((l) => l.id), Array.from({ length: 20 }, (_, i) => i + 1));
  for (const lv of STAFF_LEVELS) {
    const d = staffDeck(lv.id, () => 0.4);
    assert.equal(d.length, lv.count);
    d.forEach((c, i) => {
      assert.ok(c.silent && c.staff.length === 1 && (lv.pool.includes(c.staff[0]) || c.review), 'a level asks its own notes, or revision from earlier levels');
      assert.equal(c.targets[0], c.staff[0] % 12);
      assert.match(c.noteName, /^[A-G][♯♭]?-?\d$/);
      assert.ok(['treble', 'bass'].includes(c.clef));
      if (i) assert.notEqual(c.staff[0], d[i - 1].staff[0], 'never the same note twice in a row');
    });
    if (lv.clef !== 'grand') assert.ok(d.every((c) => c.clef === lv.clef));
  }
  assert.ok(staffDeck(10, () => 0.9).every((c) => !c.noteName.includes('♯')), 'the flats level spells with flats');
  assert.ok(staffDeck(9, () => 0.1).every((c) => !c.noteName.includes('♭')), 'the sharps level spells with sharps');
});

test('bass clef notes sit on the right lines (G B D F A) and spaces (A C E G)', () => {
  const pos = (m) => spell(m, false, 'bass').pos;
  assert.deepEqual([43, 47, 50, 53, 57].map(pos), [0, 2, 4, 6, 8]);
  assert.deepEqual([45, 48, 52, 55].map(pos), [1, 3, 5, 7]);
  assert.equal(pos(60), 10); // middle C: a ledger line above the bass staff
});

test('notation levels introduce a few new notes and revise older ones', () => {
  assert.deepEqual(newNotesOf(STAFF_LEVELS[0]), [60, 62, 64], 'level 1: everything is new');
  assert.deepEqual(newNotesOf(STAFF_LEVELS[1]), [65, 67], 'level 2 adds F and G');
  assert.ok(newNotesOf(STAFF_LEVELS[11]).length > 0, 'bass clef starts fresh');
  for (const lv of STAFF_LEVELS.filter((l) => l.id > 1)) {
    const older = new Set(STAFF_LEVELS.filter((l) => l.id < lv.id && (lv.clef === 'grand' || l.clef === lv.clef)).flatMap((l) => l.pool));
    const d = staffDeck(lv.id, () => 0.37);
    const rev = d.filter((c) => c.review);
    if (older.size) { assert.ok(rev.length >= 1 && rev.length <= Math.ceil(lv.count * 0.4), `level ${lv.id}: revision share`); assert.ok(rev.every((c) => older.has(c.staff[0]) && /^Review/.test(c.how))); }
    assert.equal(d.length, lv.count);
  }
});
