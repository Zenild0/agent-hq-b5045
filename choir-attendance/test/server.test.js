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
  assert.match(anna.code, /^[A-Z0-9]{4}$/); // short, roll-number style
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
  assert.equal((await mark('2026-12-12', 'practice', 'Christmas', anna.id, 'present')).status, 400); // occasion must exist first
  const made = await j('/api/teacher/occasions', { method: 'POST', body: { season: 2026, name: 'Christmas', members: [anna.id, ben.id] } });
  assert.equal(made.status, 201);
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

test('teacher can add many children at once; duplicates and bad lines are skipped', async () => {
  const text = ['1. Zara Lobo, 3rd', '- Yash Patel', 'anna dias', '', 'Xavier Noronha;4th', 'Bad Standard, ' + 'x'.repeat(30)].join('\n');
  const r = await j('/api/teacher/bulk-children', { method: 'POST', body: { text, standard: '2nd', joinedYear: 2025 } });
  assert.equal(r.status, 201);
  assert.deepEqual(r.data.added.map((c) => [c.name, c.standard, c.joinedYear]), [['Zara Lobo', '3rd', 2025], ['Yash Patel', '2nd', 2025], ['Xavier Noronha', '4th', 2025]]);
  assert.equal(r.data.skipped.length, 2);
  assert.match(r.data.skipped[0].reason, /already/);
  assert.equal(new Set(r.data.added.map((c) => c.code)).size, 3);
  assert.equal((await j('/api/teacher/bulk-children', { method: 'POST', body: { text: '  \n ' } })).status, 400);
  // each new child's code opens only that child
  const zara = r.data.added[0];
  assert.equal((await j('/api/me', { code: zara.code })).data.name, 'Zara Lobo');
  assert.equal((await j('/api/me', { method: 'PUT', code: zara.code, body: { address: 'Zara home' } })).status, 200);
  assert.notEqual((await j('/api/me', { code: anna.code })).data.address, 'Zara home');
});

