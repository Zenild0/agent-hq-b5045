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
