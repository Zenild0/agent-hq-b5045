import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyGame, setPaid, isPaid, resetWarmups, resetAllWarmups, paidUntilOf, daysLeft, useWarmup, warmupsLeft, PaywallError, applyRound, applyDaily, weeklyBoard, dailyBoard, weekKeyOf, dailySeed, maxPlayable, maxStage, GameError, dailyStreak } from '../lib/game.js';
import { LEVELS, DAILY_COUNT, stageSpec } from '../public/levels.js';

const round = (n, { won = n, ms = 3000, err = 20, hints = 0, limit = 15000 } = {}) =>
  Array.from({ length: n }, (_, i) => ({ won: i < won, ms: i < won ? ms : limit, err: i < won ? err : null, hints, limit }));
const count = (lv, st = 3) => stageSpec(lv, st).count;
const play = (g, id, lv, st, date, opts = {}) => {
  if (lv > 1 && !opts.unpaid) setPaid(g, id, true, date); // Level 1 is free; the rest needs the teacher's unlock
  return applyRound(g, id, lv, st, round(opts.n ?? count(lv, st), opts), date);
};
const clearLevel = (g, id, lv, date, opts) => [1, 2, 3].map((st) => play(g, id, lv, st, date, opts));

test('three stages per level, each one unlocks the next, and stage 3 clears the level', () => {
  const g = emptyGame();
  assert.throws(() => play(g, 'a', 1, 2, '2026-10-05'), GameError, 'stage 2 is locked');
  assert.throws(() => play(g, 'a', 2, 1, '2026-10-05'), GameError, 'level 2 is locked');
  play(g, 'a', 1, 1, '2026-10-05');
  assert.equal(maxStage(g.kids.a, 1), 2);
  assert.deepEqual(g.kids.a.cleared, []);
  assert.throws(() => play(g, 'a', 1, 3, '2026-10-05'), GameError, 'stage 3 is locked');
  play(g, 'a', 1, 2, '2026-10-05');
  const last = play(g, 'a', 1, 3, '2026-10-05');
  assert.equal(last.levelCleared, true);
  assert.deepEqual(g.kids.a.cleared, [1]);
  assert.equal(maxPlayable(g.kids.a), 2);
  assert.equal(maxStage(g.kids.a, 2), 1);
  assert.equal(maxStage(g.kids.a, 3), 0);
  assert.ok(count(1, 1) < count(1, 2) && count(1, 2) < count(1, 3));
});

test('below 70% does not clear a stage, but the best round is still kept', () => {
  const g = emptyGame();
  play(g, 'a', 1, 1, '2026-10-05', { won: 1 });
  assert.equal(maxStage(g.kids.a, 1), 1);
  assert.equal(g.kids.a.best['1.1'].won, 1);
  play(g, 'a', 1, 1, '2026-10-06', { won: 3, ms: 6000 });
  assert.equal(g.kids.a.best['1.1'].won, 3);
  assert.equal(maxStage(g.kids.a, 1), 2);
  play(g, 'a', 1, 1, '2026-10-06', { won: 2 });
  assert.equal(g.kids.a.best['1.1'].won, 3, 'a worse round never replaces the best');
});

test('bad reports are refused', () => {
  const g = emptyGame();
  assert.throws(() => applyRound(g, 'a', 1, 1, round(2), '2026-10-05'), GameError, 'wrong length');
  assert.throws(() => applyRound(g, 'a', 1, 1, round(count(1, 1)).map((r) => ({ ...r, ms: 50 })), '2026-10-05'), GameError, 'impossibly fast');
  assert.throws(() => applyRound(g, 'a', 1, 1, round(count(1, 1)).map((r) => ({ ...r, limit: 1 })), '2026-10-05'), GameError);
  assert.throws(() => applyRound(g, 'a', 99, 1, round(7), '2026-10-05'), GameError);
  assert.throws(() => applyRound(g, 'a', 1, 4, round(7), '2026-10-05'), GameError);
  assert.throws(() => applyRound(g, 'a', 1, 1, [{ won: 'yes' }, ...round(count(1, 1) - 1)], '2026-10-05'), GameError);
  assert.equal(g.kids.a?.cleared?.length ?? 0, 0);
});