test('static files and path traversal', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/teacher`)).status, 200);
  const man = await fetch(`${base}/manifest.webmanifest`);
  assert.equal(man.status, 200);
  assert.match(man.headers.get('content-type'), /manifest\+json/);
  assert.equal((await man.json()).display, 'standalone');
  assert.equal((await fetch(`${base}/sw.js`)).status, 200);
  assert.equal((await fetch(`${base}/icon.svg`)).status, 200);
  assert.equal((await fetch(`${base}/../server.js`)).status, 404);
  assert.equal((await fetch(`${base}/photos/../../server.js`)).status, 404);
});

test('the teacher area opens only on this computer; codes are never public', async () => {
  assert.equal((await fetch(base + '/api/teacher/children')).status, 200); // local: no PIN needed
  // anything arriving through a proxy / shared link is refused
  for (const headers of [{ 'x-forwarded-for': '203.0.113.9' }, { forwarded: 'for=203.0.113.9' }, { 'x-real-ip': '203.0.113.9' }]) {
    assert.equal((await fetch(base + '/api/teacher/children', { headers })).status, 403, JSON.stringify(headers));
    assert.equal((await fetch(base + '/api/teacher/mark', { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })).status, 403);
  }
  // a different Host name (e.g. reached over the network) is refused too
  const viaNetwork = await new Promise((ok) => {
    import('node:http').then(({ request }) => {
      const r = request({ host: 'localhost', port: server.address().port, path: '/api/teacher/children', headers: { host: 'choir.example.com' } }, (res) => ok(res.statusCode));
      r.end();
    });
  });
  assert.equal(viaNetwork, 403);
  assert.equal((await (await fetch(base + '/api/meta')).json()).teacherAllowed, true);
  const text = JSON.stringify((await j('/api/public')).data);
  assert.ok(!text.includes(anna.code));
});

test('guests: added with an occasion, marked only there, kept off the main list, then promoted', async () => {
  const r = await j('/api/teacher/occasions', { method: 'POST', body: { season: 2026, name: 'Easter', members: [anna.id], guests: 'Gita Guest, 4th\nHarry Helper' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.guestsAdded, 2);
  assert.equal((await j('/api/teacher/occasions', { method: 'POST', body: { season: 2026, name: 'easter' } })).status, 400); // duplicate
  const list = (await j('/api/teacher/children')).data.children;
  const gita = list.find((c) => c.name === 'Gita Guest');
  assert.equal(gita.guest, true);
  assert.deepEqual(list.map((c) => c.name), [...list.map((c) => c.name)].sort((a, b) => a.localeCompare(b)));
  // roster: only the people picked for the occasion, alphabetical
  const view = (await j('/api/teacher/session?date=2027-03-20&type=practice&event=Easter')).data;
  assert.deepEqual(view.children.map((c) => c.name), ['Anna Dias', 'Gita Guest', 'Harry Helper']);
  const regular = (await j('/api/teacher/session?date=2027-03-20&type=saturday')).data;
  assert.ok(!regular.children.some((c) => c.guest), 'guests are not in regular attendance');
  const mark = (childId, extra = {}) => j('/api/teacher/mark', { method: 'PUT', body: { date: '2027-03-20', type: 'practice', event: 'Easter', childId, status: 'present', ...extra } });
  assert.equal((await mark(gita.id, { remarks: ['Well behaved'] })).status, 200);
  assert.equal((await mark(ben.id)).status, 400); // Ben was not picked for Easter
  assert.equal((await j('/api/teacher/mark', { method: 'PUT', body: { date: '2027-03-20', type: 'saturday', event: '', childId: gita.id, status: 'present' } })).status, 400);
  assert.ok(!(await j('/api/public?season=2026')).data.yearBoard.some((x) => x.name === 'Gita Guest'));
  const occ = (await j('/api/teacher/occasions?season=2026')).data.events.find((x) => x.event === 'Easter');
  assert.equal(occ.children.find((c) => c.name === 'Gita Guest').good, 1);
  // cannot drop someone who already has attendance; can drop a guest with none
  const upd = await j(`/api/teacher/occasions/${occ.id}`, { method: 'PUT', body: { members: [anna.id] } });
  assert.equal(upd.status, 400);
  // promote to the main group
  await j(`/api/teacher/children/${gita.id}`, { method: 'PATCH', body: { guest: false } });
  assert.ok((await j('/api/teacher/session?date=2027-03-20&type=saturday')).data.children.some((c) => c.name === 'Gita Guest'));
  assert.ok((await j('/api/public?season=2026')).data.yearBoard.some((x) => x.name === 'Gita Guest'));
});

test('one shared link: parents enter a short code (any case, with or without a dash)', async () => {
  const code = anna.code.toLowerCase().replace(/(..)(..)/, '$1-$2'); // typed in any case, with a dash
  assert.equal((await j('/api/me', { code })).data.name, 'Anna Dias');
  assert.equal((await j('/api/me', { code: 'ABC' })).status, 401);
});

test('teacher can choose short codes like 1001 or CC01; duplicates and junk are refused', async () => {
  const set = (id, code) => j(`/api/teacher/children/${id}`, { method: 'PATCH', body: { code } });
  assert.equal((await set(anna.id, '1001')).data.code, '1001');
  assert.equal((await set(ben.id, 'cc-01')).data.code, 'CC01'); // tidied to upper case
  assert.equal((await set(ben.id, '1001')).status, 400); // already Anna's
  assert.equal((await set(ben.id, 'ab')).status, 400); // too short
  assert.equal((await set(ben.id, 'x'.repeat(9))).status, 400); // too long
  assert.equal((await j('/api/me', { code: '1001' })).data.name, 'Anna Dias');
  assert.equal((await j('/api/me', { code: 'cc01' })).data.name, 'Ben Fernandes');
  anna.code = '1001';
});

test('older long codes are shortened once on startup, short ones are left alone', async () => {
  const { openStore } = await import('../lib/store.js');
  const { writeFileSync } = await import('node:fs');
  const file = join(dir, 'old.json');
  writeFileSync(file, JSON.stringify({ children: [{ id: 'a1', name: 'Old', active: true, code: 'ABCDEFGH' }, { id: 'b2', name: 'Short', active: true, code: 'CC01' }], sessions: {} }));
  const first = openStore(file).db;
  assert.match(first.children[0].code, /^[A-Z0-9]{4}$/);
  assert.equal(first.children[1].code, 'CC01');
  const again = openStore(file).db; // second start: nothing changes
  assert.equal(again.children[0].code, first.children[0].code);
});

test('five wrong codes lock a device out; the teacher can unlock everyone', async () => {
  await j('/api/teacher/unlock-codes', { method: 'POST', body: {} }); // start clean
  for (let i = 0; i < 5; i += 1) assert.equal((await j('/api/me', { code: `ZZ${i}9` })).status, 401);
  assert.equal((await j('/api/me', { code: 'ZZ99' })).status, 429);
  assert.equal((await j('/api/me', { code: anna.code })).status, 429); // even the right code waits
  assert.equal((await j('/api/teacher/children')).data.lockedOut, 1);
  const r = await j('/api/teacher/unlock-codes', { method: 'POST', body: {} });
  assert.equal(r.data.cleared, 1);
  assert.equal((await j('/api/teacher/children')).data.lockedOut, 0);
  assert.equal((await j('/api/me', { code: anna.code })).status, 200);
});

test('hymn library: add, bulk paste, links, recordings, public browsing', async () => {
  const add = (body) => j('/api/teacher/hymns', { method: 'POST', body });
  const one = await add({ title: 'Here I Am, Lord', category: 'Entrance', link: 'https://youtu.be/abc123', notes: 'Key of D' });
  assert.equal(one.status, 201);
  assert.equal((await add({ title: 'here i am, lord', category: 'Entrance' })).status, 400); // duplicate in same category
  assert.equal((await add({ title: 'Here I Am, Lord', category: 'Communion' })).status, 201); // same title, other category is fine
  assert.equal((await add({ title: 'No Category' })).status, 400);
  assert.equal((await add({ title: 'Bad', category: 'Karaoke' })).status, 400);
  assert.equal((await add({ title: 'Bad link', category: 'Gloria', link: 'javascript:alert(1)' })).status, 400);

  const bulk = await j('/api/teacher/hymns/bulk', { method: 'POST', body: { category: 'Gloria', text: '1. Glory to God\n- Gloria in Excelsis | https://example.com/gloria\nglory to god\nBroken | not-a-link' } });
  assert.equal(bulk.status, 201);
  assert.deepEqual(bulk.data.added.map((h) => h.title), ['Glory to God', 'Gloria in Excelsis']);
  assert.equal(bulk.data.added[1].link, 'https://example.com/gloria');
  assert.equal(bulk.data.skipped.length, 2);

  // recordings: only audio types, served with Range support
  const id = one.data.id;
  const up = (type, bytes) => fetch(`${base}/api/teacher/hymns/${id}/audio`, { method: 'PUT', headers: { 'content-type': type }, body: bytes });
  assert.equal((await up('text/html', Buffer.from('<script>'))).status, 400);
  const bytes = Buffer.from('0123456789abcdefghij');
  const ok = await up('audio/mpeg', bytes);
  assert.equal(ok.status, 200);
  const audioUrl = (await ok.json()).audio;
  assert.match(audioUrl, /^\/hymns\/[a-f0-9]{8}\.mp3\?v=/);
  const full = await fetch(base + audioUrl);
  assert.equal(full.headers.get('content-type'), 'audio/mpeg');
  assert.equal(full.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(Buffer.from(await full.arrayBuffer()).toString(), '0123456789abcdefghij');
  const part = await fetch(base + audioUrl, { headers: { range: 'bytes=5-9' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 5-9/20');
  assert.equal(Buffer.from(await part.arrayBuffer()).toString(), '56789');
  assert.equal((await fetch(base + audioUrl, { headers: { range: 'bytes=50-60' } })).status, 416);

  // parents browse by category without logging in
  const pub = (await j('/api/hymns')).data;
  assert.equal(pub.categories.length, 10);
  assert.equal(pub.categories.find((c) => c.id === 'LHM').label, 'Lord Have Mercy (LHM)');
  const mine = pub.hymns.find((h) => h.id === id);
  assert.equal(mine.audio, audioUrl);
  assert.equal(mine.link, 'https://youtu.be/abc123');
  const titles = pub.hymns.map((h) => h.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));

  // edit, remove recording, delete
  assert.equal((await j(`/api/teacher/hymns/${id}`, { method: 'PATCH', body: { category: 'Recessional', notes: '' } })).data.category, 'Recessional');
  assert.equal((await fetch(`${base}/api/teacher/hymns/${id}/audio`, { method: 'DELETE' })).status, 200);
  assert.equal((await fetch(base + audioUrl)).status, 404);
  assert.equal((await j(`/api/teacher/hymns/${id}`, { method: 'DELETE' })).status, 200);
  assert.ok(!(await j('/api/hymns')).data.hymns.some((h) => h.id === id));
  // writing needs the teacher area (refused when arriving via a proxy)
  const viaProxy = await fetch(`${base}/api/teacher/hymns`, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9', 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Hack', category: 'Gloria' }) });
  assert.equal(viaProxy.status, 403);
});
