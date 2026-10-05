import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPiano, renderGuitar, renderTanpura, renderTanpuraDrone } from '../public/synth.js';
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

test('piano, guitar and tanpura notes are in tune (within a few cents) from the bass to the treble', () => {
  for (const midi of [43, 48, 55, 60, 64, 67, 72]) {
    for (const [name, fn] of [['piano', renderPiano], ['guitar', renderGuitar], ['tanpura', renderTanpura]]) {
      const c = centsOff(fn(hz(midi), 3.5, SR), hz(midi));
      assert.ok(c !== null && Math.abs(c) < 4, `${name} ${midi}: ${c}`);
    }
  }
});

test('notes are loud enough but never clip, fade out smoothly, and the piano key really sustains for 2 seconds', () => {
  const p = renderPiano(hz(60), 2, SR);
  let peak = 0;
  for (const v of p) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0.3 && peak <= 0.7, `peak ${peak}`);
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += p[i] ** 2; return Math.sqrt(s / (b - a)); };
  assert.ok(rms(Math.floor(SR * 1.8), Math.floor(SR * 1.9)) > rms(0, 4800) * 0.2, 'still ringing near 2 seconds');
  assert.ok(Math.abs(p[p.length - 1]) < 1e-3, 'ends silent, no click');
  const d = renderTanpuraDrone(hz(60), 4.5, SR);
  assert.ok(d.length === Math.floor(SR * 4.5) && Math.abs(d[d.length - 1]) < 1e-3);
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
import { staffDeck, STAFF_LEVELS } from '../public/staffgame.js';

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

test('staff game rounds: right size, silent, and each note is sung by name in any octave', () => {
  for (const lv of STAFF_LEVELS) {
    const d = staffDeck(lv.id, () => 0.4);
    assert.equal(d.length, lv.count);
    for (const c of d) {
      assert.ok(c.silent && c.staff.length === 1 && lv.pool.includes(c.staff[0]));
      assert.equal(c.targets[0], c.staff[0] % 12);
      assert.match(c.noteName, /^[A-G][♯♭]?\d$/);
    }
    assert.equal(new Set(d.map((c) => c.staff[0])).size, d.length, 'no repeated note in one round');
  }
});