test('badges are earned from what really happened', () => {
  const g = emptyGame();
  const first = play(g, 'a', 1, 1, '2026-10-05');
  assert.deepEqual(first.newBadges, ['first_note']);
  play(g, 'a', 1, 2, '2026-10-05');
  assert.deepEqual(play(g, 'a', 1, 3, '2026-10-05').newBadges, [], 'no_hints needs level 2+');
  clearLevel(g, 'a', 2, '2026-10-05');
  assert.ok(g.kids.a.badges.no_hints, 'cleared a showdown without hints');
  const h = emptyGame();
  clearLevel(h, 'b', 1, '2026-10-05');
  clearLevel(h, 'b', 2, '2026-10-05', { hints: 1 });
  assert.ok(!h.kids.b.badges.no_hints, 'hints cost the badge');
  // 10 in a row and perfect pitch need a level with enough notes; triple star needs the showdown
  const t = emptyGame();
  clearLevel(t, 'c', 1, '2026-10-05'); clearLevel(t, 'c', 2, '2026-10-05');
  play(t, 'c', 3, 1, '2026-10-05', { err: 6, ms: 1500 }); play(t, 'c', 3, 2, '2026-10-05', { err: 6, ms: 1500 });
  assert.ok(t.kids.c.badges.perfect_pitch && !t.kids.c.badges.triple_star);
  const l3 = play(t, 'c', 3, 3, '2026-10-05', { err: 6, ms: 1500 });
  assert.ok(l3.newBadges.includes('ten_in_row') && l3.newBadges.includes('triple_star'), l3.newBadges.join());
  const sloppy = emptyGame();
  clearLevel(sloppy, 'd', 1, '2026-10-05'); clearLevel(sloppy, 'd', 2, '2026-10-05');
  play(sloppy, 'd', 3, 1, '2026-10-05', { err: 14 });
  assert.ok(!sloppy.kids.d.badges.perfect_pitch);
});

test('tier badges come with clearing level 6, 9, 11 and 12', () => {
  const g = emptyGame();
  for (let lv = 1; lv <= 12; lv++) clearLevel(g, 'a', lv, '2026-10-05');
  for (const b of ['amateur', 'pro', 'expert', 'legend']) assert.ok(g.kids.a.badges[b], b);
  assert.equal(maxPlayable(g.kids.a), 12);
  assert.deepEqual(g.kids.a.cleared.length, 12);
});

test('weekly board: best round per level this week, shared sequential ranks', () => {
  const g = emptyGame();
  const kids = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cleo' }, { id: 'd', name: 'Dev' }];
  clearLevel(g, 'a', 1, '2026-10-06', { ms: 3000 }); // week 41
  clearLevel(g, 'b', 1, '2026-10-07', { ms: 3000 });
  clearLevel(g, 'c', 1, '2026-10-08', { ms: 5000 });
  clearLevel(g, 'd', 1, '2026-10-04', { ms: 1000 }); // last week: not on this week's board
  play(g, 'a', 1, 1, '2026-10-08', { ms: 100 + 400 }); // practice stages never count for the weekly board
  const w = weeklyBoard(g, kids, weekKeyOf('2026-10-08'), 1);
  assert.deepEqual(w.map((r) => [r.name, r.rank]), [['Anna', 1], ['Ben', 1], ['Cleo', 2]]);
  assert.deepEqual(weeklyBoard(g, kids, weekKeyOf('2026-10-04'), 1).map((r) => r.name), ['Dev']);
});

test('daily challenge: one try a day, same seed for everyone, streak badges', () => {
  const g = emptyGame();
  assert.equal(dailySeed('2026-10-05'), dailySeed('2026-10-05'));
  assert.notEqual(dailySeed('2026-10-05'), dailySeed('2026-10-06'));
  setPaid(g, 'a', true, '2026-10-05'); setPaid(g, 'b', true, '2026-10-05');
  const first = applyDaily(g, 'a', '2026-10-05', round(DAILY_COUNT, { won: 3 }));
  assert.equal(first.already, false);
  const again = applyDaily(g, 'a', '2026-10-05', round(DAILY_COUNT, { won: 6 }));
  assert.equal(again.already, true);
  assert.equal(g.daily['2026-10-05'].a.won, 3, 'the first try is the one that counts');
  assert.throws(() => applyDaily(g, 'a', '2026-10-06', round(3)), GameError);
  let last;
  for (const d of ['2026-10-06', '2026-10-07']) last = applyDaily(g, 'a', d, round(DAILY_COUNT, { won: 2 }));
  assert.ok(last.newBadges.includes('daily_3'));
  assert.equal(dailyStreak(g.kids.a, '2026-10-07'), 3);
  for (const d of ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']) last = applyDaily(g, 'a', d, round(DAILY_COUNT, { won: 2 }));
  assert.ok(last.newBadges.includes('daily_7'));
  applyDaily(g, 'b', '2026-10-11', round(DAILY_COUNT, { won: 5 }));
  assert.deepEqual(dailyBoard(g, [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }], '2026-10-11').map((r) => [r.name, r.rank]), [['Ben', 1], ['Anna', 2]]);
});

