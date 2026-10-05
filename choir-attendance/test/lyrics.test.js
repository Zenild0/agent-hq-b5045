import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A tiny pretend lyrics website, so the test never touches the internet.
let mode = 'ok';
const fake = http.createServer((req, res) => {
  if (req.url.startsWith('/page')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<html><head><title>Amazing Grace | Hymns</title></head><body><nav>Menu</nav><article><h1>Amazing Grace</h1><p>Amazing grace,<br>how sweet the sound</p><p>That saved a wretch like me &amp; you</p><script>var x=1</script></article><footer>copyright</footer></body></html>');
  }
  if (req.url.startsWith('/img')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end('x'); }
  if (mode === 'down') { res.writeHead(500); return res.end('no'); }
  const q = new URL(req.url, 'http://x').searchParams.get('q');
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify([
    { trackName: `Amazing Grace`, artistName: 'John Newton', albumName: 'Hymns', plainLyrics: `Amazing grace\r\nhow sweet the sound (${q})` },
    { trackName: 'Amazing Grace', artistName: 'John Newton', plainLyrics: 'duplicate should be dropped' },
    { trackName: 'Instrumental', artistName: 'X', plainLyrics: null },
  ]));
});
await new Promise((ok) => fake.listen(0, ok));
process.env.CHOIR_ALLOW_PRIVATE_FETCH = '1'; // the pretend site is on this machine
process.env.CHOIR_LYRICS_URL = `http://localhost:${fake.address().port}/search`;
process.env.CHOIR_DATA = join(mkdtempSync(join(tmpdir(), 'choir-ly-')), 'db.json');
delete process.env.CHOIR_PIN;
const { server } = await import('../server.js');
let base;
before(() => new Promise((ok) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); })));
after(() => { server.close(); fake.close(); });

test('teacher can search lyrics online; results are cleaned and de-duplicated', async () => {
  const r = await fetch(`${base}/api/teacher/lyrics?q=amazing%20grace`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.results.length, 1);
  assert.equal(d.results[0].title, 'Amazing Grace');
  assert.equal(d.results[0].lyrics, 'Amazing grace\nhow sweet the sound (amazing grace)');
});

test('too-short search is refused, and an offline lyrics site gives a friendly error', async () => {
  assert.equal((await fetch(`${base}/api/teacher/lyrics?q=a`)).status, 400);
  mode = 'down';
  const r = await fetch(`${base}/api/teacher/lyrics?q=amazing`);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /type or paste/);
  mode = 'ok';
});

test('teacher can import words from a pasted link; only the words come back', async () => {
  const post = (url) => fetch(`${base}/api/teacher/lyrics-link`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
  const ok = await post(`http://localhost:${fake.address().port}/page`);
  assert.equal(ok.status, 200);
  const d = await ok.json();
  assert.equal(d.title, 'Amazing Grace');
  assert.match(d.lyrics, /Amazing grace,\nhow sweet the sound/);
  assert.match(d.lyrics, /wretch like me & you/);
  assert.ok(!/Menu|copyright|var x/.test(d.lyrics));
  assert.equal((await post('not a link')).status, 400);
  assert.equal((await post(`http://localhost:${fake.address().port}/img`)).status, 400);
});

test('links to this machine or a home network are refused', async () => {
  const { isPrivateAddress } = await import('../lib/webpage.js');
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.5', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1']) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ['8.8.8.8', '104.21.5.9', '2606:4700::1']) assert.ok(!isPrivateAddress(ip), ip);
});

test('teacher home snapshot works on an empty choir and after a session', async () => {
  const post = (path, body) => fetch(`${base}/api/teacher/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const empty = await (await fetch(`${base}/api/teacher/home`)).json();
  assert.equal(empty.children, 0);
  assert.equal(empty.lastSession, null);
  assert.deepEqual(empty.attention, []);
  assert.equal(empty.lastBackup, null);
  const a = await (await post('children', { name: 'Anna Home' })).json();
  await post('children', { name: 'Ben Home' });
  const t = empty.today;
  await fetch(`${base}/api/teacher/mark`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: t, type: 'saturday', childId: a.id, status: 'present' }) });
  const d = await (await fetch(`${base}/api/teacher/home`)).json();
  assert.equal(d.children, 2);
  assert.equal(d.lastSession.present, 1);
  assert.deepEqual(d.lastSession.unmarked, ['Ben Home']);
  assert.equal(d.top[0].name, 'Anna Home');
  await fetch(`${base}/api/teacher/backup`);
  assert.equal((await (await fetch(`${base}/api/teacher/home`)).json()).lastBackup, t);
});

test('teacher can keep a profile: name, instruments and photo (and it is in the backup)', async () => {
  const put = (path, body, method = 'PUT') => fetch(`${base}/api/teacher/${path}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const r = await put('profile', { name: '  Zenildo   Dias ', instruments: 'Keyboard, guitar' });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { name: 'Zenildo Dias', instruments: 'Keyboard, guitar', photo: null });
  const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64')}`;
  const p = await (await put('profile/photo', { image: JPEG }, 'POST')).json();
  assert.match(p.photo, /^\/photos\/[a-f0-9]{8}\.jpg\?v=\d+$/);
  assert.equal((await fetch(base + p.photo)).status, 200);
  const home = await (await fetch(`${base}/api/teacher/home`)).json();
  assert.equal(home.profile.name, 'Zenildo Dias');
  assert.equal((await put('profile', { name: 'x'.repeat(200) })).status, 400);
});

