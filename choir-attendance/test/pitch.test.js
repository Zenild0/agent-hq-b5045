import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, noteFromFreq, matches, rms, freqOfMidi } from '../public/pitch.js';

const sine = (f, sr = 48000, n = 4096, amp = 0.5, harmonics = []) => {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = Math.sin((2 * Math.PI * f * i) / sr);
    harmonics.forEach((h, k) => { v += h * Math.sin((2 * Math.PI * f * (k + 2) * i) / sr); });
    b[i] = amp * v;
  }
  return b;
};

test('detects sung notes from 100 Hz to 1000 Hz, with harmonics like a real voice', () => {
  for (const f of [110, 196, 261.63, 329.63, 440, 523.25, 783.99, 987.77]) {
    const r = detectPitch(sine(f, 48000, 4096, 0.4, [0.5, 0.3, 0.2]), 48000);
    assert.ok(r, `no pitch for ${f}`);
    assert.ok(Math.abs(1200 * Math.log2(r.freq / f)) < 8, `${f} -> ${r.freq}`);
  }
});

test('silence and noise give no pitch', () => {
  assert.equal(detectPitch(new Float32Array(4096), 48000), null);
  const noise = Float32Array.from({ length: 4096 }, () => (Math.random() - 0.5) * 0.2);
  assert.equal(detectPitch(noise, 48000), null);
  assert.ok(rms(sine(300)) > 0.3);
});

test('note names, octaves and cents', () => {
  const c4 = noteFromFreq(261.63);
  assert.deepEqual([c4.name, c4.octave, c4.cents], ['C', 4, 0]);
  const sharp = noteFromFreq(261.63 * 2 ** (30 / 1200));
  assert.deepEqual([sharp.name, sharp.cents], ['C', 30]);
  assert.equal(noteFromFreq(466.16).name, 'A♯');
  assert.equal(noteFromFreq(freqOfMidi(60)).midi, 60);
});

test('matching ignores the octave but not the note or a flat/sharp voice', () => {
  const C = 0;
  assert.ok(matches(noteFromFreq(261.63), C));
  assert.ok(matches(noteFromFreq(523.25), C), 'an octave up still counts');
  assert.ok(matches(noteFromFreq(130.81), C), 'an octave down still counts');
  assert.ok(!matches(noteFromFreq(293.66), C), 'D is not C');
  assert.ok(!matches(noteFromFreq(261.63 * 2 ** (45 / 1200)), C), '45 cents sharp is too far');
  assert.ok(matches(noteFromFreq(261.63 * 2 ** (-25 / 1200)), C));
});