test('old data is tidied away', () => {
  const g = emptyGame();
  setPaid(g, 'a', true, '2026-08-01');
  applyDaily(g, 'a', '2026-09-01', round(DAILY_COUNT));
  applyDaily(g, 'a', '2026-10-20', round(DAILY_COUNT));
  assert.ok(!g.daily['2026-09-01']);
  clearLevel(g, 'a', 1, '2026-08-01');
  play(g, 'a', 1, 3, '2026-10-20');
  assert.deepEqual(Object.keys(g.kids.a.weekly), [weekKeyOf('2026-10-20')]);
});

test('Warm-up and Level 1 are free; level 2 onwards and the daily challenge need the teacher\'s unlock', () => {
  const g = emptyGame();
  clearLevel(g, 'a', 1, '2026-10-05'); // free
  assert.equal(isPaid(g.kids.a), false);
  assert.throws(() => applyRound(g, 'a', 2, 1, round(count(2, 1)), '2026-10-05'), PaywallError);
  assert.throws(() => applyDaily(g, 'a', '2026-10-05', round(DAILY_COUNT)), PaywallError);
  assert.equal(g.daily['2026-10-05']?.a, undefined, 'nothing recorded for the refused try');
  setPaid(g, 'a', true, '2026-10-06');
  assert.equal(g.kids.a.paidOn, '2026-10-06');
  applyRound(g, 'a', 2, 1, round(count(2, 1)), '2026-10-06');
  assert.equal(applyDaily(g, 'a', '2026-10-06', round(DAILY_COUNT, { won: 2 })).already, false);
  setPaid(g, 'a', false, '2026-10-07'); // locked again: progress is kept, play stops
  assert.deepEqual(g.kids.a.cleared, [1]);
  assert.throws(() => applyRound(g, 'a', 2, 2, round(count(2, 2)), '2026-10-07'), PaywallError);
  assert.equal(g.kids.a.paidOn, '');
});

test('levels 1 to 4 have no countdown, so slow rounds are fine; from level 5 a note cannot take longer than its countdown', () => {
  const slow = (n) => Array.from({ length: n }, () => ({ won: true, ms: 90000, limit: 14000, err: 15, hints: 0 }));
  const g = emptyGame();
  assert.doesNotThrow(() => applyRound(g, 'a', 1, 1, slow(count(1, 1)), '2026-10-05'), 'a minute and a half per note on level 1');
  assert.throws(() => applyRound(g, 'a', 1, 2, Array.from({ length: count(1, 2) }, () => ({ won: true, ms: 700000, limit: 14000, err: 15, hints: 0 })), '2026-10-05'), GameError, 'but not more than 10 minutes');
  clearLevel(g, 'a', 1, '2026-10-05'); clearLevel(g, 'a', 2, '2026-10-05'); clearLevel(g, 'a', 3, '2026-10-05'); clearLevel(g, 'a', 4, '2026-10-05');
  setPaid(g, 'a', true, '2026-10-05');
  assert.throws(() => applyRound(g, 'a', 5, 1, slow(count(5, 1)), '2026-10-05'), GameError, 'level 5 is timed');
  assert.doesNotThrow(() => applyRound(g, 'a', 5, 1, round(count(5, 1)), '2026-10-05'));
});

test('Warm-up: three free sessions (one per day), then it needs the full game', () => {
  const g = emptyGame();
  assert.equal(useWarmup(g, 'a', '2026-10-05').left, 2);
  assert.equal(useWarmup(g, 'a', '2026-10-05').left, 2, 'the same day is the same session');
  assert.equal(useWarmup(g, 'a', '2026-10-06').left, 1);
  assert.equal(useWarmup(g, 'a', '2026-10-07').left, 0);
  assert.equal(useWarmup(g, 'a', '2026-10-07').left, 0, 'today is still allowed');
  assert.throws(() => useWarmup(g, 'a', '2026-10-08'), PaywallError);
  setPaid(g, 'a', true, '2026-10-08');
  assert.equal(useWarmup(g, 'a', '2026-10-08').left, null, 'unlimited once unlocked');
  assert.equal(warmupsLeft(g.kids.a), null);
  setPaid(g, 'a', false, '2026-10-09');
  assert.throws(() => useWarmup(g, 'a', '2026-10-09'), PaywallError, 'locked again: the free sessions are still used up');
});

