import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildDeck, makeTracker, centsTo, NAMES, stageSpec, titleFor, PIANO_KEYS, isTimed } from '../public/levels.js';

const rng = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('twelve levels, each harder: the allowed error never grows', () => {
  assert.equal(LEVELS.length, 12);
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].tol <= LEVELS[i - 1].tol, `level ${i + 1}`);
  assert.deepEqual([...new Set(LEVELS.map((l) => l.tier))], ['Beginner', 'Amateur', 'Pro', 'Expert', 'Legend']);
});

test('every level builds a sensible round', () => {
  for (const lv of LEVELS) {
    const deck = buildDeck(lv.id, rng(lv.id));
    assert.equal(deck.length, lv.count, `level ${lv.id} count`);
    for (const c of deck) {
      assert.ok(c.targets.length >= 1 && c.targets.every((t) => t >= 0 && t < 12));
      assert.ok(c.limit >= 5 && c.hold >= 400);
      assert.equal(c.tol, stageSpec(lv.id, 3).tol);
      assert.ok(c.play.type);
    }
  }
  assert.deepEqual(buildDeck(1).map((c) => c.targets[0]), [0, 2, 4, 5, 7, 9, 11]); // C D E F G A B in order
  assert.equal(new Set(buildDeck(3, rng(3)).map((c) => c.targets[0])).size, 10);   // no repeats
});

test('third and fifth target the right note of the chord', () => {
  const third = buildDeck(5, rng(7));
  for (const c of third) {
    const root = c.play.root % 12;
    assert.equal(c.targets[0], (root + (c.play.quality === 'minor' ? 3 : 4)) % 12, c.title);
  }
  const l6 = buildDeck(6, rng(9));
  l6.forEach((c, i) => assert.equal(c.targets[0], (c.play.root % 12 + (i % 2 ? 7 : (c.play.quality === 'minor' ? 3 : 4))) % 12));
});

test('interval and echo targets follow what was played', () => {
  for (const c of buildDeck(8, rng(11))) {
    assert.ok(c.play.type === 'note');
    assert.notEqual(c.targets[0], c.play.midi % 12);
  }
  for (const c of buildDeck(10, rng(13))) {
    assert.equal(c.play.notes.length, 4);
    assert.deepEqual(c.targets, c.play.notes.map((m) => m % 12));
    assert.ok(c.blind);
  }
  assert.ok(buildDeck(7, rng(5)).every((c) => c.targets.length === 3));
  assert.ok(buildDeck(9, rng(2)).every((c) => c.delayMs === 4000));
});

test('level 12 mixes kinds', () => {
  const kinds = new Set(buildDeck(12, rng(21)).map((c) => c.kind));
  assert.ok(kinds.size >= 3);
});

test('centsTo ignores octaves', () => {
  assert.equal(centsTo(60, 0), 0);
  assert.equal(centsTo(72, 0), 0);
  assert.equal(centsTo(48.25, 0), 25);
  assert.equal(centsTo(61, 0), 100);
  assert.equal(centsTo(66, 0), 600);
});

const feedFor = (tr, from, to, midi, step = 16) => { let r; for (let t = from; t <= to; t += step) r = tr.feed(t, midi); return r; };

test('a note counts after the hold time, only inside the margin', () => {
  const ch = { targets: [0], tol: 30, hold: 500 };
  let tr = makeTracker(ch);
  assert.equal(feedFor(tr, 0, 400, 60).done, false);
  assert.equal(feedFor(tr, 416, 600, 60).done, true);
  tr = makeTracker(ch);
  assert.equal(feedFor(tr, 0, 2000, 60.4).done, false, '40 cents off is outside a 30 cent margin');
  tr = makeTracker(ch);
  assert.equal(feedFor(tr, 0, 600, 60.25).done, true);
  tr = makeTracker(ch); // wobbling out of range resets the hold
  feedFor(tr, 0, 300, 60); feedFor(tr, 316, 400, 63); 
  assert.equal(feedFor(tr, 416, 800, 60).done, false);
});

test('a melody must be sung in order, and a repeated note needs a gap', () => {
  const ch = { targets: [0, 2, 2], tol: 30, hold: 300 };
  const tr = makeTracker(ch);
  assert.equal(feedFor(tr, 0, 350, 62).step, 0, 'D first does not count');
  assert.equal(feedFor(tr, 366, 700, 60).step, 1);
  assert.equal(feedFor(tr, 716, 1100, 62).step, 2);
  assert.equal(feedFor(tr, 1116, 2000, 62).done, false, 'holding D longer does not repeat the note');
  feedFor(tr, 2016, 2200, null);
  assert.equal(feedFor(tr, 2216, 2600, 62).done, true);
});

