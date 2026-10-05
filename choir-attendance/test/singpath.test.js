import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, pathDeck, FREE_UNITS } from '../public/singpath.js';

const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pc = (m) => ((m % 12) + 12) % 12;

test('the course has 12 units, each with a lesson, a goal and a drill', () => {
  assert.equal(UNITS.length, 12);
  assert.deepEqual(UNITS.map((u) => u.id), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(FREE_UNITS, 2);
  for (const u of UNITS) {
    assert.ok(u.name && u.goal && u.lessons.length >= 2, `unit ${u.id}`);
    for (const l of u.lessons) {
      assert.ok(l.title && l.text.length > 40, `unit ${u.id} lesson text`);
      if (l.demo) assert.ok(l.demo.notes.length >= 1 && l.demo.notes.every((m) => m >= 48 && m <= 84) && l.demo.label);
    }
  }
});

test('every unit builds a quiz and a free practice with sensible challenges', () => {
  for (const u of UNITS) {
    const quiz = pathDeck(u.id, { rng: seeded(u.id) });
    const practice = pathDeck(u.id, { rng: seeded(u.id + 50), relaxed: true });
    assert.equal(quiz.length, u.count);
    assert.equal(practice.length, 10);
    assert.ok(practice[0].tol >= quiz[0].tol, 'practice is more forgiving than the quiz');
    for (const c of [...quiz, ...practice]) {
      assert.ok(c.title && c.how && c.play && c.targets.length >= 1, `unit ${u.id}`);
      assert.ok(c.targets.every((t) => Number.isInteger(t) && t >= 0 && t < 12));
      assert.equal(c.timed, false);
      assert.ok(c.tol >= 20 && c.tol <= 50 && c.hold >= 300);
    }
  }
});

test('interval units ask for exactly the interval they teach (4ths are 5 semitones, and so on)', () => {
  const semis = { 3: [2], 5: [5], 6: [7] };
  for (const [id, allowed] of Object.entries(semis)) {
    for (const c of pathDeck(Number(id), { rng: seeded(7), count: 30 }).filter((x) => !x.review)) {
      assert.ok(allowed.includes(c.semis), `unit ${id}: ${c.semis}`);
      assert.equal(c.targets[0], pc(c.start + c.semis));
      assert.equal(c.play.midi, c.start);
    }
  }
  for (const c of pathDeck(4, { rng: seeded(3), count: 30 }).filter((x) => !x.review)) { assert.ok([3, 4].includes(c.semis)); assert.equal(c.targets[0], pc(c.start + c.semis)); }
  for (const c of pathDeck(8, { rng: seeded(5), count: 30 }).filter((x) => !x.review)) { assert.ok(c.semis < 0, 'going down'); assert.equal(c.targets[0], pc(c.start + c.semis)); assert.match(c.how, /below/); }
  for (const c of pathDeck(9, { rng: seeded(9), count: 30 }).filter((x) => !x.review)) { assert.ok([2, 4, 5, 7, 9, 11, 12].includes(c.semis)); assert.equal(c.targets[0], pc(c.start + c.semis)); assert.match(c.how, /Re|Mi|Fa|Sol|La|Ti|Do/); }
  for (const c of pathDeck(10, { rng: seeded(2), count: 30 }).filter((x) => !x.review)) { assert.ok([0, 4, 7].includes(c.semis)); assert.equal(c.play.type, 'chord'); assert.equal(c.play.quality, 'major'); }
  for (const c of pathDeck(11, { rng: seeded(4), count: 30 }).filter((x) => !x.review)) { assert.ok([0, 3, 7].includes(c.semis)); assert.equal(c.play.quality, 'minor'); }
  for (const c of pathDeck(12, { rng: seeded(6), count: 20 }).filter((x) => !x.review)) { assert.ok(c.targets.length >= 3 && c.targets.length === c.play.notes.length); c.play.notes.forEach((m, i) => assert.equal(c.targets[i], pc(m))); }
});

test('every quiz revises earlier units (about a third) and always starts with the new skill; unit 1 has nothing to revise', () => {
  assert.ok(pathDeck(1, { rng: seeded(1) }).every((c) => !c.review));
  for (const u of UNITS.filter((x) => x.id > 1)) {
    const d = pathDeck(u.id, { rng: seeded(u.id * 7), count: 12 });
    const rev = d.filter((c) => c.review);
    assert.equal(rev.length, 4, `unit ${u.id}: a third of 12`);
    assert.equal(d[0].review, false, 'starts with the new skill');
    assert.ok(rev.every((c) => c.from < u.id && /^Review · /.test(c.how)), 'revision comes from earlier units only');
  }
  // the most recent units are revised more often than the oldest
  let recent = 0, oldest = 0;
  for (let k = 0; k < 40; k++) for (const c of pathDeck(9, { rng: seeded(k + 100), count: 12 }).filter((x) => x.review)) { if (c.from >= 7) recent += 1; if (c.from <= 2) oldest += 1; }
  assert.ok(recent > oldest, `recent ${recent} vs oldest ${oldest}`);
  assert.ok(UNITS.every((u) => typeof u.fact === 'string' && u.fact.length > 20), 'each unit teaches a fact');
});
