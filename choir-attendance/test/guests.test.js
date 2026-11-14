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

test('an occasion keeps its own list of practice dates and times, separate from the regular schedule', async () => {
  const ev = (await j('/api/teacher/guests', { method: 'POST', body: { text: 'Pia Shah', newEvent: 'Christmas' } })).data.event;
  const inDays = (n) => new Date(Date.now() + 330 * 60000 + n * 86400000).toISOString().slice(0, 10);
  const add = (body) => j(`/api/teacher/occasions/${ev.id}/practices`, { method: 'POST', body });
  assert.equal((await add({ date: inDays(9), time: '18:30', note: 'Bring carol books' })).status, 200);
  assert.equal((await add({ date: inDays(3), time: '17:00' })).status, 200);
  assert.equal((await add({ date: inDays(3), time: '17:00' })).status, 400, 'the same date and time twice');
  assert.equal((await add({ date: 'x', time: '17:00' })).status, 400);
  assert.equal((await add({ date: inDays(5), time: '25:00' })).status, 400);
  const list = (await add({ date: inDays(-4), time: '19:00' })).data.practices;
  assert.deepEqual(list.map((p) => p.time), ['19:00', '17:00', '18:30'], 'oldest first');
  const first = list[1];
  const edited = (await j(`/api/teacher/occasions/${ev.id}/practices`, { method: 'PUT', body: { pid: first.id, time: '17:30' } })).data.practices;
  assert.equal(edited.find((p) => p.id === first.id).time, '17:30');
  const view = (await j('/api/teacher/occasions')).data.events.find((e) => e.id === ev.id);
  assert.equal(view.practices.length, 3);
  const up = (await j('/api/teacher/occasion-practices')).data.practices;
  assert.equal(up.length, 2, 'the past one is not upcoming');
  assert.equal(up[0].event, 'Christmas');
  // a guest in the occasion sees them on their own page; someone outside does not
  const guest = (await j('/api/teacher/children')).data.children.find((c) => c.name === 'Pia Shah');
  const mine = await fetch(`${base}/api/me`, { headers: { 'x-code': guest.code } }).then((r) => r.json());
  assert.equal(mine.occasionPractices.length, 2);
  const other = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Outsider' } })).data;
  assert.equal((await fetch(`${base}/api/me`, { headers: { 'x-code': other.code } }).then((r) => r.json())).occasionPractices.length, 0);
  const left = (await j(`/api/teacher/occasions/${ev.id}/practices`, { method: 'DELETE', body: { pid: first.id } })).data.practices;
  assert.equal(left.length, 2);
});

test('a parent says yes once in the app, the teacher can record or remove it, and the badge follows', async () => {
  const kid = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Consent Kid' } })).data;
  const me = async () => (await fetch(`${base}/api/me`, { headers: { 'x-code': kid.code } }).then((r) => r.json()));
  assert.equal((await me()).consent, null, 'nothing is agreed by default');
  const row = async () => (await j('/api/teacher/children')).data.children.find((c) => c.id === kid.id);
  assert.equal((await row()).consent, false);
  const post = (body) => fetch(`${base}/api/me/consent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-code': kid.code }, body: JSON.stringify(body) });
  assert.equal((await post({})).status, 400, 'the box must be ticked');
  assert.equal((await post({ agree: 'yes' })).status, 400, 'only a real yes counts');
  assert.equal((await post({ agree: true })).status, 200);
  const c = (await me()).consent;
  assert.equal(c.by, 'app');
  assert.match(c.on, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await row()).consent, true);
  assert.equal((await j(`/api/teacher/children/${kid.id}`, { method: 'PATCH', body: { consent: false } })).data.consent, false);
  assert.equal((await me()).consent, null);
  await j(`/api/teacher/children/${kid.id}`, { method: 'PATCH', body: { consent: true } });
  assert.equal((await me()).consent.by, 'teacher', 'a paper form recorded by the teacher');
  const wrong = await fetch(`${base}/api/me/consent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-code': 'NOPE' }, body: JSON.stringify({ agree: true }) });
  assert.equal(wrong.status, 401);
});

test('children and parents see a first name and an initial, the teacher sees the full name, and the fee note can be edited', async () => {
  const { shortName } = await import('../lib/logic.js');
  assert.equal(shortName('Maya Paid'), 'Maya P.');
  assert.equal(shortName('  anna   maria  dsouza '), 'anna D.');
  assert.equal(shortName('Zoe'), 'Zoe');
  assert.equal(shortName(''), '');
  const kid = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Short Namer' } })).data;
  assert.equal((await j('/api/teacher/children')).data.children.find((c) => c.id === kid.id).name, 'Short Namer', 'the teacher keeps the full name');
  const s = (await j('/api/teacher/settings', { method: 'PUT', body: { feeNote: 'To run the server.' } })).data;
  assert.equal(s.feeNote ?? (await j('/api/public')).data.settings.feeNote, 'To run the server.');
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { feeNote: 'x'.repeat(500) } })).status, 400);
});
