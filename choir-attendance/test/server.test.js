import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'choir-'));
process.env.CHOIR_DATA = join(dir, 'db.json');
delete process.env.CHOIR_PIN;
process.env.CHOIR_GAME_GAP_MS = '0';
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
  assert.equal((await fetch(`${base}/icon-512.png`)).status, 200);
  assert.equal((await fetch(`${base}/logo.png`)).status, 200);
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

test('tar files round-trip and reject junk', async () => {
  const { createTar, readTar } = await import('../lib/tar.js');
  const files = [{ name: 'db.json', data: Buffer.from('{"a":1}') }, { name: 'photos/abcd1234.jpg', data: Buffer.alloc(1500, 7) }, { name: 'empty', data: Buffer.alloc(0) }];
  const back = readTar(createTar(files));
  assert.deepEqual(back.map((f) => [f.name, f.data.length]), [['db.json', 7], ['photos/abcd1234.jpg', 1500], ['empty', 0]]);
  assert.equal(back[1].data[100], 7);
  assert.throws(() => readTar(Buffer.from('this is not a tar file'.repeat(40))));
});

test('backup and restore bring back everything, and nothing else', async () => {
  const bk = await fetch(`${base}/api/teacher/backup`);
  assert.equal(bk.status, 200);
  assert.match(bk.headers.get('content-disposition'), /choir-backup-\d{4}-\d{2}-\d{2}\.tar/);
  const tar = Buffer.from(await bk.arrayBuffer());
  const { readTar, createTar } = await import('../lib/tar.js');
  const names = readTar(tar).map((f) => f.name);
  assert.ok(names.includes('db.json') && names.some((n) => n.startsWith('photos/')), names.join());

  // change things after the backup was taken
  const temp = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Temp Child' } })).data;
  await j(`/api/teacher/children/${anna.id}`, { method: 'PATCH', body: { name: 'Anna Changed' } });
  const send = (body) => fetch(`${base}/api/teacher/restore`, { method: 'POST', headers: { 'content-type': 'application/x-tar' }, body });
  // junk is refused and changes nothing
  assert.equal((await send(Buffer.from('not a backup at all'.repeat(50)))).status, 400);
  assert.equal((await send(createTar([{ name: 'db.json', data: Buffer.from('{"nope":true}') }]))).status, 400);
  const still = (await j('/api/teacher/children')).data.children.map((c) => c.name);
  assert.ok(still.includes('Temp Child') && still.includes('Anna Changed'));

  const ok = await send(tar);
  assert.equal(ok.status, 200);
  const after = (await j('/api/teacher/children')).data.children;
  assert.ok(!after.some((c) => c.id === temp.id), 'child added after the backup is gone');
  assert.equal(after.find((c) => c.id === anna.id).name, 'Anna Dias', 'rename undone');
  assert.ok(existsSync(join(dir, 'photos', `${anna.id}.jpg`)), 'photo restored');
  assert.ok((await j('/api/hymns')).data.hymns.length >= 0);
  assert.equal((await j('/api/me', { code: anna.code })).status, 200, 'parent codes survive a restore');
  // restoring is for the teacher only
  const viaProxy = await fetch(`${base}/api/teacher/restore`, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: tar });
  assert.equal(viaProxy.status, 403);
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test('hosted mode (behind a proxy): per-visitor lockouts, PIN-protected teacher area', async () => {
  const { spawn } = await import('node:child_process');
  const port = 3300 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [new URL('../server.js', import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), CHOIR_DATA: join(dir, 'hosted', 'db.json'), CHOIR_PIN: 'owner-pin-9', CHOIR_TRUST_PROXY: '1' },
    stdio: 'ignore',
  });
  try {
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`${url}/healthz`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
    const asVisitor = (ip, path, headers = {}) => fetch(url + path, { headers: { 'x-forwarded-for': ip, ...headers } });
    // teacher area: PIN required from anywhere except the machine itself
    assert.equal((await asVisitor('9.9.9.9', '/api/teacher/children')).status, 401);
    assert.equal((await asVisitor('9.9.9.9', '/api/teacher/children', { 'x-pin': 'wrong' })).status, 401);
    assert.equal((await asVisitor('9.9.9.9', '/api/teacher/children', { 'x-pin': 'owner-pin-9' })).status, 200);
    const meta = await (await asVisitor('9.9.9.9', '/api/meta')).json();
    assert.deepEqual([meta.pinRequired, meta.teacherAllowed], [true, true]);
    // one parent's wrong codes lock only that parent, not everyone behind the proxy
    for (let i = 0; i < 5; i += 1) assert.equal((await asVisitor('1.1.1.1', '/api/me', { 'x-code': `NO${i}X` })).status, 401);
    assert.equal((await asVisitor('1.1.1.1', '/api/me', { 'x-code': 'NOPE' })).status, 429);
    assert.equal((await asVisitor('2.2.2.2', '/api/me', { 'x-code': 'NOPE' })).status, 401);
  } finally {
    child.kill();
  }
});

