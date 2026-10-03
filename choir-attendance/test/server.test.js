import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'choir-'));
process.env.CHOIR_DATA = join(dir, 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');

let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => server.close());

const j = async (path, { method = 'GET', body, code } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(code ? { 'x-code': code } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), res };
};

const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
let anna;
let ben;

test('teacher adds children with full profiles and a photo', async () => {
  const a = await j('/api/teacher/children', { method: 'POST', body: { name: 'Anna Dias', standard: '5th', joinedYear: 2024, contact: '+91 98200 11111', address: '12 Rose Lane', emergencyName: 'Mary', emergencyPhone: '98200 22222' } });
  assert.equal(a.status, 201);
  anna = a.data;
  ben = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Ben Fernandes', address: 'SECRET STREET 9' } })).data;
  assert.match(anna.code, /^[A-Z2-9]{8}$/);
  const p = await j(`/api/teacher/children/${anna.id}/photo`, { method: 'POST', body: { image: JPEG } });
  assert.equal(p.status, 200);
  assert.match(p.data.photo, /^\/photos\//);
  assert.ok(existsSync(join(dir, 'photos', `${anna.id}.jpg`)));
  const img = await fetch(base + p.data.photo);
  assert.equal(img.status, 200);
  assert.equal((await j(`/api/teacher/children/${anna.id}/photo`, { method: 'POST', body: { image: 'data:image/jpeg;base64,AAAA' } })).status, 400);
});

test('the public page exposes no private details', async () => {
  const { data } = await j('/api/public');
  const text = JSON.stringify(data);
  for (const secret of ['Rose Lane', 'SECRET STREET', '98200', 'Mary', anna.code, ben.code]) {
    assert.ok(!text.includes(secret), `leaked ${secret}`);
  }
  assert.equal((await j(`/api/child/${anna.id}`)).status, 404);
});

test('parents need the child code, and only see their own child', async () => {
  assert.equal((await j('/api/me')).status, 401);
  assert.equal((await j('/api/me', { code: 'WRONGCODE' })).status, 401);
  const me = await j('/api/me', { code: anna.code });
  assert.equal(me.status, 200);
  assert.equal(me.data.name, 'Anna Dias');
  assert.equal(me.data.address, '12 Rose Lane');
  assert.ok(!JSON.stringify(me.data).includes('SECRET STREET'));
  assert.ok(!('code' in me.data));
});

test('parents can edit contact details but not name, standard or code', async () => {
  const r = await j('/api/me', { method: 'PUT', code: anna.code, body: { address: '99 New Road', emergencyName: 'John', emergencyPhone: '+91 99999 00000', name: 'Hacked', standard: '12th' } });
  assert.equal(r.status, 200);
  const me = (await j('/api/me', { code: anna.code })).data;
  assert.equal(me.address, '99 New Road');
  assert.equal(me.emergencyName, 'John');
  assert.equal(me.name, 'Anna Dias');
  assert.equal(me.standard, '5th');
  assert.equal((await j('/api/me', { method: 'PUT', code: anna.code, body: { contact: 'abc<script>' } })).status, 400);
});

test('back-dated and feast attendance feed the leaderboard and occasions', async () => {
  const mark = (date, type, event, childId, status) => j('/api/teacher/mark', { method: 'PUT', body: { date, type, event, childId, status } });
  assert.equal((await mark('2026-05-02', 'saturday', '', anna.id, 'present')).status, 200); // back-dated
  assert.equal((await mark('2026-12-12', 'practice', 'Christmas', anna.id, 'present')).status, 200);
  assert.equal((await mark('2026-12-12', 'practice', 'Christmas', ben.id, 'absent')).status, 200);
  assert.equal((await mark('2026-12-12', 'practice', '', ben.id, 'absent')).status, 400); // occasion required
  const occ = (await j('/api/teacher/occasions?season=2026')).data;
  assert.equal(occ.events[0].event, 'Christmas');
  assert.equal(occ.events[0].children.find((c) => c.name === 'Anna Dias').attended, 1);
  const pub = (await j('/api/public?season=2026')).data;
  assert.equal(pub.yearBoard[0].name, 'Anna Dias');
  assert.equal(pub.yearBoard[0].points, 2);
  assert.equal(pub.yearly[0].winners[0].name, 'Anna Dias');
  assert.ok(!('prize' in pub));
});

test('medical absence keeps a reason and is never a leave; going over the limit removes nobody', async () => {
  const mark = (date, childId, status, reason) => j('/api/teacher/mark', { method: 'PUT', body: { date, type: 'saturday', event: '', childId, status, reason } });
  for (const d of ['2026-06-06', '2026-06-13', '2026-06-20']) assert.equal((await mark(d, ben.id, 'excused', 'Hospitalised')).status, 200);
  assert.equal((await mark('2026-06-27', ben.id, 'excused', 'Not a real reason')).status, 200);
  let detail = (await j(`/api/teacher/child/${ben.id}?season=2026`)).data;
  assert.equal(detail.stats.leaves, 0);
  assert.equal(detail.history.find((h) => h.date === '2026-06-06').reason, 'Hospitalised');
  assert.equal(detail.history.find((h) => h.date === '2026-06-27').reason, ''); // unknown reasons are dropped
  for (const d of ['07-04', '07-11', '07-18', '07-25', '08-01', '08-08']) await mark(`2026-${d}`, ben.id, 'absent');
  detail = (await j(`/api/teacher/child/${ben.id}?season=2026`)).data;
  assert.equal(detail.stats.leaves, 6);
  const sess = (await j('/api/teacher/session?date=2026-10-03&type=saturday')).data;
  assert.deepEqual(sess.pending.map((p) => p.name), ['Ben Fernandes']);
  assert.ok((await j('/api/public?season=2026')).data.yearBoard.some((r) => r.name === 'Ben Fernandes'), 'still on the leaderboard');
  // teacher decides
  const keep = await j(`/api/teacher/children/${ben.id}/decision`, { method: 'PUT', body: { season: 2026, status: 'keep' } });
  assert.equal(keep.data.decision.status, 'keep');
  assert.equal((await j('/api/teacher/session?date=2026-10-03&type=saturday')).data.pending.length, 0);
  await j(`/api/teacher/children/${ben.id}/decision`, { method: 'PUT', body: { season: 2026, status: 'out' } });
  assert.ok(!(await j('/api/public?season=2026')).data.yearBoard.some((r) => r.name === 'Ben Fernandes'), 'hidden only after the teacher says so');
  assert.equal((await j(`/api/teacher/children/${ben.id}/decision`, { method: 'PUT', body: { status: 'banana' } })).status, 400);
  await j(`/api/teacher/children/${ben.id}/decision`, { method: 'PUT', body: { season: 2026, status: null } });
  assert.ok((await j('/api/public?season=2026')).data.yearBoard.some((r) => r.name === 'Ben Fernandes'));
});

test('static files and path traversal', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/teacher`)).status, 200);
  assert.equal((await fetch(`${base}/../server.js`)).status, 404);
  assert.equal((await fetch(`${base}/photos/../../server.js`)).status, 404);
});
