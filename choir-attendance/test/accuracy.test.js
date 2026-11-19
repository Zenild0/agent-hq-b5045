import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch, rms } from '../public/pitch.js';
import { makeTracker } from '../public/levels.js';

// A pretend singing voice: a weak fundamental with strong upper harmonics (like a real voice), vibrato, and breath noise.
const SR = 48000, N = 4096;
function voice({ f0, vibCents = 0, driftCents = 0, secs = 3, seed = 1 }) {
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = new Float32Array(SR * secs);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const cents = driftCents + vibCents * Math.sin(2 * Math.PI * 5.5 * (i / SR));
    ph += (2 * Math.PI * f0 * 2 ** (cents / 1200)) / SR;
    const v = 0.45 * Math.sin(ph) + 0.55 * Math.sin(2 * ph) + 0.4 * Math.sin(3 * ph) + 0.2 * Math.sin(4 * ph) + 0.1 * Math.sin(5 * ph) + 0.06 * (rnd() - 0.5);
    out[i] = 0.25 * v;
  }
  return out;
}
// The same steps the game takes on every frame: listen, take the middle of the last five readings, feed the tracker.
function passes(sig, pc, tol, hold) {
  const tr = makeTracker({ targets: [pc], tol, hold });
  const recent = [];
  for (let at = N; at < sig.length; at += 800) {
    const buf = sig.subarray(at - N, at);
    let midi = null;
    if (rms(buf) > 0.01) {
      const p = detectPitch(buf, SR);
      if (p && p.clarity > 0.85) { recent.push(69 + 12 * Math.log2(p.freq / 440)); if (recent.length > 5) recent.shift(); midi = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)]; }
    }
    if (midi == null && recent.length) recent.shift();
    if (tr.feed((at / SR) * 1000, midi).done) return true;
  }
  return false;
}
const hz = (pc, oct = 0) => 261.63 * 2 ** (pc / 12) * 2 ** oct;

test('a singer who is on the note passes even the strictest level, vibrato and all', () => {
  for (const pc of [0, 4, 7, 11]) {
    assert.ok(passes(voice({ f0: hz(pc), vibCents: 20 }), pc, 12, 1500), `pc ${pc} natural vibrato`);
    assert.ok(passes(voice({ f0: hz(pc, 1), vibCents: 25, driftCents: 5 }), pc, 20, 600), `pc ${pc} an octave up`);
  }
});

test('a singer who is clearly off the note does not pass', () => {
  assert.ok(!passes(voice({ f0: hz(0), driftCents: 30 }), 0, 12, 600), '30 cents sharp at the strictest margin');
  assert.ok(!passes(voice({ f0: hz(1) }), 0, 45, 500), 'a semitone away is the wrong note');
  assert.ok(!passes(voice({ f0: hz(7) }), 0, 45, 500), 'a different note');
  assert.ok(!passes(new Float32Array(SR * 2), 0, 45, 500), 'silence');
});

test('one unclear frame does not restart the hold, but a real miss does', () => {
  const tr = makeTracker({ targets: [0], tol: 30, hold: 600 });
  const c4 = 60;
  let t = 0, done = false;
  for (; t < 300; t += 16) tr.feed(t, c4);
  for (; t < 400; t += 16) tr.feed(t, null);          // 100 ms drop-out: forgiven
  for (; t < 800 && !done; t += 16) done = tr.feed(t, c4).done;
  assert.ok(done, 'finished despite a short drop-out');
  const tr2 = makeTracker({ targets: [0], tol: 30, hold: 600 });
  t = 0;
  for (; t < 300; t += 16) tr2.feed(t, c4);
  for (; t < 800; t += 16) tr2.feed(t, null);          // half a second of nothing: the hold restarts
  assert.ok(tr2.feed(t, c4).hold < 0.2);
});
