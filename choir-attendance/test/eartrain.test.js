import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EAR_LEVELS, makeEarQuestion, makeEarRound, earStars, JUMPS, EAR_ROUND } from '../public/eartrain.js';
import { seededRng } from '../public/levels.js';

test('every question has the right answer for its notes, in a comfortable range', () => {
  for (const lv of EAR_LEVELS) {
    const rng = seededRng(lv.id * 31);
    for (let i = 0; i < 200; i++) {
      const q = makeEarQuestion(lv.id, rng), [a, b] = q.notes, gap = b - a;
      assert.ok(a >= 43 && b >= 43 && a <= 79 && b <= 79, `range ${q.notes}`);
      assert.ok(q.choices.some((c) => c.id === q.answer), 'the answer is one of the buttons');
      if (lv.id <= 2) assert.equal(q.answer, gap > 0 ? 'up' : 'down');
      if (lv.id === 1) assert.ok(Math.abs(gap) >= 5, 'level 1: far apart');
      if (lv.id === 2) assert.ok(Math.abs(gap) >= 1 && Math.abs(gap) <= 4, 'level 2: close');
      if (lv.id === 3) assert.equal(q.answer, gap === 0 ? 'same' : 'diff');
      if (lv.id === 4) assert.equal(q.answer, gap === 0 ? 'same' : gap > 0 ? 'up' : 'down');
      if (lv.id === 5) assert.equal(q.answer, Math.abs(gap) <= 2 ? 'step' : 'leap');
      if (lv.id === 6) assert.equal(JUMPS.find((j) => j.id === q.answer).semis, gap);
    }
  }
});

test('a round has ten questions and stars follow the score', () => {
  const r = makeEarRound(3, seededRng(9));
  assert.equal(r.length, EAR_ROUND);
  for (let i = 1; i < r.length; i++) assert.notEqual(r[i].notes.join(), r[i - 1].notes.join());
  assert.deepEqual([earStars(10), earStars(9), earStars(7), earStars(5), earStars(4)], [3, 3, 2, 1, 0]);
});
