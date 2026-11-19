import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RLEVELS, makePattern, makeRound, onsets, patternBeats, scoreTaps, rhythmStars, BEATS_PER_BAR, ROUND_SIZE } from '../public/rhythm.js';
import { seededRng } from '../public/levels.js';

test('every pattern fills whole bars, starts with a note, and only uses that level\'s rhythms', () => {
  for (const lv of RLEVELS) {
    const rng = seededRng(lv.id * 97);
    for (let i = 0; i < 40; i++) {
      const p = makePattern(lv, rng);
      assert.equal(patternBeats(p), BEATS_PER_BAR * lv.bars, `${lv.name} ${p}`);
      assert.ok(p[0] > 0, 'starts with a note');
      assert.ok(onsets(p).length >= 2);
      for (let k = 1; k < p.length; k++) assert.ok(!(p[k] < 0 && p[k - 1] < 0), 'never two rests in a row');
      const allowed = new Set(lv.cells.flat());
      assert.ok(p.every((d) => allowed.has(d)), `${lv.name} uses only its own note lengths`);
    }
  }
  assert.deepEqual(makeRound(1, seededRng(1))[0], [1, 1, 1, 1], 'the very first one is four steady beats');
  assert.equal(makeRound(5, seededRng(2)).length, ROUND_SIZE);
});

test('onsets put each note where it starts', () => {
  assert.deepEqual(onsets([1, 1, 2]), [0, 1, 2]);
  assert.deepEqual(onsets([1, -1, 0.5, 0.5, 1]), [0, 2, 2.5, 3]);
  assert.deepEqual(onsets([0.5, 1, 0.5, -0.5, 0.5, 1]), [0, 0.5, 1.5, 2.5, 3]);
});

test('taps are marked by timing; rests that get tapped and missing notes cost points', () => {
  const exp = [0, 0.75, 1.5, 2.25];
  const spotOn = scoreTaps(exp, [0.02, 0.76, 1.49, 2.26]);
  assert.equal(spotOn.accuracy, 100); assert.ok(spotOn.notes.every((n) => n.grade === 'perfect'));
  assert.equal(rhythmStars(spotOn.accuracy), 3);
  const late = scoreTaps(exp, [0.12, 0.87, 1.62, 2.37]);
  assert.ok(late.notes.every((n) => n.grade === 'good')); assert.equal(late.lean, 'late');
  const missed = scoreTaps(exp, [0, 0.75]);
  assert.equal(missed.notes.filter((n) => n.grade === 'miss').length, 2); assert.equal(missed.accuracy, 50);
  const extra = scoreTaps(exp, [0, 0.4, 0.75, 1.1, 1.5, 2.25]);
  assert.equal(extra.extra, 2); assert.ok(extra.accuracy < 90, 'tapping on a rest is not free');
  assert.equal(scoreTaps(exp, []).accuracy, 0);
  assert.equal(scoreTaps(exp, [5, 6, 7]).notes.every((n) => n.grade === 'miss'), true, 'far away taps do not count');
  assert.equal(rhythmStars(54), 0); assert.equal(rhythmStars(55), 1); assert.equal(rhythmStars(80), 2);
});