test('every stage keeps the best three scores with the date only', () => {
  const g = emptyGame();
  const run = (date, won, ms) => play(g, 'a', 1, 1, date, { won, ms });
  run('2026-10-05', 3, 9000);   // 3 of 4
  run('2026-10-06', 4, 8000);   // best so far
  run('2026-10-07', 4, 5000);   // better
  run('2026-10-08', 2, 1000);   // worse than all three: not kept once there are four
  run('2026-10-09', 4, 6000);
  const top = g.kids.a.top['1.1'];
  assert.equal(top.length, 3);
  assert.deepEqual(top.map((t) => [t.won, t.ms / count(1, 1), t.on]), [[4, 5000, '2026-10-07'], [4, 6000, '2026-10-09'], [4, 8000, '2026-10-06']]);
  assert.deepEqual(Object.keys(top[0]).sort(), ['stars', 'ms', 'on', 'won'].sort(), 'only scores and the date: no time of day, nothing else');
  assert.deepEqual(g.kids.a.best['1.1'], top[0], 'the single best stays in step');
  assert.ok(!g.kids.a.top['1.2'], 'each stage has its own list');
});

test('the full game is for one year: it ends after 365 days and can be renewed', () => {
  const g = emptyGame();
  clearLevel(g, 'a', 1, '2026-10-05');
  setPaid(g, 'a', true, '2026-10-05');
  const kid = g.kids.a;
  assert.equal(paidUntilOf(kid), '2027-10-05');
  assert.equal(isPaid(kid, '2027-10-04'), true, 'the last day of the year is still included');
  assert.equal(isPaid(kid, '2027-10-05'), false, '365 days later it has ended');
  assert.equal(daysLeft(kid, '2027-09-05'), 30);
  applyRound(g, 'a', 2, 1, round(count(2, 1)), '2027-10-04');
  assert.throws(() => applyRound(g, 'a', 2, 2, round(count(2, 2)), '2027-10-05'), PaywallError, 'level 2 needs a renewal');
  assert.throws(() => applyDaily(g, 'a', '2027-10-05', round(DAILY_COUNT)), PaywallError);
  assert.deepEqual(g.kids.a.cleared, [1], 'progress is kept when the year ends');
  assert.equal(g.kids.a.best['2.1'].won, count(2, 1), 'and so are the scores');
  // renewing after it ended: a new year from the renewal day
  setPaid(g, 'a', true, '2027-11-01');
  assert.equal(paidUntilOf(kid), '2028-10-31'); // 365 days (2028 is a leap year)
  assert.doesNotThrow(() => applyRound(g, 'a', 2, 2, round(count(2, 2)), '2027-11-02'));
  // renewing early adds a year to the end date, so nothing is lost
  setPaid(g, 'a', true, '2028-10-15');
  assert.equal(paidUntilOf(kid), '2029-10-31');
  setPaid(g, 'a', false, '2028-10-16');
  assert.equal(isPaid(kid, '2028-10-16'), false);
  assert.equal(kid.paidUntil, '');
});

test('a round reports a new personal best only when it beats the previous best', () => {
  const g = emptyGame();
  assert.equal(play(g, 'a', 1, 1, '2026-10-05', { ms: 5000 }).personalBest, true, 'the first round is a best');
  assert.equal(play(g, 'a', 1, 1, '2026-10-06', { ms: 6000 }).personalBest, false);
  assert.equal(play(g, 'a', 1, 1, '2026-10-07', { ms: 4000 }).personalBest, true);
});

test('the teacher can give a child their three free Warm-up sessions again', () => {
  const g = emptyGame();
  for (const d of ['2026-10-05', '2026-10-06', '2026-10-07']) useWarmup(g, 'a', d);
  assert.throws(() => useWarmup(g, 'a', '2026-10-08'), PaywallError);
  resetWarmups(g, 'a');
  assert.equal(warmupsLeft(g.kids.a, '2026-10-08'), 3);
  assert.equal(useWarmup(g, 'a', '2026-10-08').left, 2);
});

test('the teacher can reset the free Warm-up sessions for everyone at once', () => {
  const g = emptyGame();
  for (const id of ['a', 'b']) for (const d of ['2026-10-05', '2026-10-06', '2026-10-07']) useWarmup(g, id, d);
  useWarmup(g, 'c', '2026-10-05'); // c has used one; d has not used any
  useWarmup(g, 'd', '2026-10-05'); resetWarmups(g, 'd');
  assert.equal(resetAllWarmups(g), 3);
  for (const id of ['a', 'b', 'c', 'd']) assert.equal(warmupsLeft(g.kids[id], '2026-10-08'), 3, id);
});
