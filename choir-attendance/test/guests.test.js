import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-guests-')), 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());
const j = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(base + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('guests are added to a new or existing event, with a code each, and a duplicate gets a friendly message', async () => {
  const main = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Main Child' } })).data;
  assert.equal((await j('/api/teacher/guests', { method: 'POST', body: { text: 'Nobody' } })).status, 400, 'an event is required');
  const r1 = await j('/api/teacher/guests', { method: 'POST', body: { text: 'Asha Rao\nBen Mehta, 5th', newEvent: 'Feast Day' } });
  assert.equal(r1.status, 201);
  assert.equal(r1.data.added.length, 2);
  assert.ok(r1.data.added.every((g) => g.guest && g.code));
  assert.equal(r1.data.added[1].standard, '5th');
  const ev = r1.data.event;
  const r2 = await j('/api/teacher/guests', { method: 'POST', body: { text: 'Asha Rao\nMain Child\nCara Das', eventId: ev.id } });
  assert.equal(r2.data.added.length, 1);
  assert.equal(r2.data.skipped.length, 2);
  assert.match(r2.data.skipped[0].reason, /already a guest/);
  assert.match(r2.data.skipped[1].reason, /already in the choir/);
  const gv = (await j('/api/teacher/guests')).data;
  assert.equal(gv.events.length, 1);
  assert.deepEqual(gv.events[0].guests.map((g) => g.name).sort(), ['Asha Rao', 'Ben Mehta', 'Cara Das']);
  void main;
});

test('a guest can join another event, be archived, and never shows in the main roster', async () => {
  const ev2 = (await j('/api/teacher/guests', { method: 'POST', body: { text: 'Dev Nair', newEvent: 'Carol Night' } })).data;
  const gv = (await j('/api/teacher/guests')).data;
  const asha = gv.events.find((e) => e.name === 'Feast Day').guests.find((g) => g.name === 'Asha Rao');
  assert.equal((await j(`/api/teacher/guests/${asha.id}/event`, { method: 'POST', body: { eventId: ev2.event.id } })).status, 200);
  assert.equal((await j(`/api/teacher/guests/${asha.id}/event`, { method: 'POST', body: { eventId: ev2.event.id } })).status, 400, 'twice is refused');
  const after = (await j('/api/teacher/guests')).data;
  assert.equal(after.events.find((e) => e.name === 'Carol Night').guests.length, 2);
  assert.equal((await j(`/api/teacher/children/${asha.id}`, { method: 'PATCH', body: { active: false } })).data.active, false);
  const all = (await j('/api/teacher/children')).data.children;
  assert.ok(all.find((c) => c.name === 'Asha Rao').guest);
  const board = (await j('/api/teacher/board')).data;
  assert.ok(!JSON.stringify(board).includes('Dev Nair'), 'guests are not on the main leaderboard');
});

test('a failed add does not leave an empty new event behind', async () => {
  const r = await j('/api/teacher/guests', { method: 'POST', body: { text: 'Dev Nair', newEvent: 'Ghost Event' } });
  assert.equal(r.data.added.length, 0);
  assert.ok(!(await j('/api/teacher/guests')).data.events.some((e) => e.name === 'Ghost Event'));
});
