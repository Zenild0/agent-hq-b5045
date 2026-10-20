import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeXp, weekKey, DAILY_GOAL, DAY_CAP, titleFor, LEADERBOARD_ON } from '../public/xp.js';

const make = (start = '2026-10-05') => { // a Monday
  let day = start, data = null;
  const x = makeXp({ load: () => data, save: (v) => { data = JSON.parse(JSON.stringify(v)); } }, () => day);
  return { x, setDay: (d) => { day = d; }, raw: () => data };
};
const goal = (x) => { x.award('lesson', { unit: Math.random() }); x.award('quiz', { passed: true, stars: 2 }); }; // 10 + 30 = 40 XP, over the goal

test('the leaderboard is switched off for now, and the daily goal is small', () => {
  assert.equal(LEADERBOARD_ON, false);
  assert.ok(DAILY_GOAL <= 15);
});

test('XP: a first lesson is worth more than a repeat; quiz stars add more; failing still earns a little', () => {
  const { x } = make();
  assert.equal(x.award('lesson', { unit: 3 }).gained, 10);
  assert.equal(x.award('lesson', { unit: 3 }).gained, 2);
  assert.equal(x.award('practice', { won: 7 }).gained, 12);
  assert.equal(x.award('quiz', { passed: true, stars: 3 }).gained, 35);
  assert.equal(x.award('quiz', { passed: false, won: 2 }).gained, 5);
  assert.equal(x.award('quiz', { passed: true, stars: 2, review: 3 }).gained, 33, 'revision notes add a point each');
});

test('daily cap: a day never counts more than the cap', () => {
  const { x } = make();
  let total = 0;
  for (let i = 0; i < 20; i++) total += x.award('quiz', { passed: true, stars: 3 }).gained;
  assert.equal(total, DAY_CAP);
  assert.equal(x.award('quiz', { passed: true, stars: 3 }).gained, 0);
  assert.equal(x.view().total, DAY_CAP);
});

test('streak: counts days the goal is reached; a missed day is forgiven once a week; two misses reset it', () => {
  const { x, setDay } = make('2026-10-05'); // Monday
  goal(x); assert.equal(x.view().streak, 1);
  setDay('2026-10-06'); goal(x); assert.equal(x.view().streak, 2);
  setDay('2026-10-08'); // Thursday: Wednesday was missed, but this week's forgiveness is unused
  assert.equal(x.view().streak, 2, 'still alive before practising');
  goal(x); assert.equal(x.view().streak, 3, 'the missed day was forgiven');
  setDay('2026-10-10'); // Saturday: Friday missed, forgiveness already used this week
  assert.equal(x.view().streak, 0, 'a second missed day in the same week ends the streak');
  goal(x); assert.equal(x.view().streak, 1);
  assert.equal(x.view().best, 3);
  setDay('2026-10-12'); // next Monday: Sunday missed, a fresh week, forgiven again
  assert.equal(x.view().streak, 1);
  goal(x); assert.equal(x.view().streak, 2);
  setDay('2026-10-16'); // two days missed
  assert.equal(x.view().streak, 0);
});

test('a little practice below the goal does not count for the streak', () => {
  const { x } = make();
  x.award('practice', { won: 0 }); // 5 XP
  assert.equal(x.view().streak, 0);
  assert.equal(x.view().goalMet, false);
  x.award('practice', { won: 0 }); x.award('practice', { won: 0 });
  assert.equal(x.view().goalMet, true);
  assert.equal(x.view().streak, 1);
});

test('titles, badges and the explorer badge for trying both games', () => {
  const { x } = make();
  assert.equal(titleFor(0), 'Newcomer');
  assert.equal(titleFor(250), 'Chorister');
  const a = x.award('lesson', { unit: 1, game: 'course' });
  assert.ok(a.newBadges.some((b) => b.id === 'first_lesson'));
  const b = x.award('quiz', { passed: true, stars: 3, game: 'notation', reading: true });
  assert.deepEqual(b.newBadges.map((n) => n.id).sort(), ['explorer', 'first_pass', 'perfect', 'reader'].sort());
  assert.ok(!x.award('quiz', { passed: true, stars: 3 }).newBadges.some((n) => n.id === 'perfect'), 'a badge is given once');
  const v = x.view();
  assert.ok(v.badges.find((n) => n.id === 'perfect').got);
});

test('week keys follow the ISO week (Monday first)', () => {
  assert.equal(weekKey('2026-10-05'), weekKey('2026-10-11'));
  assert.notEqual(weekKey('2026-10-11'), weekKey('2026-10-12'));
  assert.equal(weekKey('2026-01-01'), '2026-W01');
});

test('it survives broken saved data', () => {
  const x = makeXp({ load: () => { throw new Error('bad json'); }, save: () => {} }, () => '2026-10-05');
  assert.equal(x.view().total, 0);
  assert.equal(x.award('lesson', { unit: 1 }).gained, 10);
});
