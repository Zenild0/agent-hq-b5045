import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyGame, applyRound, applyDaily, weeklyBoard, dailyBoard, weekKeyOf, dailySeed, maxPlayable, GameError, dailyStreak } from '../lib/game.js';
import { LEVELS, DAILY_COUNT } from '../public/levels.js';

const round = (n, { won = n, ms = 3000, err = 20, hints = 0, limit = 15000 } = {}) =>
  Array.from({ length: n }, (_, i) => ({ won: i < won, ms: i < won ? ms : limit, err: i < won ? err : null, hints, limit }));
const count = (lv) => LEVELS[lv - 1].count;

test('levels unlock one at a time', () => {
  const g = emptyGame();
  assert.throws(() => applyRound(g, 'a', 2, round(count(2)), '2026-10-05'), GameError);
  const r1 = applyRound(g, 'a', 1, round(count(1)), '2026-10-05');
  assert.equal(r1.score.pass, true);
  assert.deepEqual(g.kids.a.cleared, [1]);
  assert.equal(maxPlayable(g.kids.a), 2);
  assert.throws(() => applyRound(g, 'a', 3, round(count(3)), '2026-10-05'), GameError);
  applyRound(g, 'a', 2, round(count(2)), '2026-10-05');
  assert.deepEqual(g.kids.a.cleared, [1, 2]);
});

test('below 70% does not clear a level, but the best round is still kept', () => {
  const g = emptyGame();
  applyRound(g, 'a', 1, round(7, { won: 4 }), '2026-10-05');
  assert.deepEqual(g.kids.a.cleared, []);
  assert.equal(g.kids.a.best[1].won, 4);
  applyRound(g, 'a', 1, round(7, { won: 5, ms: 6000 }), '2026-10-06');
  assert.equal(g.kids.a.best[1].won, 5);
  applyRound(g, 'a', 1, round(7, { won: 5, ms: 2000 }), '2026-10-06');
  assert.ok(g.kids.a.best[1].ms < 6000 * 5 + 2 * 15000, 'faster round with the same matches replaces it');
  applyRound(g, 'a', 1, round(7, { won: 3 }), '2026-10-06');
  assert.equal(g.kids.a.best[1].won, 5, 'a worse round never replaces the best');
});

test('bad reports are refused', () => {
  const g = emptyGame();
  assert.throws(() => applyRound(g, 'a', 1, round(3), '2026-10-05'), GameError, 'wrong length');
  assert.throws(() => applyRound(g, 'a', 1, round(7).map((r) => ({ ...r, ms: 50 })), '2026-10-05'), GameError, 'impossibly fast');
  assert.throws(() => applyRound(g, 'a', 1, round(7).map((r) => ({ ...r, limit: 1 })), '2026-10-05'), GameError);
  assert.throws(() => applyRound(g, 'a', 99, round(7), '2026-10-05'), GameError);
  assert.throws(() => applyRound(g, 'a', 1, [{ won: 'yes' }, ...round(6)], '2026-10-05'), GameError);
  assert.equal(g.kids.a?.cleared?.length ?? 0, 0);
});

test('badges are earned from what really happened', () => {
  const g = emptyGame();
  const r = applyRound(g, 'a', 1, round(7), '2026-10-05');
  assert.deepEqual(r.newBadges.sort(), ['first_note'], 'no_hints needs level 2+');
  const r2 = applyRound(g, 'a', 2, round(7), '2026-10-05');
  assert.deepEqual(r2.newBadges, ['no_hints']);
  assert.equal(applyRound(g, 'a', 2, round(7), '2026-10-06').newBadges.length, 0, 'a badge is given once');
  // hints cost the "no hints" badge
  const h = emptyGame();
  applyRound(h, 'b', 1, round(7), '2026-10-05');
  assert.ok(!applyRound(h, 'b', 2, round(7, { hints: 1 }), '2026-10-05').newBadges.includes('no_hints'));
  // 10 in a row and perfect pitch need a level with enough notes
  for (const lv of [1, 2]) applyRound(h, 'b', lv, round(count(lv)), '2026-10-05');
  const l3 = applyRound(h, 'b', 3, round(10, { err: 6, ms: 1500 }), '2026-10-05');
  assert.ok(l3.newBadges.includes('ten_in_row') && l3.newBadges.includes('perfect_pitch') && l3.newBadges.includes('triple_star'), l3.newBadges.join());
  const sloppy = emptyGame();
  for (const lv of [1, 2]) applyRound(sloppy, 'c', lv, round(count(lv)), '2026-10-05');
  assert.ok(!applyRound(sloppy, 'c', 3, round(10, { err: 14 }), '2026-10-05').newBadges.includes('perfect_pitch'));
});

test('tier badges come with clearing level 6, 9, 11 and 12', () => {
  const g = emptyGame();
  const got = new Set();
  for (let lv = 1; lv <= 12; lv++) applyRound(g, 'a', lv, round(count(lv)), '2026-10-05').newBadges.forEach((b) => got.add(b));
  for (const b of ['amateur', 'pro', 'expert', 'legend']) assert.ok(got.has(b), b);
  assert.equal(maxPlayable(g.kids.a), 12);
});

test('weekly board: best round per level this week, shared sequential ranks', () => {
  const g = emptyGame();
  const kids = [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Cleo' }, { id: 'd', name: 'Dev' }];
  applyRound(g, 'a', 1, round(7, { ms: 3000 }), '2026-10-06'); // week 41
  applyRound(g, 'b', 1, round(7, { ms: 3000 }), '2026-10-07');
  applyRound(g, 'c', 1, round(7, { ms: 5000 }), '2026-10-08');
  applyRound(g, 'd', 1, round(7, { ms: 1000 }), '2026-10-04'); // last week: not on this week's board
  const w = weeklyBoard(g, kids, weekKeyOf('2026-10-08'), 1);
  assert.deepEqual(w.map((r) => [r.name, r.rank]), [['Anna', 1], ['Ben', 1], ['Cleo', 2]]);
  assert.deepEqual(weeklyBoard(g, kids, weekKeyOf('2026-10-04'), 1).map((r) => r.name), ['Dev']);
});

test('daily challenge: one try a day, same seed for everyone, streak badges', () => {
  const g = emptyGame();
  assert.equal(dailySeed('2026-10-05'), dailySeed('2026-10-05'));
  assert.notEqual(dailySeed('2026-10-05'), dailySeed('2026-10-06'));
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
  applyDaily(g, 'a', '2026-09-01', round(DAILY_COUNT));
  applyDaily(g, 'a', '2026-10-20', round(DAILY_COUNT));
  assert.ok(!g.daily['2026-09-01']);
  applyRound(g, 'a', 1, round(7), '2026-08-01');
  applyRound(g, 'a', 1, round(7), '2026-10-20');
  assert.deepEqual(Object.keys(g.kids.a.weekly), [weekKeyOf('2026-10-20')]);
});