test('a long steady hold needs the whole time', () => {
  const ch = { targets: [7], tol: 12, hold: 3000 };
  const tr = makeTracker(ch);
  assert.equal(feedFor(tr, 0, 2900, 67).done, false);
  assert.equal(feedFor(tr, 2916, 3100, 67).done, true);
  const wobbly = makeTracker(ch);
  feedFor(wobbly, 0, 2000, 67); feedFor(wobbly, 2016, 2100, 67.3);
  assert.equal(feedFor(wobbly, 2116, 4500, 67).done, false);
  assert.equal(feedFor(wobbly, 4516, 5200, 67).done, true);
});

test('three stages per level: shorter and gentler first, the full level last', () => {
  for (const lv of LEVELS) {
    const [a, b, c] = [1, 2, 3].map((st) => stageSpec(lv.id, st));
    assert.ok(a.count >= 3 && a.count <= b.count && b.count <= c.count, `level ${lv.id} counts`);
    assert.equal(c.count, lv.count);
    assert.ok(a.tol >= b.tol && b.tol >= c.tol, `level ${lv.id} margins shrink`);
    assert.ok(c.tol >= 10 && a.tol <= 50);
    assert.equal(buildDeck(lv.id, rng(3), 1).length, a.count);
    assert.equal(buildDeck(lv.id, rng(3), 2).length, b.count);
  }
  assert.deepEqual(buildDeck(1, rng(1), 1).map((c) => c.targets[0]), [0, 2, 4, 5]); // the first notes of C to B
});

test('your title follows the highest level cleared, and every level has a piano key', () => {
  assert.equal(titleFor(0), 'Newcomer');
  assert.deepEqual([1, 3, 4, 6, 7, 9, 10, 11, 12].map(titleFor), ['Beginner', 'Beginner', 'Amateur', 'Amateur', 'Pro', 'Pro', 'Expert', 'Expert', 'Legend']);
  assert.equal(PIANO_KEYS.length, LEVELS.length);
});

test('levels 1 to 4 are untimed, level 5 and up are timed', () => {
  assert.deepEqual(LEVELS.map((l) => isTimed(l.id)), [false, false, false, false, ...Array(8).fill(true)]);
  for (const lv of LEVELS) assert.ok(buildDeck(lv.id, rng(2)).every((c) => c.timed === isTimed(lv.id)));
});

test('praise is earned: none for a round that was not passed, and it grows with the score', async () => {
  const { praiseFor } = await import('../public/levels.js');
  const first = (a) => a[0];
  const base = { pass: true, stars: 1, won: 6, count: 7, hints: 1, avgErr: 25, personalBest: false, rank: null };
  assert.equal(praiseFor({ ...base, pass: false, stars: 1 }, first).tier, 'try');
  const fail = praiseFor({ ...base, pass: false, personalBest: true, rank: 1 }, first);
  assert.ok(fail.title.startsWith('Good try') && fail.title.toLowerCase().includes('warm'));
  assert.deepEqual(fail.extras.length, 1, 'only an encouraging tip: no best or board lines without passing');
  assert.ok(fail.extras[0].startsWith('Tip'));
  assert.ok(praiseFor({ ...base, pass: false, won: 0 }, first).extras[0].includes('Singer hint'));
  assert.equal(praiseFor(base, first).tier, 'well');
  assert.equal(praiseFor({ ...base, stars: 2 }, first).title, 'You Rock! 🎸');
  assert.equal(praiseFor({ ...base, stars: 3 }, first).title, 'U R A Star! ⭐');
  assert.equal(praiseFor({ ...base, stars: 3, won: 7, hints: 0, avgErr: 8 }, first).tier, 'perfect');
  assert.equal(praiseFor({ ...base, stars: 3, won: 7, hints: 0, avgErr: 14 }, first).tier, 'star', 'perfect needs real accuracy');
  const ex = praiseFor({ ...base, personalBest: true, rank: 1 }, first).extras;
  assert.ok(ex.some((x) => x.includes('personal best')) && ex.some((x) => x.includes('No. 1')));
  assert.ok(praiseFor({ ...base, rank: 3 }, first).extras.some((x) => x.includes('No. 3')));
  assert.equal(praiseFor({ ...base, rank: 5 }, first).extras.length, 0);
});
