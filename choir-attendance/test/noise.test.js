import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptPitch, nextFloor, gateFor, micFilterFor, GATE_MIN, GATE_MAX, detectPitch } from '../public/pitch.js';

test('a quiet room keeps the normal gate; a noisy room raises it but never past the cap', () => {
  assert.equal(gateFor(0.002), GATE_MIN);
  assert.ok(gateFor(0.02) > GATE_MIN && gateFor(0.02) <= GATE_MAX);
  assert.equal(gateFor(5), GATE_MAX, 'a very noisy room can not make a normal voice unheard');
});

test('the room level is learned from moments without a note, never from the child\'s voice', () => {
  let f = 0.004;
  for (let i = 0; i < 100; i++) f = nextFloor(f, 0.03, false);
  assert.ok(f > 0.025, 'learns a steady background hum');
  const held = nextFloor(f, 0.3, true);
  assert.equal(held, f, 'a loud sung note does not raise it');
});

test('a clear voice counts; noise and unclear sounds do not; a strong voice is allowed to be a little less clean', () => {
  assert.equal(acceptPitch({ freq: 392, clarity: 0.95 }, 0.05, 0.004), true);
  assert.equal(acceptPitch({ freq: 392, clarity: 0.95 }, 0.005, 0.004), false, 'too quiet');
  assert.equal(acceptPitch({ freq: 90, clarity: 0.5 }, 0.2, 0.004), false, 'rumble');
  assert.equal(acceptPitch(null, 0.2, 0.004), false);
  assert.equal(acceptPitch({ freq: 392, clarity: 0.78 }, 0.012, 0.004), false, 'a weak and unclear reading is not trusted');
  assert.equal(acceptPitch({ freq: 392, clarity: 0.78 }, 0.2, 0.004), true, 'a loud near voice in a noisy room still counts');
});

test('higher voices get a steeper rumble filter', () => {
  assert.ok(micFilterFor('high').hp > micFilterFor('mid').hp && micFilterFor('mid').hp > micFilterFor('low').hp);
  assert.deepEqual(micFilterFor('nonsense'), micFilterFor('mid'));
});

test('a voice with a loud fan rumble under it is lost without the filter (why the filter exists)', () => {
  const SR = 48000, N = 4096, buf = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / SR; buf[i] = 0.1 * (Math.sin(2 * Math.PI * 392 * t) + 0.5 * Math.sin(4 * Math.PI * 392 * t)) + 0.12 * (Math.sin(2 * Math.PI * 55 * t) + 0.7 * Math.sin(2 * Math.PI * 110 * t + 1)); }
  const p = detectPitch(buf, SR);
  assert.ok(!p || Math.abs(12 * Math.log2(p.freq / 392)) > 0.5 || p.clarity < 0.85, 'raw rumble confuses the pitch finder');
});