test('missing hymns can be brought back from a data file, without duplicates', async () => {
  const post = (path, body) => fetch(`${base}/api/teacher/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await post('hymns', { title: 'Already Here', category: 'Entrance' });
  const old = { hymns: [
    { id: 'aaaaaaaa', title: 'Already Here', category: 'Entrance' },
    { id: 'bbbbbbbb', title: 'Lost One', category: 'Gloria', lyrics: 'La la la', link: 'https://example.com/x' },
    { id: 'cccccccc', title: 'Bad Category', category: 'Nope' },
  ] };
  const r = await fetch(`${base}/api/teacher/hymns/recover`, { method: 'POST', body: JSON.stringify(old) });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { added: ['Lost One'], already: 1 });
  const list = await (await fetch(`${base}/api/hymns`)).json();
  const lost = list.hymns.find((x) => x.title === 'Lost One');
  assert.equal(lost.lyrics, 'La la la');
  assert.equal((await fetch(`${base}/api/teacher/hymns/recover`, { method: 'POST', body: '{"x":1}' })).status, 400);
  const again = await (await fetch(`${base}/api/teacher/hymns/recover`, { method: 'POST', body: JSON.stringify(old) })).json();
  assert.deepEqual(again.added, []);
});

test('a daily safety copy of the data is kept next to the data file', async () => {
  const { existsSync, readdirSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  const snaps = join(dirname(process.env.CHOIR_DATA), 'snapshots');
  assert.ok(existsSync(snaps));
  assert.ok(readdirSync(snaps).some((n) => /^db-\d{4}-\d{2}-\d{2}\.json$/.test(n)));
});

test('home shows Vocals subscriptions: active, renew soon, expired', async () => {
  const put = (path, body) => fetch(`${base}/api/teacher/${path}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const post = (path, body) => fetch(`${base}/api/teacher/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const kids = [];
  for (const n of ['Sub One', 'Sub Two']) kids.push(await (await post('children', { name: n })).json());
  assert.equal((await put(`children/${kids[0].id}/game`, { paid: true })).status, 200);
  assert.equal((await put(`children/${kids[1].id}/game`, { paid: true })).status, 200);
  const h = await (await fetch(`${base}/api/teacher/home`)).json();
  assert.ok(h.subs.active >= 2);
  const all = await (await fetch(`${base}/api/teacher/vocals-subs`)).json();
  const states = all.rows.map((r) => r.state);
  assert.ok(states.indexOf('none') > states.lastIndexOf('active'), 'non-subscribers come after active ones');
  const days = all.rows.filter((r) => r.state === 'active' || r.state === 'soon').map((r) => r.daysLeft);
  assert.deepEqual(days, [...days].sort((a, b) => a - b), 'fewest days left first');
  const row = h.subs.rows.find((r) => r.name === 'Sub One');
  assert.equal(row.state, 'active');
  assert.ok(row.daysLeft >= 364 && /^\d{4}-\d{2}-\d{2}$/.test(row.until));
});

test('teacher can set several regular practices through the schedule route', async () => {
  const put = (body) => fetch(`${base}/api/teacher/schedule`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const r = await put({ rules: [{ weekday: 6, time: '19:00' }, { weekday: 3, time: '18:15' }] });
  assert.equal(r.status, 200);
  const v = await r.json();
  assert.deepEqual(v.usual.rules, [{ weekday: 3, time: '18:15' }, { weekday: 6, time: '19:00' }]);
  assert.ok(v.days.some((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay() === 3 && d.time === '18:15'));
  assert.equal((await put({ rules: [{ weekday: 6, time: '19:00' }, { weekday: 6, time: '20:00' }] })).status, 400);
  assert.equal((await put({ rules: [{ weekday: 9, time: '19:00' }] })).status, 400);
  assert.equal((await put({ rules: [{ weekday: 6, time: '7pm' }] })).status, 400);
  assert.equal((await put({ rules: [{ weekday: 6, time: '19:00' }] })).status, 200);
});
