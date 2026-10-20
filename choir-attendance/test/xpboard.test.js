import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-xp-')), 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const day = (n = 0) => new Date(Date.now() + 330 * 60000 - n * 86400000).toISOString().slice(0, 10);

test('the leaderboard is off by default: nothing is stored and nobody is ranked', async () => {
  const c = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Off Child' } })).data;
  assert.equal((await j('/api/public')).data.settings.trainingBoardEnabled, false);
  const r = await j('/api/me/xp', { method: 'POST', code: c.code, body: { days: { [day()]: 40 } } });
  assert.deepEqual(r.data, { enabled: false });
  assert.deepEqual((await j('/api/me/xp-board', { code: c.code })).data, { enabled: false });
  assert.equal((await j('/api/me/access', { code: c.code })).data.board, false);
});

test('switched on: only paid children are ranked, the daily cap and date rules hold, unpaid see a locked card', async () => {
  const mk = async (name, paid) => { const c = (await j('/api/teacher/children', { method: 'POST', body: { name } })).data; if (paid) await j(`/api/teacher/children/${c.id}/game`, { method: 'PUT', body: { paid: true } }); return c; };
  const maya = await mk('Maya Paid', true), ben = await mk('Ben Paid', true), cara = await mk('Cara Free', false);
  await j('/api/teacher/occasions', { method: 'POST', body: { name: 'Event', members: [], guests: 'Gus Guest' } });
  const gus = (await j('/api/teacher/children')).data.children.find((c) => c.name === 'Gus Guest');
  await j(`/api/teacher/children/${gus.id}/game`, { method: 'PUT', body: { paid: true } });
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { trainingBoardEnabled: true } })).status, 200);
  assert.equal((await j('/api/public')).data.settings.trainingBoardEnabled, true);
  const post = (c, body) => j('/api/me/xp', { method: 'POST', code: c.code, body });
  // the cap: 400 reported for one day counts as 150
  assert.equal((await post(maya, { days: { [day()]: 400 }, streak: 5, best: 7, units: 3 })).data.accepted, 150);
  assert.equal((await post(maya, { days: { [day()]: 50 } })).data.accepted, 0, 'the day is full');
  // a day from last month and a day in the future are ignored; yesterday counts
  assert.equal((await post(ben, { days: { [day(40)]: 100, [day(-3)]: 100, [day(1)]: 60 } })).data.accepted, 60);
  await post(cara, { days: { [day()]: 90 } });
  await post(gus, { days: { [day()]: 120 } });
  const board = (await j('/api/me/xp-board', { code: maya.code })).data;
  assert.equal(board.enabled, true);
  assert.equal(board.locked, false);
  const names = board.all.top.map((r) => r.name);
  assert.deepEqual(names, ['Maya Paid', 'Ben Paid'], 'ranked by XP; the unpaid child and the guest are not on it');
  assert.equal(board.all.top[0].rank, 1);
  assert.equal(board.all.top[0].streak, 5);
  assert.ok(!('contact' in board.all.top[0]) && !('code' in board.all.top[0]));
  assert.match(board.weekLabel, /^\d{4}-W\d{2}$/);
  assert.equal(board.all.total, 2);
  // an unpaid child sees only a locked card, no names
  const locked = (await j('/api/me/xp-board', { code: cara.code })).data;
  assert.deepEqual(Object.keys(locked).sort(), ['enabled', 'locked', 'price']);
  // junk is refused
  assert.equal((await post(maya, { days: 'x' })).status, 200);
  assert.equal((await j('/api/me/xp-board', { code: 'NOPE' })).status, 401);
});

test('the teacher sees a practice report with who is practising and who has gone quiet', async () => {
  const r = (await j('/api/teacher/practice')).data;
  assert.equal(r.enabled, true);
  assert.ok(r.practised >= 3);
  assert.equal(r.rows[0].name, 'Maya Paid');
  assert.ok(r.quiet.includes('Off Child'), 'a child who never practised is listed as quiet');
  assert.ok(r.bestStreak >= 5);
});