test('public mode: no "this computer" shortcut, even from localhost', async () => {
  const { spawn } = await import('node:child_process');
  const port = 3800 + Math.floor(Math.random() * 500);
  const run = async (extraEnv, check) => {
    const child = spawn(process.execPath, [new URL('../server.js', import.meta.url).pathname], {
      env: { ...process.env, PORT: String(port), CHOIR_DATA: join(dir, `pub-${Math.random()}`, 'db.json'), CHOIR_PUBLIC: '1', ...extraEnv }, stdio: 'ignore',
    });
    try {
      const url = `http://localhost:${port}`;
      for (let i = 0; i < 40; i += 1) { try { if ((await fetch(`${url}/healthz`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 100)); }
      await check(url);
    } finally { child.kill(); await new Promise((r) => setTimeout(r, 200)); }
  };
  await run({}, async (url) => { // no PIN configured: locked for everybody
    assert.equal((await fetch(`${url}/api/teacher/children`)).status, 403);
    assert.equal((await (await fetch(`${url}/api/meta`)).json()).teacherAllowed, false);
  });
  await run({ CHOIR_PIN: 'my-secret-pin' }, async (url) => { // PIN configured: needed even on localhost
    assert.equal((await fetch(`${url}/api/teacher/children`)).status, 401);
    assert.equal((await fetch(`${url}/api/teacher/children`, { headers: { 'x-pin': 'my-secret-pin' } })).status, 200);
  });
});

test('public mode refuses to start with a weak PIN', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [new URL('../server.js', import.meta.url).pathname], {
    env: { ...process.env, PORT: '0', CHOIR_DATA: join(dir, 'weak', 'db.json'), CHOIR_PUBLIC: '1', CHOIR_PIN: '1234' }, encoding: 'utf8', timeout: 8000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /too short/);
});

test('remarks: one flat penalty per day, a bonus per good remark, dated log for the teacher, hymn lyrics', async () => {
  const mark = (date, remarks) => j('/api/teacher/mark', { method: 'PUT', body: { date, type: 'saturday', event: '', childId: ben.id, status: 'present', remarks, note: 'n' } });
  assert.equal((await mark('2026-06-06', ['Late', 'Talking / disruptive', 'Not paying attention'])).status, 200);
  assert.equal((await mark('2026-06-13', ['Well behaved', 'Helped others'])).status, 200);
  const t = (await j(`/api/teacher/child/${ben.id}?season=2026`)).data;
  const hist = Object.fromEntries(t.history.map((h) => [h.date, h]));
  assert.deepEqual([hist['2026-06-06'].points, hist['2026-06-06'].deduction], [0.5, 0.5]);
  assert.deepEqual([hist['2026-06-13'].points, hist['2026-06-13'].bonus], [1.5, 0.5]);
  assert.deepEqual(t.remarkLog.map((x) => x.date).slice(0, 2), ['2026-06-13', '2026-06-06']);
  const h = await j('/api/teacher/hymns', { method: 'POST', body: { category: 'Entrance', title: 'Lyric Hymn', lyrics: 'Line one\nLine two' } });
  assert.equal(h.data.lyrics, 'Line one\nLine two');
  assert.equal((await j('/api/hymns')).data.hymns.find((x) => x.title === 'Lyric Hymn').lyrics, 'Line one\nLine two');
});

test('schedule: usual practice, exceptions, special days, public view without private data', async () => {
  const put = (path, body, method = 'PUT') => j(`/api/teacher/schedule${path}`, { method, body });
  const first = (await j('/api/public')).data.schedule;
  assert.equal(first.usual.time, '19:00');
  assert.equal(first.usual.note, 'Carry your books');
  assert.ok(first.next && first.next.note === 'Carry your books');
  assert.equal((await put('', { time: '7pm' })).status, 400);
  assert.equal((await put('', { time: '19:30' })).data.usual.time, '19:30');
  const sat = first.next.date;
  const cancelled = (await put('/day', { date: sat, cancelled: true })).data;
  assert.ok(cancelled.days.find((d) => d.date === sat).cancelled);
  assert.notEqual(cancelled.next.date, sat);
  assert.equal((await put('/day', { date: sat, cancelled: false })).data.days.find((d) => d.date === sat).cancelled, false);
  const feast = new Date(Date.parse(`${first.today}T00:00:00Z`) + 40 * 86400000).toISOString().slice(0, 10);
  const xmas = (await put('/day', { date: feast, special: true, time: '17:00', label: 'Christmas', note: 'White shirts' })).data;
  assert.deepEqual(xmas.days.filter((d) => d.date === feast).map((d) => [d.time, d.label, d.note, d.special]), [['17:00', 'Christmas', 'White shirts', true]]);
  assert.equal((await put('/day', { date: 'nope' })).status, 400);
  assert.equal((await j('/api/teacher/schedule', { method: 'DELETE' })).status, 404);
  const removed = (await put('/day', { date: feast }, 'DELETE')).data;
  assert.ok(!removed.days.some((d) => d.date === feast));
  assert.ok(!JSON.stringify((await j('/api/public')).data.schedule).includes(anna.code));
  await put('', { time: '19:00' });
});

test('singing game: off by default, unlocks level by level, one daily try, boards without private data', async () => {
  const game = (path, opts = {}) => j(`/api/game${path}`, opts);
  const round = (n, won = n) => Array.from({ length: n }, (_, i) => ({ won: i < won, ms: i < won ? 2500 : 15000, limit: 15000, err: 12, hints: 0 }));
  // codes may have been changed by earlier tests: ask the teacher view for the current ones
  anna.code = (await j(`/api/teacher/child/${anna.id}`)).data.code;
  ben.code = (await j(`/api/teacher/child/${ben.id}`)).data.code;
  await j('/api/teacher/unlock-codes', { method: 'POST', body: {} }); // earlier tests used wrong codes on purpose
  assert.equal((await game('', { code: anna.code })).status, 403, 'switched off until the teacher turns it on');
  assert.equal((await j('/api/public')).data.settings.gameEnabled, false);
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { gameEnabled: true } })).status, 200);
  assert.equal((await j('/api/public')).data.settings.gameEnabled, true);
  assert.equal((await game('')).status, 401, 'needs the child code');
  await j('/api/teacher/unlock-codes', { method: 'POST', body: {} });
  const s0 = (await game('', { code: anna.code })).data;
  assert.equal(s0.levels.length, 12);
  assert.equal(s0.me.maxPlayable, 1);
  const free0 = s0;
  const spec = s0.levels[0].stages;
  assert.deepEqual(spec.map((x) => x.count), [4, 6, 7]);
  const post = (code, level, stage, n, won) => game('/round', { method: 'POST', code, body: { level, stage, results: round(n, won) } });
  assert.equal((await post(anna.code, 2, 1, 4)).status, 403, 'level 2 is behind the unlock');
  assert.equal((await post(anna.code, 1, 2, 6)).status, 400, 'stage 2 is locked');
  assert.equal((await post(anna.code, 1, 1, 3)).status, 400, 'incomplete round');
  const st1 = await post(anna.code, 1, 1, 4);
  assert.equal(st1.status, 200);
  assert.equal(st1.data.state.me.stages['1'], 1);
  assert.deepEqual(st1.data.state.me.cleared, []);
  assert.ok(st1.data.newBadges.includes('first_note'));
  await post(anna.code, 1, 2, 6);
  assert.equal(free0.warmupLeft, 3);
  const ok = await post(anna.code, 1, 3, 7);
  assert.equal(ok.data.levelCleared, true);
  // Level 1 is free; the rest of the game needs the teacher's unlock after the parent pays
  assert.equal((await post(anna.code, 2, 1, 4)).status, 403, 'level 2 is paid');
  assert.equal((await game('/daily', { method: 'POST', code: anna.code, body: { results: round(6) } })).status, 403, 'daily is paid');
  const free = (await game('?level=1', { code: anna.code })).data;
  assert.deepEqual([free.paid, free.daily, free.weekly.board], [false, null, null]);
  assert.deepEqual(free.pay, { price: 500, mobile: '', upi: '' });
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { gamePayMobile: '98200 11111', gameUpi: 'choir@upi', gamePrice: 500 } })).status, 200);
  assert.equal((await j('/api/teacher/settings', { method: 'PUT', body: { gameUpi: 'not a upi id' } })).status, 400);
  assert.equal((await game('', { code: anna.code })).data.pay.upi, 'choir@upi');
  assert.equal((await j(`/api/teacher/children/${anna.id}/game`, { method: 'PUT', body: { paid: true } })).data.gamePaid, true);
  assert.equal((await j(`/api/teacher/children/${ben.id}/game`, { method: 'PUT', body: { paid: true } })).data.gamePaid, true);
  assert.equal((await j(`/api/teacher/child/${anna.id}`)).data.gamePaid, true);
  assert.equal((await game('', { code: anna.code })).data.pay, null, 'no payment details once unlocked');
  assert.equal((await game('/warmup', { method: 'POST', code: anna.code, body: {} })).data.left, null, 'unlimited warm-up once unlocked');
  assert.deepEqual(ok.data.state.me.cleared, [1]);
  assert.equal(ok.data.state.me.maxPlayable, 2);
  for (const [n, w] of [[4, 4], [6, 6], [7, 5]]) await post(ben.code, 1, [4, 6, 7].indexOf(n) + 1, n, w);
  const gb = await game('?level=1', { code: ben.code });
  assert.equal(gb.status, 200, JSON.stringify(gb.data));
  const board = gb.data.weekly.board;
  assert.deepEqual(board.top.map((r) => [r.name, r.rank]), [['Anna Dias', 1], ['Ben Fernandes', 2]]);
  const text = JSON.stringify(board);
  for (const secret of ['Rose Lane', 'SECRET STREET', '98200', anna.code, ben.code]) assert.ok(!text.includes(secret), `leaked ${secret}`);
  const d1 = await game('/daily', { method: 'POST', code: anna.code, body: { results: round(6, 4) } });
  assert.equal(d1.data.already, false);
  const d2 = await game('/daily', { method: 'POST', code: anna.code, body: { results: round(6, 6) } });
  assert.equal(d2.data.already, true);
  assert.equal(d2.data.state.daily.mine.won, 4);
  assert.equal(d2.data.state.daily.board.top[0].name, 'Anna Dias');
  assert.equal(d2.data.state.daily.count, 6);
  await j('/api/teacher/settings', { method: 'PUT', body: { gameEnabled: false } });
  assert.equal((await game('', { code: anna.code })).status, 403);
});

test('singing game: an unpaid child gets the Warm-up (first session today), the game switch gates it', async () => {
  await j('/api/teacher/settings', { method: 'PUT', body: { gameEnabled: true } });
  const cleo = (await j('/api/teacher/children', { method: 'POST', body: { name: 'Cleo Warm' } })).data;
  await j('/api/teacher/unlock-codes', { method: 'POST', body: {} });
  const st = (await j('/api/game', { code: cleo.code })).data;
  assert.deepEqual([st.paid, st.warmupLeft], [false, 3]);
  const w1 = (await j('/api/game/warmup', { method: 'POST', code: cleo.code, body: {} })).data;
  assert.equal(w1.left, 2);
  assert.equal((await j('/api/game/warmup', { method: 'POST', code: cleo.code, body: {} })).data.left, 2, 'same day, same session');
  assert.equal((await j('/api/game', { code: cleo.code })).data.warmupLeft, 2);
  await j('/api/teacher/settings', { method: 'PUT', body: { gameEnabled: false } });
});
